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
from app.services.signup_emails import approver_email, send_text_email, thank_you_email

LT_PLAN_CODES = ("lite", "basic", "standard")
ONE_BRANCH_PLAN_CODES = ("lite", "basic")

# BU codes must match ^[a-z0-9_]{3,30}$; the base is cut to 26 so "_NN" still fits.
BU_CODE_BASE_MAX = 26
BU_CODE_MAX_SUFFIX = 99
RESERVED_BU_CODES = frozenset({"demo1", "information_schema", "public", "security"})

# No 0/O or 1/I, so a reference read out over the phone is unambiguous.
_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INSERT_ATTEMPTS = 3

# Unique indexes of security.sales_enquiry whose clash means "this person already applied".
_DUPLICATE_INDEXES = frozenset({"sales_enquiry_open_email_key", "sales_enquiry_open_mobile_key"})


class SignupException(ServicePlusException):
    """A sign-up refused for a reason the applicant should see; `code` picks the HTTP status."""


def make_reference() -> str:
    """A random public reference such as 'SP-7K3M9QX2'."""
    return "SP-" + "".join(secrets.choice(_REFERENCE_ALPHABET) for _ in range(8))


def bu_code_base(business_name: str) -> str:
    """The BU code a business name starts from, before clash suffixes: lower-case, other
    characters to '_', trimmed, cut to 26; short codes padded with 'bu'; 'bu_' in front
    of one starting with 'pg_' or a digit."""
    code = re.sub(r"[^a-z0-9]+", "_", business_name.lower()).strip("_")[:BU_CODE_BASE_MAX].strip("_")
    if len(code) < 3:
        code = f"bu_{code}" if code else "bu_new"
    if code.startswith("pg_") or code[0].isdigit():
        code = f"bu_{code}"[:BU_CODE_BASE_MAX].rstrip("_")
    return code


async def derive_bu_code(business_name: str, is_taken: Callable[[str], Awaitable[bool]]) -> str:
    """bu_code_base, then '_2', '_3', … while the code is reserved or `is_taken` says so.
    Shared with sign-up approval (Steps 9 and 10), which pass their own `is_taken`."""
    base = bu_code_base(business_name)
    for n in range(1, BU_CODE_MAX_SUFFIX + 1):
        code = base if n == 1 else f"{base}_{n}"
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


async def submit_lt_signup(payload: dict, ip: str | None) -> dict:
    """Save a Lite / Basic / Standard sign-up in the default customer database, publish
    the pending count, email the applicant and the approvers. Returns status and reference."""
    data = _normalise(payload)
    if data["plan_code"] not in LT_PLAN_CODES:
        raise SignupException(message=AppMessages.SIGNUP_WRONG_ENDPOINT, code="SIGNUP_WRONG_ENDPOINT")

    client = await get_default_customer_client()  # raises DEFAULT_DB_NOT_CONFIGURED; nothing written
    db_name = client["db_name"]

    if not BU_NAME_PATTERN.match(data["business_name"]):
        raise SignupException(message=AppMessages.BU_NAME_FORMAT, code="VALIDATION_ERROR")
    if data["plan_code"] in ONE_BRANCH_PLAN_CODES and data["branches"] != 1:
        raise SignupException(message=AppMessages.SIGNUP_BRANCHES_ONE, code="VALIDATION_ERROR")

    duplicate = await exec_sql(
        db_name, "security", SignupServerSql.CHECK_LT_SIGNUP_DUPLICATE,
        {"email": data["email"], "mobile": data["mobile"]},
    )
    if duplicate:
        raise SignupException(message=AppMessages.SIGNUP_DUPLICATE, code="SIGNUP_DUPLICATE")

    price = get_plan_price(data["plan_code"])

    async def code_taken(code: str) -> bool:
        rows = await exec_sql(db_name, "security", SignupServerSql.CHECK_LT_BU_CODE_TAKEN, {"code": code})
        return bool(rows[0]["taken"])

    enquiry = {
        **data,
        "bu_name": await _bu_name(db_name, data["business_name"], data["city"]),
        "ip": ip,
        "monthly_fee_paise": price.monthly_fee_paise,
        "payment_status": "pending" if price.setup_fee_paise else "not_required",
        "setup_fee_paise": price.setup_fee_paise,
    }
    for attempt in range(1, INSERT_ATTEMPTS + 1):
        enquiry["bu_code"] = await derive_bu_code(data["business_name"], code_taken)
        enquiry["reference"] = make_reference()
        try:
            await exec_sql(db_name, "security", SignupServerSql.INSERT_LT_ENQUIRY, enquiry)
            break
        except psycopg.errors.UniqueViolation as e:
            if e.diag.constraint_name in _DUPLICATE_INDEXES:
                raise SignupException(message=AppMessages.SIGNUP_DUPLICATE, code="SIGNUP_DUPLICATE") from e
            # A reference or BU code taken a moment ago by another sign-up: try new ones.
            logger.info("Sign-up insert clash on %s (attempt %s)", e.diag.constraint_name, attempt)
            if attempt == INSERT_ATTEMPTS:
                raise

    pending = await exec_sql(db_name, "security", SignupServerSql.GET_LT_PENDING_COUNT)
    await publish_sales_enquiry_count(db_name, "LT", pending[0]["pending"])

    subject, text = thank_you_email(enquiry)
    await send_text_email(enquiry["email"], subject, text)
    await _send_approver_emails(db_name, enquiry)

    return {"reference": enquiry["reference"], "status": "pending"}


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
