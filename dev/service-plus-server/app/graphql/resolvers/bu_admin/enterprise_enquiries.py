"""Super Admin → Enquiries: Enterprise enquiries (plans/plan.md Step 10). Every resolver
runs against the control plane (service_plus_client.public.sales_enquiry) and is guarded
by require_user_type {"S"} in mutation.py.

Provisioning a customer — client row, database, first BU, admin user — is claimed and
resumable like a sign-up approval (constraint 3): each finished part is stored on the
enquiry row, a failure releases the claim and the next click resumes.
"""

import re
from typing import Any

import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.core.audit_log import AuditAction, audit_logger
from app.core.exceptions import AppMessages, CodedValidationException, ValidationException
from app.core.plan_prices import PAISE_PER_RUPEE
from app.db.connection.psycopg_driver import exec_sql, exec_sql_dml, get_client_db_connection
from app.db.sql.sql_base import SqlStore
from app.db.sql.sql_signups import SignupServerSql
from app.config import settings
from app.graphql.pubsub import publish_sales_enquiry_count
from app.graphql.resolvers.bu_admin.provisioning import resolve_create_service_db_helper
from app.graphql.resolvers.bu_admin.signups import (
    _encode,
    build_bu_schema,
    check_new_bu,
    parse_payment,
    set_bu_plan,
    set_head_office_city_gstin,
)
from app.graphql.resolvers.bu_admin.users_roles import resolve_create_admin_user_helper
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.services.signup_emails import rejection_email, send_text_email

ACTOR = "super_admin"
CLIENT_CODE_PATTERN = re.compile(r"^[A-Za-z0-9]{4,20}$")
CLIENT_NAME_PATTERN = re.compile(r"^[A-Za-z0-9\s\-_.,]{6,100}$")
DB_NAME_PATTERN = re.compile(r"^service_plus_[a-z0-9_]+$")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9]{5,}$")
OPEN_STATUSES = ("new", "contacted")


def _invalid(message: str, **extensions: Any) -> ValidationException:
    return ValidationException(message=message, extensions=extensions or None)


async def _get_enquiry(enquiry_id: Any) -> dict:
    rows = await exec_sql(None, "public", SignupServerSql.GET_ENT_ENQUIRY, {"id": enquiry_id})
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_NOT_FOUND)
    return rows[0]


async def _publish_new_count() -> None:
    rows = await exec_sql(None, "public", SignupServerSql.GET_ENT_NEW_COUNT)
    await publish_sales_enquiry_count(settings.client_db_name, "ENT", rows[0]["pending"])


async def _audit(action: str, enquiry: dict, detail: str | None = None) -> None:
    await audit_logger.log(
        action=action,
        detail=detail,
        resource_id=str(enquiry["id"]),
        resource_name=enquiry.get("reference"),
        resource_type="sales_enquiry",
    )


# ── Simple actions ────────────────────────────────────────────────────────────


async def resolve_mark_enterprise_enquiry_contacted_helper(value: str) -> dict:
    """new → contacted. Value: { id }"""
    payload = _decode_value(value, "markEnterpriseEnquiryContacted")
    enquiry = await _get_enquiry(payload.get("id"))
    rows = await exec_sql(None, "public", SignupServerSql.MARK_ENT_CONTACTED, {"by": ACTOR, "id": enquiry["id"]})
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_CONTACT_NOT_ALLOWED)
    await _audit(AuditAction.CONTACT_ENTERPRISE_ENQUIRY, enquiry)
    await _publish_new_count()
    return {"id": enquiry["id"], "status": "contacted"}


