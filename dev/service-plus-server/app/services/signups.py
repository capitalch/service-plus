"""Public sign-up and enquiry logic (plans/plan.md Step 7), called by website_router.py.

- Lite / Basic / Standard ("lt") sign-ups are saved in security.sales_enquiry of the
  default customer database; there is never a fallback to the control-plane table.
- Enterprise enquiries are saved in service_plus_client.public.sales_enquiry.

Save first, email after: a failed email is logged, never fails the request. Only the
random reference ever leaves the server, never a row id.
"""

import re
import secrets
from typing import Awaitable, Callable

import psycopg

from app.config import settings
from app.core.exceptions import AppMessages, ServicePlusException
from app.core.plan_prices import get_plan_price
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_signups import SignupServerSql
from app.graphql.pubsub import publish_sales_enquiry_count
from app.graphql.resolvers.bu_admin.provisioning import BU_NAME_PATTERN
from app.logger import logger
from app.services.default_customer import get_default_customer_client, get_enterprise_enquiry_notify_email
from app.services.signup_emails import approver_email, send_text_email, thank_you_email, upgrade_thank_you_email

LT_PLAN_CODES = ("lite", "basic", "standard")
PAID_PLAN_CODES = ("basic", "enterprise", "standard")
UPGRADE_PLAN_CODES = ("basic", "standard")
ONE_BRANCH_PLAN_CODES = ("lite", "basic", "standard")

# BU codes must match ^[a-z0-9_]{3,30}$; the base is cut to 26 so "_NN" still fits.
BU_CODE_BASE_MAX = 26
BU_CODE_MAX_SUFFIX = 99
RESERVED_BU_CODES = frozenset({"demo1", "information_schema", "public", "security"})

# No 0/O or 1/I, so a reference read out over the phone is unambiguous.
_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INSERT_ATTEMPTS = 3

# Unique index of security.sales_enquiry whose clash means "this email already has a pending request".
_PENDING_EMAIL_INDEX = "sales_enquiry_open_email_key"


class SignupException(ServicePlusException):
    """A sign-up refused for a reason the applicant should see; `code` picks the HTTP status."""


def make_reference() -> str:
    """A random public reference such as 'SP-7K3M9QX2'."""
    return "SP-" + "".join(secrets.choice(_REFERENCE_ALPHABET) for _ in range(8))


# Trailing company-form words left out of a BU code ("ABC Pvt Ltd" -> abc); the name keeps them.
LEGAL_SUFFIXES = frozenset(
    {"co", "company", "corp", "corporation", "inc", "limited", "llp", "ltd", "opc", "p", "private", "pvt"}
)
CITY_SLUG_MAX = 10


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def bu_code_base(business_name: str) -> str:
    """The BU code a business name starts from, before clash suffixes: lower-case, other
    characters to '_', trailing company-form words (pvt, ltd, llp, …) dropped unless that
    leaves under 3 characters, cut to 26; short codes padded with 'bu'; 'bu_' in front
    of one starting with 'pg_' or a digit."""
    words = _slug(business_name).split("_")
    kept = list(words)
    while len(kept) > 1 and kept[-1] in LEGAL_SUFFIXES:
        kept.pop()
    code = "_".join(kept)
    if len(code) < 3:
        code = "_".join(words)
    code = code[:BU_CODE_BASE_MAX].strip("_")
    if len(code) < 3:
        code = f"bu_{code}" if code else "bu_new"
    if code.startswith("pg_") or code[0].isdigit():
        code = f"bu_{code}"[:BU_CODE_BASE_MAX].rstrip("_")
    return code


async def derive_bu_code(
    business_name: str, is_taken: Callable[[str], Awaitable[bool]], city: str | None = None
) -> str:
    """bu_code_base; if reserved or taken, base_<city>; then '_2', '_3', … on the last one.
    `is_taken` says whether a code is used; shared with sign-up approval (Steps 9 and 10)."""
    base = bu_code_base(business_name)
    candidates = [base]
    city_slug = _slug(city or "")[:CITY_SLUG_MAX].strip("_")
    if city_slug:
        stem = base[: BU_CODE_BASE_MAX - len(city_slug) - 1].rstrip("_")
        candidates.append(f"{stem}_{city_slug}")
    for code in candidates:
        if code not in RESERVED_BU_CODES and not await is_taken(code):
            return code
    last = candidates[-1]
    for n in range(2, BU_CODE_MAX_SUFFIX + 1):
        code = f"{last}_{n}"
        if code not in RESERVED_BU_CODES and not await is_taken(code):
            return code
    raise SignupException(message=AppMessages.OPERATION_FAILED, code="BU_CODE_EXHAUSTED")


