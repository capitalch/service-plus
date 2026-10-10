"""Admin → Enquiries: setup payment, approval and rejection of Lite / Basic / Standard
sign-ups (plans/plan.md Step 9). Every resolver runs in the default customer database
and is guarded by require_own_tenant + require_user_type {"A"} + require_default_customer_db
in mutation.py.

Approval cannot be one transaction (BU DDL runs on several connections and the user step
emails), so it is resumable (constraint 3): each finished part is recorded on the
enquiry row, the row is claimed with a timestamp so two clicks provision once, and a
failure releases the claim so the next click resumes where it stopped.
"""

import json
import re
from datetime import date
from typing import Any
from urllib.parse import quote

import psycopg
import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.core.audit_log import AuditAction, audit_logger
from app.core.exceptions import AppMessages, CodedValidationException, ValidationException
from app.core.plan_prices import PAISE_PER_RUPEE, get_plan_price
from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection
from app.db.sql.sql_base import SqlStore
from app.db.sql.sql_signups import SignupServerSql
from app.graphql.pubsub import publish_sales_enquiry_count
from app.graphql.resolvers.bu_admin.provisioning import (
    BU_NAME_PATTERN,
    resolve_create_bu_schema_and_feed_seed_data_helper,
)
from app.graphql.resolvers.bu_admin.users_roles import resolve_create_business_user_helper
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.services.bu_billing import clear_bu_billing
from app.services.default_customer import get_default_customer_client
from app.services.signup_emails import rejection_email, send_text_email
from app.services.signups import RESERVED_BU_CODES

BU_CODE_PATTERN = re.compile(r"^[a-z0-9_]{3,30}$")
PAYMENT_MODES = frozenset({"bank_transfer", "cash", "other", "upi"})
MANAGER_ROLE_CODE = "MANAGER"
# Plans limited to the head office branch (plans/plan.md, Goal).
ONE_BRANCH_PLAN_CODES = frozenset({"basic", "lite", "standard"})
MOBILE_PATTERN = re.compile(r"^[6-9]\d{9}$")
USERNAME_MAX_SUFFIX = 99
USERNAME_MIN_LENGTH = 5


def _invalid(message: str, **extensions: Any) -> ValidationException:
    return ValidationException(message=message, extensions=extensions or None)


def _encode(payload: dict) -> str:
    """The URL-encoded JSON `value` the shared helpers decode."""
    return quote(json.dumps(payload))


async def actor_username(info, db_name: str) -> str:
    """The acting admin's username for *_by columns; 'super_admin' for userType S."""
    context = info.context or {}
    if context.get("user_type") == "S":
        return "super_admin"
    rows = await exec_sql(db_name, "security", SignupServerSql.GET_USERNAME, {"id": context.get("user_id")})
    return rows[0]["username"] if rows else str(context.get("user_id"))


def parse_payment(payload: dict, setup_fee_paise: int) -> dict:
    """Validate a setup payment from the screen: amount in rupees (at least the setup fee),
    mode, reference, a received-on date not in the future, optional note. Shared with the
    Enterprise screen (Step 10)."""
    try:
        amount_paise = round(float(payload.get("amount")) * PAISE_PER_RUPEE)
    except (TypeError, ValueError) as e:
        raise _invalid(AppMessages.INVALID_INPUT, field="amount") from e
    if amount_paise < setup_fee_paise:
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_AMOUNT_LOW, field="amount")
    mode = payload.get("mode")
    if mode not in PAYMENT_MODES:
        raise _invalid(AppMessages.INVALID_INPUT, field="mode")
    reference = (payload.get("reference") or "").strip()
    if not reference:
        raise _invalid(AppMessages.REQUIRED_FIELD_MISSING, field="reference")
    try:
        received_on = date.fromisoformat(str(payload.get("received_on")))
    except ValueError as e:
        raise _invalid(AppMessages.INVALID_DATE_FORMAT, field="received_on") from e
    if received_on > date.today():
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_DATE_FUTURE, field="received_on")
    return {
        "amount_paise": amount_paise,
        "mode": mode,
        "note": (payload.get("note") or "").strip() or None,
        "received_on": received_on,
        "reference": reference,
    }