async def resolve_set_enterprise_enquiry_fee_helper(value: str) -> dict:
    """Set the negotiated setup fee while the payment is outstanding. Value: { id, setup_fee (rupees) }"""
    payload = _decode_value(value, "setEnterpriseEnquiryFee")
    try:
        fee_paise = round(float(payload.get("setup_fee")) * PAISE_PER_RUPEE)
    except (TypeError, ValueError) as e:
        raise _invalid(AppMessages.INVALID_INPUT, field="setup_fee") from e
    if fee_paise < 0:
        raise _invalid(AppMessages.INVALID_INPUT, field="setup_fee")
    enquiry = await _get_enquiry(payload.get("id"))
    rows = await exec_sql(
        None, "public", SignupServerSql.SET_ENT_FEE, {"id": enquiry["id"], "setup_fee_paise": fee_paise}
    )
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_FEE_NOT_ALLOWED)
    await _audit(AuditAction.SET_ENTERPRISE_ENQUIRY_FEE, enquiry, f"{fee_paise / PAISE_PER_RUPEE:.2f}")
    return {"id": enquiry["id"], "setup_fee_paise": fee_paise}


async def resolve_record_enterprise_enquiry_payment_helper(value: str) -> dict:
    """Record the setup payment. Value: { id, amount (rupees), mode, reference, received_on, note? }"""
    payload = _decode_value(value, "recordEnterpriseEnquiryPayment")
    enquiry = await _get_enquiry(payload.get("id"))
    if enquiry["status"] not in OPEN_STATUSES or enquiry["payment_status"] not in ("pending", "failed"):
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_NOT_ALLOWED)
    payment = parse_payment(payload, enquiry["setup_fee_paise"])
    rows = await exec_sql(None, "public", SignupServerSql.RECORD_ENT_PAYMENT, {**payment, "by": ACTOR, "id": enquiry["id"]})
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_NOT_ALLOWED)
    await _audit(
        AuditAction.RECORD_ENQUIRY_PAYMENT,
        enquiry,
        f"{payment['amount_paise'] / PAISE_PER_RUPEE:.2f} {payment['mode']} {payment['reference']}",
    )
    return {"id": enquiry["id"], "payment_status": "received"}


async def resolve_mark_enterprise_enquiry_payment_failed_helper(value: str) -> dict:
    """Mark the setup payment failed, with a note. Value: { id, note }"""
    payload = _decode_value(value, "markEnterpriseEnquiryPaymentFailed")
    note = (payload.get("note") or "").strip()
    if not note:
        raise _invalid(AppMessages.ENQUIRY_NOTE_REQUIRED, field="note")
    enquiry = await _get_enquiry(payload.get("id"))
    rows = await exec_sql(
        None, "public", SignupServerSql.MARK_ENT_PAYMENT_FAILED, {"by": ACTOR, "id": enquiry["id"], "note": note}
    )
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_PAYMENT_NOT_ALLOWED)
    await _audit(AuditAction.FAIL_ENQUIRY_PAYMENT, enquiry, note)
    return {"id": enquiry["id"], "payment_status": "failed"}


async def resolve_reject_enterprise_enquiry_helper(value: str) -> dict:
    """Reject an open enquiry that has no client yet; email the applicant. Value: { id, reason }"""
    payload = _decode_value(value, "rejectEnterpriseEnquiry")
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise _invalid(AppMessages.ENQUIRY_REASON_REQUIRED, field="reason")
    rows = await exec_sql(
        None, "public", SignupServerSql.REJECT_ENT_ENQUIRY, {"by": ACTOR, "id": payload.get("id"), "reason": reason}
    )
    if not rows:
        raise _invalid(AppMessages.ENQUIRY_REJECT_NOT_ALLOWED)
    enquiry = rows[0]
    if enquiry.get("reference"):
        subject, text = rejection_email(enquiry, reason)
        await send_text_email(enquiry["email"], subject, text)
    await _audit(AuditAction.REJECT_SALES_ENQUIRY, enquiry, reason)
    await _publish_new_count()
    return {"id": enquiry["id"], "status": "rejected"}


# ── Provisioning ──────────────────────────────────────────────────────────────