def _normalise(payload: dict) -> dict:
    """Trimmed fields; email lower-case so the open-request unique index catches case variants."""
    message = (payload.get("message") or "").strip()
    return {
        "branches": payload["branches"],
        "business_name": payload["business_name"].strip(),
        "city": payload["city"].strip(),
        "email": payload["email"].strip().lower(),
        "gstin": payload.get("gstin") or None,
        "message": message or None,
        "mobile": payload["mobile"],
        "name": payload["name"].strip(),
        "plan_code": payload["plan_code"],
    }


async def _bu_name(db_name: str, business_name: str, city: str) -> str:
    """The business name, plus ' (city)' when that clashes with a BU or open request and
    the longer name still passes the BU name rule. A remaining clash is fixed at approval."""
    rows = await exec_sql(db_name, "security", SignupServerSql.CHECK_LT_BU_NAME_TAKEN, {"name": business_name})
    if not rows[0]["taken"]:
        return business_name
    with_city = f"{business_name} ({city})"
    return with_city if BU_NAME_PATTERN.match(with_city) else business_name


async def _send_approver_emails(db_name: str, enquiry: dict) -> None:
    rows = await exec_sql(db_name, "security", SignupServerSql.GET_ACTIVE_ADMIN_EMAILS)
    recipients = {r["email"] for r in rows}
    if settings.lite_basic_standard_enquiry_notify_email:
        recipients.add(settings.lite_basic_standard_enquiry_notify_email.strip().lower())
    subject, text = approver_email(enquiry)
    for to in sorted(recipients):
        await send_text_email(to, subject, text, reply_to=enquiry["email"])


def plan_rule_refusal(managed_bus: list[dict], plan_code: str) -> SignupException | None:
    """The plan rule for a login asking for another BU, from the BUs it is Manager of: while one
    of them is still Lite it must be upgraded first (no new Lite, Basic or Standard), and an
    owner of a paid BU cannot take the free Lite plan. None when the request may go ahead.
    Shared by sign-up (after the code) and approval (looked up again)."""
    plans = {bu["plan_code"] for bu in managed_bus}
    if "lite" in plans:
        return SignupException(message=AppMessages.SIGNUP_LITE_EXISTS, code="SIGNUP_LITE_EXISTS")
    if plan_code == "lite" and plans & set(PAID_PLAN_CODES):
        return SignupException(message=AppMessages.SIGNUP_LITE_NOT_FOR_PAID, code="SIGNUP_LITE_NOT_FOR_PAID")
    return None


async def check_lt_signup(payload: dict) -> dict:
    """The normalised form of a Lite / Basic / Standard sign-up once it passes every check
    that does not need the email proven: plan, BU name rule, one branch, and no pending
    request with this email. Run before the email code is sent and again before saving."""
    data = _normalise(payload)
    if data["plan_code"] not in LT_PLAN_CODES:
        raise SignupException(message=AppMessages.SIGNUP_WRONG_ENDPOINT, code="SIGNUP_WRONG_ENDPOINT")

    client = await get_default_customer_client()  # raises DEFAULT_DB_NOT_CONFIGURED; nothing written
    db_name = client["db_name"]

    if not BU_NAME_PATTERN.match(data["business_name"]):
        raise SignupException(message=AppMessages.BU_NAME_FORMAT, code="VALIDATION_ERROR")
    if data["plan_code"] in ONE_BRANCH_PLAN_CODES and data["branches"] != 1:
        raise SignupException(message=AppMessages.SIGNUP_BRANCHES_ONE, code="VALIDATION_ERROR")

    pending = await exec_sql(db_name, "security", SignupServerSql.CHECK_LT_SIGNUP_PENDING, {"email": data["email"]})
    if pending:
        raise SignupException(message=AppMessages.SIGNUP_PENDING_EXISTS, code="SIGNUP_PENDING_EXISTS")
    return data