async def _get_enquiry(db_name: str, enquiry_id: Any) -> dict:
    rows = await exec_sql(db_name, "security", SignupServerSql.GET_LT_ENQUIRY, {"id": enquiry_id})
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_NOT_FOUND)
    return rows[0]


async def _publish_pending_count(db_name: str) -> None:
    rows = await exec_sql(db_name, "security", SignupServerSql.GET_LT_PENDING_COUNT)
    await publish_sales_enquiry_count(db_name, "LT", rows[0]["pending"])


# ── Setup payment ─────────────────────────────────────────────────────────────


async def resolve_record_sales_enquiry_payment_helper(info, db_name: str, value: str) -> dict:
    """Record the one-time setup payment of a pending Basic / Standard request. Creates nothing.
    Value: { id, amount (rupees), mode, reference, received_on (YYYY-MM-DD), note? }"""
    payload = _decode_value(value, "recordSalesEnquiryPayment")
    enquiry = await _get_enquiry(db_name, payload.get("id"))
    if (
        enquiry["status"] != "pending"
        or enquiry["plan_code"] not in ("basic", "standard")
        or enquiry["payment_status"] not in ("pending", "failed")
    ):
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_NOT_ALLOWED)
    payment = parse_payment(payload, enquiry["setup_fee_paise"])
    by = await actor_username(info, db_name)
    rows = await exec_sql(
        db_name, "security", SignupServerSql.RECORD_LT_PAYMENT, {**payment, "by": by, "id": enquiry["id"]}
    )
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_NOT_ALLOWED)
    await audit_logger.log(
        action=AuditAction.RECORD_ENQUIRY_PAYMENT,
        actor_type="admin",
        actor_username=by,
        detail=f"{payment['amount_paise'] / PAISE_PER_RUPEE:.2f} {payment['mode']} {payment['reference']}",
        resource_id=str(enquiry["id"]),
        resource_name=enquiry["reference"],
        resource_type="sales_enquiry",
    )
    return {"id": enquiry["id"], "payment_status": "received"}


async def resolve_mark_sales_enquiry_payment_failed_helper(info, db_name: str, value: str) -> dict:
    """Mark a pending Basic / Standard request's setup payment as failed, with a note. It can
    later still be paid or rejected. Value: { id, note }"""
    payload = _decode_value(value, "markSalesEnquiryPaymentFailed")
    note = (payload.get("note") or "").strip()
    if not note:
        raise _invalid(AppMessages.ENQUIRY_NOTE_REQUIRED, field="note")
    enquiry = await _get_enquiry(db_name, payload.get("id"))
    by = await actor_username(info, db_name)
    rows = await exec_sql(
        db_name, "security", SignupServerSql.MARK_LT_PAYMENT_FAILED, {"by": by, "id": enquiry["id"], "note": note}
    )
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_NOT_ALLOWED)
    await audit_logger.log(
        action=AuditAction.FAIL_ENQUIRY_PAYMENT,
        actor_type="admin",
        actor_username=by,
        detail=note,
        resource_id=str(enquiry["id"]),
        resource_name=enquiry["reference"],
        resource_type="sales_enquiry",
    )
    return {"id": enquiry["id"], "payment_status": "failed"}


# ── Approval ──────────────────────────────────────────────────────────────────


async def _schema_exists(db_name: str, code: str) -> bool:
    rows = await exec_sql(db_name, "security", SqlStore.CHECK_SCHEMA_EXISTS, {"code": code})
    return bool(rows and rows[0]["exists"])