async def _create_client(enquiry: dict, code: str, name: str) -> int:
    """Step 2: the client row and the enquiry's client_id in one transaction (both control plane)."""
    if not CLIENT_CODE_PATTERN.match(code):
        raise _invalid(AppMessages.INVALID_CLIENT_CODE, field="client_code")
    if not CLIENT_NAME_PATTERN.match(name):
        raise _invalid(AppMessages.INVALID_CLIENT_NAME, field="client_name")
    rows = await exec_sql(None, "public", SqlStore.CHECK_CLIENT_CODE_EXISTS, {"code": code})
    if rows and rows[0]["exists"]:
        raise _invalid(AppMessages.CLIENT_CODE_EXISTS, field="client_code")
    rows = await exec_sql(None, "public", SqlStore.CHECK_CLIENT_NAME_EXISTS, {"name": name})
    if rows and rows[0]["exists"]:
        raise _invalid(AppMessages.CLIENT_NAME_EXISTS, field="client_name")
    async with get_client_db_connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("SET search_path TO public")
            await cur.execute(
                SignupServerSql.INSERT_ENT_CLIENT,
                {
                    "city": enquiry["city"],
                    "code": code,
                    "email": enquiry["email"],
                    "gstin": enquiry["gstin"],
                    "name": name,
                    "phone": enquiry["mobile"],
                },
            )
            client_id = (await cur.fetchone())["id"]
            await cur.execute(SignupServerSql.SET_ENT_CLIENT, {"client_id": client_id, "id": enquiry["id"]})
    return client_id


async def _has_security_schema(db_name: str) -> bool:
    rows = await exec_sql(db_name, "security", SqlStore.CHECK_SCHEMA_EXISTS, {"code": "security"})
    return bool(rows and rows[0]["exists"])


async def _ensure_database(client: dict, wanted_db_name: str) -> str:
    """Step 3. A client that already names its database keeps it when the database has its
    security schema; a database of that name without one is a half-built leftover, dropped
    and created again. A new name is stored on the client before the database is created,
    so a failure part-way leaves a leftover the next run recognises as this client's."""
    db_name = client["db_name"] or wanted_db_name
    if not DB_NAME_PATTERN.match(db_name or ""):
        raise _invalid(AppMessages.INVALID_DB_NAME, field="db_name")
    rows = await exec_sql(None, "public", SqlStore.CHECK_DB_NAME_EXISTS, {"db_name": db_name})
    exists = bool(rows and rows[0]["exists"])
    if not client["db_name"]:
        used = await exec_sql(None, "public", SignupServerSql.CHECK_DB_NAME_USED, {"db_name": db_name})
        if exists or used:
            # Someone else's database (another client's, or an orphan): never touched here.
            raise _invalid(AppMessages.CLIENT_DB_NAME_EXISTS, field="db_name")
        await exec_sql(None, "public", SqlStore.UPDATE_CLIENT_DB_NAME, {"db_name": db_name, "id": client["id"]})
    elif exists:
        if await _has_security_schema(db_name):
            return db_name
        await exec_sql_dml(None, "public", pgsql.SQL("DROP DATABASE {}").format(pgsql.Identifier(db_name)))
    await resolve_create_service_db_helper(
        None, "public", _encode({"client_id": client["id"], "new_db_name": db_name})
    )
    return db_name