async def submit_lt_signup(payload: dict, ip: str | None) -> dict:
    """Save a Lite / Basic / Standard sign-up whose email was just proven by its code
    (app/services/signup_otp.py), publish the pending count, email the applicant and the
    approvers. An email that already has a login makes this a returning applicant: the
    request records that user, and approval adds the new BU to that login (Step 6).
    Returns status and reference, plus existing_login and username for a returning applicant."""
    data = await check_lt_signup(payload)
    client = await get_default_customer_client()
    db_name = client["db_name"]

    users = await exec_sql(db_name, "security", SignupServerSql.GET_LT_SIGNUP_EXISTING_USER, {"email": data["email"]})
    existing = users[0] if users else None
    if existing and existing["is_admin"]:
        raise SignupException(message=AppMessages.SIGNUP_DUPLICATE, code="SIGNUP_DUPLICATE")
    if existing:
        managed = await exec_sql(db_name, "security", SignupServerSql.GET_LT_MANAGED_BUS, {"email": data["email"]})
        refusal = plan_rule_refusal(managed, data["plan_code"])
        if refusal:
            raise refusal

    price = get_plan_price(data["plan_code"])

    async def code_taken(code: str) -> bool:
        rows = await exec_sql(db_name, "security", SignupServerSql.CHECK_LT_BU_CODE_TAKEN, {"code": code})
        return bool(rows[0]["taken"])

    enquiry = {
        **data,
        "bu_name": await _bu_name(db_name, data["business_name"], data["city"]),
        "existing_user_id": existing["id"] if existing else None,
        "existing_username": existing["username"] if existing else None,
        "ip": ip,
        "monthly_fee_paise": price.monthly_fee_paise,
        "payment_status": "pending" if price.setup_fee_paise else "not_required",
        "setup_fee_paise": price.setup_fee_paise,
    }
    for attempt in range(1, INSERT_ATTEMPTS + 1):
        enquiry["bu_code"] = await derive_bu_code(data["business_name"], code_taken, data["city"])
        enquiry["reference"] = make_reference()
        try:
            await exec_sql(db_name, "security", SignupServerSql.INSERT_LT_ENQUIRY, enquiry)
            break
        except psycopg.errors.UniqueViolation as e:
            if e.diag.constraint_name == _PENDING_EMAIL_INDEX:
                raise SignupException(message=AppMessages.SIGNUP_PENDING_EXISTS, code="SIGNUP_PENDING_EXISTS") from e
            # A reference or BU code taken a moment ago by another sign-up: try new ones.
            logger.info("Sign-up insert clash on %s (attempt %s)", e.diag.constraint_name, attempt)
            if attempt == INSERT_ATTEMPTS:
                raise

    pending = await exec_sql(db_name, "security", SignupServerSql.GET_LT_PENDING_COUNT)
    await publish_sales_enquiry_count(db_name, "LT", pending[0]["pending"])

    subject, text = thank_you_email(enquiry)
    await send_text_email(enquiry["email"], subject, text)
    await _send_approver_emails(db_name, enquiry)

    result = {"reference": enquiry["reference"], "status": "pending"}
    if existing:
        result.update(existing_login=True, username=existing["username"])
    return result