async def check_new_bu(db_name: str, code: str, name: str) -> None:
    """A new BU's code and name: format, not reserved, not used by a BU or a schema. Shared
    with Enterprise provisioning (Step 10)."""
    if not BU_CODE_PATTERN.match(code) or code in RESERVED_BU_CODES or code.startswith("pg_"):
        raise _invalid(AppMessages.INVALID_BU_CODE, field="bu_code")
    if not BU_NAME_PATTERN.match(name):
        raise _invalid(AppMessages.BU_NAME_FORMAT, field="bu_name")
    rows = await exec_sql(db_name, "security", SqlStore.CHECK_BU_CODE_EXISTS, {"code": code})
    if (rows and rows[0]["exists"]) or await _schema_exists(db_name, code):
        raise _invalid(AppMessages.BU_CODE_EXISTS, field="bu_code")
    rows = await exec_sql(db_name, "security", SqlStore.CHECK_BU_NAME_EXISTS, {"name": name})
    if rows and rows[0]["exists"]:
        raise _invalid(AppMessages.BU_NAME_EXISTS, field="bu_name")


async def build_bu_schema(db_name: str, bu: dict) -> None:
    """Create (or rebuild) the schema of a BU row that exists but whose schema was never
    finished. A schema with the BU's code is a half-built leftover — no user exists yet —
    so it is dropped first, only after confirming it carries exactly that BU's code.
    Shared with Enterprise provisioning (Step 10)."""
    code = bu["code"]
    if not BU_CODE_PATTERN.match(code):
        raise _invalid(AppMessages.INVALID_BU_CODE, field="bu_code")
    if await _schema_exists(db_name, code):
        logger.warning("Dropping half-built schema '%s' in %s before rebuilding it", code, db_name)
        await exec_sql(
            db_name, "security", pgsql.SQL("DROP SCHEMA {} CASCADE").format(pgsql.Identifier(code))
        )
    await resolve_create_bu_schema_and_feed_seed_data_helper(
        db_name, "security", _encode({"code": code, "id": bu["id"], "name": bu["name"]})
    )


async def set_bu_plan(db_name: str, bu_id: int, plan_code: str, monthly_fee_paise: int | None = None) -> None:
    """Stamp the plan fields on a new BU: branch limit, billing, fee; paid_through empty."""
    await exec_sql(
        db_name,
        "security",
        SignupServerSql.SET_BU_PLAN,
        {
            "billing_required": plan_code != "lite",
            "branch_limit": 1 if plan_code in ONE_BRANCH_PLAN_CODES else None,
            "bu_id": bu_id,
            "monthly_fee_paise": (
                get_plan_price(plan_code).monthly_fee_paise if monthly_fee_paise is None else monthly_fee_paise
            ),
            "plan_code": plan_code,
        },
    )
    clear_bu_billing(db_name)


async def set_head_office_city_gstin(db_name: str, schema: str, city: str, gstin: str | None) -> None:
    """The applicant's city (and GSTIN) on the new BU's HO branch and its Main division."""
    args = {"city": city, "gstin": gstin or None}
    await exec_sql(db_name, schema, SignupServerSql.SET_HEAD_OFFICE_CITY_GSTIN, args)
    await exec_sql(db_name, schema, SignupServerSql.SET_MAIN_DIVISION_CITY_GSTIN, args)


# Email local parts that name a mailbox, not a person; never used as a username.
GENERIC_EMAIL_NAMES = frozenset(
    {
        "account", "accounts", "admin", "administrator", "billing", "contact", "enquiry", "hello", "help",
        "info", "mail", "office", "sales", "service", "support", "team",
    }
)
NAME_TITLES = frozenset({"dr", "mr", "mrs", "ms", "shri", "smt"})
USERNAME_MAX_LENGTH = 20


def default_username(name: str, email: str) -> str:
    """The username offered to a new Manager: the applicant's name as letters and digits
    ("Asha Roy" -> asharoy), without a leading title. When that is under 5 characters, the
    email's local part if it names a person; otherwise the short name (free_username pads
    it). The approver can still edit it, and it cannot be changed after the user exists.
    Keep in step with baseUsername in approve-enquiry-dialog.tsx."""
    words = [w for w in re.sub(r"[^a-z0-9]+", " ", name.lower()).split() if w]
    while len(words) > 1 and words[0] in NAME_TITLES:
        words.pop(0)
    from_name = "".join(words)[:USERNAME_MAX_LENGTH]
    if len(from_name) >= USERNAME_MIN_LENGTH:
        return from_name
    local = re.sub(r"[^a-z0-9]+", "", email.split("@")[0].lower())[:USERNAME_MAX_LENGTH]
    if len(local) >= USERNAME_MIN_LENGTH and local not in GENERIC_EMAIL_NAMES:
        return local
    return from_name or local