async def resolve_provision_enterprise_enquiry_helper(info, value: str) -> dict:
    """Create the customer of a paid Enterprise enquiry: client, database, first BU, admin.
    Value: { id, client_code, client_name, db_name, bu_code, bu_name, username }"""
    # pylint: disable=too-many-locals,too-many-statements
    payload = _decode_value(value, "provisionEnterpriseEnquiry")
    claimed = await exec_sql(None, "public", SignupServerSql.CLAIM_ENT_ENQUIRY, {"id": payload.get("id")})
    if not claimed:
        enquiry = await _get_enquiry(payload.get("id"))
        raise _invalid(
            AppMessages.ENQUIRY_NOT_PENDING if enquiry["status"] not in OPEN_STATUSES else AppMessages.ENQUIRY_BUSY
        )
    enquiry = claimed[0]
    enquiry_id = enquiry["id"]

    try:
        # 1. Payment gate.
        if enquiry["payment_status"] != "received":
            raise CodedValidationException(message=AppMessages.PAYMENT_NOT_RECEIVED, code="PAYMENT_NOT_RECEIVED")

        # 2. Client.
        client_id = enquiry["client_id"] or await _create_client(
            enquiry, (payload.get("client_code") or "").strip(), (payload.get("client_name") or "").strip()
        )
        client = (await exec_sql(None, "public", SignupServerSql.GET_CLIENT_BY_ID, {"id": client_id}))[0]

        # 3. Database.
        db_name = await _ensure_database(client, (payload.get("db_name") or "").strip())

        # 4. First BU. The BU row lives in the new database, so it cannot share a transaction
        # with the enquiry; a resumed run finds it by code (the new database holds only it).
        bu_code = (payload.get("bu_code") or "").strip().lower()
        bu_id = enquiry["bu_id"]
        if not bu_id:
            found = await exec_sql(db_name, "security", SignupServerSql.GET_BU_BY_CODE, {"code": bu_code})
            if found:
                bu_id = found[0]["id"]
            else:
                bu_name = (payload.get("bu_name") or "").strip()
                await check_new_bu(db_name, bu_code, bu_name)
                rows = await exec_sql(db_name, "security", SqlStore.INSERT_BU, {"code": bu_code, "name": bu_name})
                bu_id = rows[0]["id"]
            await exec_sql(None, "public", SignupServerSql.SET_ENT_BU, {"bu_id": bu_id, "id": enquiry_id})
        bu = (await exec_sql(db_name, "security", SignupServerSql.GET_BU_BY_ID, {"id": bu_id}))[0]
        if not enquiry["bu_schema_ready_at"]:
            await build_bu_schema(db_name, bu)
            await exec_sql(None, "public", SignupServerSql.SET_ENT_SCHEMA_READY, {"id": enquiry_id})
        await set_bu_plan(db_name, bu_id, "enterprise")

        # 5. Head office, then the admin user.
        await set_head_office_city_gstin(db_name, bu["code"], enquiry["city"], enquiry["gstin"])
        user_id = enquiry["user_id"]
        login_email_sent = enquiry["login_email_sent"]
        if not user_id:
            username = (payload.get("username") or "").strip()
            if not USERNAME_PATTERN.match(username):
                raise _invalid(AppMessages.INVALID_USERNAME, field="username")
            created = await resolve_create_admin_user_helper(
                db_name,
                "security",
                _encode(
                    {
                        "client_id": client_id,
                        "email": enquiry["email"],
                        "full_name": enquiry["name"],
                        "mobile": enquiry["mobile"],
                        "username": username,
                    }
                ),
                request=(info.context or {}).get("request"),
            )
            user_id = created["id"]
            login_email_sent = bool(created.get("email_sent"))
            await exec_sql(
                None,
                "public",
                SignupServerSql.SET_ENT_USER,
                {"id": enquiry_id, "login_email_sent": login_email_sent, "user_id": user_id},
            )

        # 6. Converted.
        await exec_sql(None, "public", SignupServerSql.FINISH_ENT_PROVISIONING, {"by": ACTOR, "id": enquiry_id})
    except Exception:
        await exec_sql(None, "public", SignupServerSql.RELEASE_ENT_CLAIM, {"id": enquiry_id})
        raise

    await _audit(AuditAction.PROVISION_ENTERPRISE, enquiry, f"client={client['code']} db={db_name} bu={bu['code']}")
    await _publish_new_count()
    return {
        "bu_code": bu["code"],
        "client_id": client_id,
        "db_name": db_name,
        "id": enquiry_id,
        "login_email_sent": login_email_sent,
        "status": "converted",
        "user_id": user_id,
    }