async def submit_lt_upgrade(payload: dict, ip: str | None) -> dict:
    """Save a request to move this email's Lite BU to Basic or Standard; the email was just
    proven by its code. The login must be Manager of exactly one Lite BU. The request carries
    the target plan's setup fee; approval (after the payment) changes the plan. Returns status,
    reference, plan_code and bu_name."""
    email = (payload.get("email") or "").strip().lower()
    plan_code = payload.get("plan_code")
    if plan_code not in UPGRADE_PLAN_CODES:
        raise SignupException(message=AppMessages.PLAN_CHANGE_INVALID, code="VALIDATION_ERROR")
    client = await get_default_customer_client()
    db_name = client["db_name"]

    users = await exec_sql(db_name, "security", SignupServerSql.GET_LT_SIGNUP_EXISTING_USER, {"email": email})
    user = users[0] if users else None
    if not user or user["is_admin"] or not user["is_active"]:
        raise SignupException(message=AppMessages.UPGRADE_NO_LITE, code="UPGRADE_NO_LITE")
    managed = await exec_sql(db_name, "security", SignupServerSql.GET_LT_MANAGED_BUS, {"email": email})
    lites = [bu for bu in managed if bu["plan_code"] == "lite"]
    if not lites:
        raise SignupException(message=AppMessages.UPGRADE_NO_LITE, code="UPGRADE_NO_LITE")
    if len(lites) > 1:
        raise SignupException(message=AppMessages.UPGRADE_SEVERAL_LITE, code="UPGRADE_SEVERAL_LITE")
    bu = lites[0]
    if await exec_sql(db_name, "security", SignupServerSql.CHECK_LT_SIGNUP_PENDING, {"email": email}):
        raise SignupException(message=AppMessages.SIGNUP_PENDING_EXISTS, code="SIGNUP_PENDING_EXISTS")

    price = get_plan_price(plan_code)
    enquiry = {
        "bu_code": bu["code"],
        "bu_name": bu["name"],
        "email": email,
        "existing_user_id": user["id"],
        "ip": ip,
        "kind": "upgrade",
        "mobile": user["mobile"] or "",
        "monthly_fee_paise": price.monthly_fee_paise,
        "name": user["full_name"],
        "payment_status": "pending" if price.setup_fee_paise else "not_required",
        "plan_code": plan_code,
        "setup_fee_paise": price.setup_fee_paise,
        "upgrade_bu_id": bu["id"],
    }
    for attempt in range(1, INSERT_ATTEMPTS + 1):
        enquiry["reference"] = make_reference()
        try:
            await exec_sql(db_name, "security", SignupServerSql.INSERT_LT_UPGRADE, enquiry)
            break
        except psycopg.errors.UniqueViolation as e:
            if e.diag.constraint_name == _PENDING_EMAIL_INDEX:
                raise SignupException(message=AppMessages.SIGNUP_PENDING_EXISTS, code="SIGNUP_PENDING_EXISTS") from e
            if attempt == INSERT_ATTEMPTS:
                raise

    pending = await exec_sql(db_name, "security", SignupServerSql.GET_LT_PENDING_COUNT)
    await publish_sales_enquiry_count(db_name, "LT", pending[0]["pending"])

    subject, text = upgrade_thank_you_email(enquiry)
    await send_text_email(email, subject, text)
    await _send_approver_emails(db_name, enquiry)
    return {"bu_name": bu["name"], "plan_code": plan_code, "reference": enquiry["reference"], "status": "pending"}


async def get_lt_signup_status(mobile: str, email: str) -> dict:
    """A Lite / Basic / Standard request's status: mobile and email must match the same
    request. Returns status and plan, plus the rejection reason or, once approved, the
    login email and the client to pick at login."""
    client = await get_default_customer_client()
    rows = await exec_sql(
        client["db_name"], "security", SignupServerSql.GET_LT_SIGNUP_STATUS,
        {"email": email.strip().lower(), "mobile": mobile},
    )
    if not rows:
        raise SignupException(message=AppMessages.SIGNUP_NOT_FOUND, code="NOT_FOUND")
    row = rows[0]
    result = {"plan_code": row["plan_code"], "status": row["status"]}
    if row["status"] == "rejected":
        result["rejection_reason"] = row["rejection_reason"]
    if row["status"] == "approved":
        result["client_name"] = client["name"]
        result["login_email"] = row["email"]
        result["existing_login"] = row["existing_user_id"] is not None
    return result


async def submit_enterprise_enquiry(payload: dict, ip: str | None, notify: Callable[[dict, list[str]], Awaitable[None]]) -> dict:
    """Save an Enterprise enquiry in the control plane, publish the new-enquiry count,
    send the team notice (through `notify`, given the recipients) and the thank-you."""
    data = _normalise(payload)
    if data["plan_code"] != "enterprise":
        raise SignupException(message=AppMessages.SIGNUP_WRONG_ENDPOINT, code="SIGNUP_WRONG_ENDPOINT")

    price = get_plan_price("enterprise")
    enquiry = {**data, "ip": ip, "monthly_fee_paise": price.monthly_fee_paise, "setup_fee_paise": price.setup_fee_paise}
    for attempt in range(1, INSERT_ATTEMPTS + 1):
        enquiry["reference"] = make_reference()
        try:
            await exec_sql(None, "public", SignupServerSql.INSERT_ENT_ENQUIRY, enquiry)
            break
        except psycopg.errors.UniqueViolation:
            if attempt == INSERT_ATTEMPTS:
                raise

    pending = await exec_sql(None, "public", SignupServerSql.GET_ENT_NEW_COUNT)
    await publish_sales_enquiry_count(settings.client_db_name, "ENT", pending[0]["pending"])

    recipients = sorted({e.strip().lower() for e in (settings.contact_notify_email, get_enterprise_enquiry_notify_email()) if e})
    await notify(enquiry, recipients)
    subject, text = thank_you_email(enquiry)
    await send_text_email(enquiry["email"], subject, text)

    return {"reference": enquiry["reference"], "status": "ok"}