async def free_username(db_name: str, wanted: str) -> str:
    """`wanted` made a valid username (letters and digits, at least 5 — the client's rule),
    numbered 2, 3, … while a business user has it."""
    base = re.sub(r"[^a-z0-9]+", "", wanted.lower())
    if len(base) < USERNAME_MIN_LENGTH:
        base = f"{base}user".ljust(USERNAME_MIN_LENGTH, "0")
    for n in range(1, USERNAME_MAX_SUFFIX + 1):
        candidate = base if n == 1 else f"{base}{n}"
        rows = await exec_sql(
            db_name, "security", SqlStore.CHECK_BUSINESS_USER_USERNAME_EXISTS, {"username": candidate}
        )
        if not (rows and rows[0]["exists"]):
            return candidate
    raise _invalid(AppMessages.BUSINESS_USER_USERNAME_EXISTS, field="username")


async def _insert_bu_for_enquiry(db_name: str, enquiry: dict, code: str, name: str) -> int:
    """Step 3: the security.bu row and the enquiry's bu_id in one transaction."""
    async with get_service_db_connection(db_name) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("SET search_path TO security")
            await cur.execute(SqlStore.INSERT_BU, {"code": code, "name": name})
            bu_id = (await cur.fetchone())["id"]
            try:
                await cur.execute(
                    SignupServerSql.SET_LT_BU, {"bu_code": code, "bu_id": bu_id, "bu_name": name, "id": enquiry["id"]}
                )
            except psycopg.errors.UniqueViolation as e:  # another open request holds this code
                raise _invalid(AppMessages.BU_CODE_EXISTS, field="bu_code") from e
    return bu_id


async def resolve_approve_sales_enquiry_helper(info, db_name: str, value: str) -> dict:
    """Create the BU and its Manager for a pending request, resumably (see module docstring).
    Value: { id, bu_name?, bu_code?, username?, mobile? } — the edits apply only while no BU exists."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "approveSalesEnquiry")
    claimed = await exec_sql(db_name, "security", SignupServerSql.CLAIM_LT_ENQUIRY, {"id": payload.get("id")})
    if not claimed:
        enquiry = await _get_enquiry(db_name, payload.get("id"))
        raise _invalid(AppMessages.ENQUIRY_NOT_PENDING if enquiry["status"] != "pending" else AppMessages.ENQUIRY_BUSY)
    enquiry = claimed[0]
    enquiry_id = enquiry["id"]

    try:
        # 2. Payment gate, before any work.
        if enquiry["payment_status"] not in ("received", "not_required"):
            raise CodedValidationException(message=AppMessages.PAYMENT_NOT_RECEIVED, code="PAYMENT_NOT_RECEIVED")

        # 3. BU row.
        bu_id = enquiry["bu_id"]
        if not bu_id:
            code = (payload.get("bu_code") or enquiry["bu_code"]).strip().lower()
            name = (payload.get("bu_name") or enquiry["bu_name"]).strip()
            await check_new_bu(db_name, code, name)
            bu_id = await _insert_bu_for_enquiry(db_name, enquiry, code, name)
        bu = (await exec_sql(db_name, "security", SignupServerSql.GET_BU_BY_ID, {"id": bu_id}))[0]

        # 4. Schema, only if never finished; once finished it is never touched again.
        if not enquiry["bu_schema_ready_at"]:
            await build_bu_schema(db_name, bu)
            await exec_sql(db_name, "security", SignupServerSql.SET_LT_SCHEMA_READY, {"id": enquiry_id})

        # 5. Plan.  6. Head office.  Both safe to repeat on a resumed approval.
        await set_bu_plan(db_name, bu_id, enquiry["plan_code"])
        await set_head_office_city_gstin(db_name, bu["code"], enquiry["city"], enquiry["gstin"])

        # 7. Manager user, with the sign-up login email.
        user_id = enquiry["user_id"]
        login_email_sent = enquiry["login_email_sent"]
        if not user_id:
            wanted = (payload.get("username") or default_username(enquiry["name"], enquiry["email"])).strip()
            username = await free_username(db_name, wanted)
            # The approver may give the Manager a different mobile than the applicant's (e.g. when
            # the applicant's is already another user's); the sign-up row keeps the original.
            mobile = (payload.get("mobile") or enquiry["mobile"]).strip()
            if not MOBILE_PATTERN.match(mobile):
                raise _invalid(AppMessages.INVALID_MOBILE, field="mobile")
            role = await exec_sql(db_name, "security", SignupServerSql.GET_ROLE_ID_BY_CODE, {"code": MANAGER_ROLE_CODE})
            if not role:
                raise _invalid(AppMessages.RESOURCE_NOT_FOUND, detail="MANAGER role")
            client = await get_default_customer_client()
            created = await resolve_create_business_user_helper(
                db_name,
                "security",
                _encode(
                    {
                        "bu_ids": [bu_id],
                        "email": enquiry["email"],
                        "full_name": enquiry["name"],
                        "mobile": mobile,
                        "role_id": role[0]["id"],
                        "signup_client_name": client["name"],
                        "username": username,
                    }
                ),
                request=(info.context or {}).get("request"),
            )
            user_id = created["id"]
            login_email_sent = bool(created.get("email_sent"))
            await exec_sql(
                db_name,
                "security",
                SignupServerSql.SET_LT_USER,
                {"id": enquiry_id, "login_email_sent": login_email_sent, "user_id": user_id},
            )

        # 8. Finish.
        by = await actor_username(info, db_name)
        await exec_sql(db_name, "security", SignupServerSql.FINISH_LT_APPROVAL, {"by": by, "id": enquiry_id})
    except Exception:
        # Keep every stored id; the next click resumes from the first unfinished part.
        await exec_sql(db_name, "security", SignupServerSql.RELEASE_LT_CLAIM, {"id": enquiry_id})
        raise

    await audit_logger.log(
        action=AuditAction.APPROVE_SALES_ENQUIRY,
        actor_type="admin",
        actor_username=by,
        detail=f"{enquiry['plan_code']} bu={bu['code']} user_id={user_id}",
        resource_id=str(enquiry_id),
        resource_name=enquiry["reference"],
        resource_type="sales_enquiry",
    )
    await _publish_pending_count(db_name)
    return {
        "bu_code": bu["code"],
        "bu_id": bu_id,
        "id": enquiry_id,
        "login_email_sent": login_email_sent,
        "plan_code": enquiry["plan_code"],
        "status": "approved",
        "user_id": user_id,
    }


# ── Rejection ─────────────────────────────────────────────────────────────────


async def resolve_reject_sales_enquiry_helper(info, db_name: str, value: str) -> dict:
    """Reject a pending request that has no BU yet; email the applicant the reason.
    Value: { id, reason }"""
    payload = _decode_value(value, "rejectSalesEnquiry")
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise _invalid(AppMessages.ENQUIRY_REASON_REQUIRED, field="reason")
    by = await actor_username(info, db_name)
    rows = await exec_sql(
        db_name, "security", SignupServerSql.REJECT_LT_ENQUIRY, {"by": by, "id": payload.get("id"), "reason": reason}
    )
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_REJECT_NOT_ALLOWED)
    enquiry = rows[0]
    subject, text = rejection_email(enquiry, reason)
    await send_text_email(enquiry["email"], subject, text)
    await audit_logger.log(
        action=AuditAction.REJECT_SALES_ENQUIRY,
        actor_type="admin",
        actor_username=by,
        detail=reason,
        resource_id=str(enquiry["id"]),
        resource_name=enquiry["reference"],
        resource_type="sales_enquiry",
    )
    await _publish_pending_count(db_name)
    return {"id": enquiry["id"], "status": "rejected"}

