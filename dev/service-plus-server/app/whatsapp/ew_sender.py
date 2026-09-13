"""Extended Warranty — the two WhatsApp sends (plans/plan-ew-final.md §C5.1).

- REMINDER to a customer: template EXTENDED_WARRANTY (Marketing). Sent only when staff
  click Send — there is no automatic sending (D13).
- LEAD_ALERT to the business's own number when a customer taps "I am interested":
  template EXTENDED_WARRANTY_LEAD (Utility).

Every send first claims an ew_message row, then calls Meta, then settles the row
(ACCEPTED + wamid, or FAILED + error). biz_opaque_callback_data carries
[ew_message_id]; the webhook settles later statuses by wamid.

Two switches must both be on to send a reminder: `extended_warranty.enabled` (this
module's settings row) and `whatsapp_notifications.EXTENDED_WARRANTY`. Both fail closed.
"""

import asyncio
from typing import Any

from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import exec_sql, exec_sql_query
from app.db.sql.sql_base import SqlStore
from app.db.sql.sql_extended_warranty import ExtendedWarrantyServerSql, ExtendedWarrantySql
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.whatsapp.client import send_template
from app.whatsapp.mobile import is_valid_mobile, normalize_mobile
from app.whatsapp.sender import (
    _build_biz_opaque_callback_data,
    _is_event_enabled,
    _sanitize,
    _truncate_business_unit,
)
from app.whatsapp.templates import TEMPLATES
from app.whatsapp.token import sign_ew

# The staff alert's warranty line names the band the lead is in.
BAND_LABEL = {
    "D0_7": "0–7 days left",
    "D31_60": "31–60 days left",
    "D61_PLUS": "More than 60 days left",
    "D8_30": "8–30 days left",
    "OVERDUE": "Warranty expired",
}

# Default OFF: a missing row, a partial object or an unmigrated schema all read as "off".
_EW_DEFAULT_SETTINGS: dict[str, Any] = {
    "contact_phone": "",
    "daily_send_cap": 250,
    "enabled": False,
    "notify_email": "",
    "staff_whatsapp_number": "",
    "whatsapp_number": "",
}

# ew_message.status_rank for the states this module writes; the webhook writes the rest.
_RANK = {"ACCEPTED": 1, "FAILED": 9, "PENDING": 0}

# Cap on concurrent Cloud API calls per request — same as sender.py.
_SEND_CONCURRENCY = 5


async def _bu_name(db_name: str, schema: str) -> str:
    rows = await exec_sql_query(
        db_name=db_name, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE, sql_args={"schema": schema}
    )
    return rows[0]["name"] if rows else schema


def _build_lead_alert_params(bu_name: str, row: dict) -> tuple[list[str], list[str]]:
    """The staff alert's five composed lines (template EXTENDED_WARRANTY_LEAD, Part B2).
    Meta templates cannot branch, so every "omit when blank" decision happens here."""
    preferred_label = {"CALL": "Prefers a call", "WHATSAPP": "Prefers WhatsApp"}.get(
        (row.get("preferred_contact") or "").upper(), "No contact preference"
    )
    header_values = [_sanitize(_truncate_business_unit(bu_name))]
    body_values = [
        _sanitize(_join_parts(row.get("full_name"), row.get("mobile"))),
        _sanitize(_join_parts(row.get("brand_name"), row.get("product_label"), row.get("serial_no"))),
        _sanitize(
            _join_parts(
                f"Warranty ends {_format_date(row.get('warranty_end_date'))}",
                f"Bought {_format_date(row['purchase_date'])}" if row.get("purchase_date") else None,
                BAND_LABEL.get(row.get("band") or ""),
            )
        ),
        _sanitize(_join_parts(row.get("address"), row.get("city"), preferred_label)),
        _sanitize(row.get("customer_remarks") or "No remarks"),
    ]
    return header_values, body_values


def _build_reminder_params(bu_name: str, row: dict, settings_row: dict) -> tuple[list[str], list[str]]:
    """header_values, body_values for one reminder (template EXTENDED_WARRANTY, Part B1)."""
    header_values = [_sanitize(_truncate_business_unit(bu_name))]
    body_values = [
        _sanitize(row.get("full_name") or "Customer"),
        _sanitize(row.get("brand_name") or "-"),
        _sanitize(row.get("product_label") or "-"),
        _sanitize(_format_date(row.get("warranty_end_date"))),
        _sanitize(str(settings_row.get("contact_phone") or "-")),
        _sanitize(str(settings_row.get("whatsapp_number") or "-")),
    ]
    return header_values, body_values


def _format_date(value: Any) -> str:
    """'12 Oct 2026' — a spelled month leaves no dd/mm vs mm/dd doubt on a phone."""
    if value is None:
        return "-"
    if isinstance(value, str):
        return value
    return value.strftime("%d %b %Y")


def _join_parts(*parts: Any) -> str:
    """' · '-joined, blanks dropped, '-' when nothing is left. Each template parameter is
    one line (_sanitize strips newlines), so this is the only separator available."""
    kept = [str(p).strip() for p in parts if p is not None and str(p).strip()]
    return " · ".join(kept) if kept else "-"


async def _send_and_settle(
    db_name: str,
    schema: str,
    ew_message_id: int,
    to: str,
    template_key: str,
    header_values: list[str],
    body_values: list[str],
    button_values: list[str],
) -> tuple[bool, str | None]:
    """Call Meta for a claimed ew_message row and settle it: ACCEPTED + wamid, or FAILED +
    error. An exception from the call is settled as FAILED too — a reminder left PENDING
    would block its expiry band for good, since PENDING counts as a live reminder."""
    callback_data = _build_biz_opaque_callback_data(db_name, schema, template_key, [ew_message_id])
    try:
        result = await send_template(
            to, TEMPLATES[template_key], header_values, body_values, callback_data, button_values
        )
        ok, wamid, error = result.ok, result.provider_message_id, result.error_message
    except Exception as e:  # pylint: disable=broad-except
        logger.exception("Extended Warranty send raised for ew_message_id=%s", ew_message_id)
        ok, wamid, error = False, None, str(e) or type(e).__name__

    status = "ACCEPTED" if ok else "FAILED"
    await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=ExtendedWarrantyServerSql.SET_EW_MESSAGE_SENT,
        sql_args={"error": error, "id": ew_message_id, "rank": _RANK[status], "status": status, "wamid": wamid},
    )
    return ok, error


async def _send_one_reminder(
    db_name: str,
    schema: str,
    row: dict,
    branch_id: int,
    bu_name: str,
    settings_row: dict,
    sent_by: int | None,
    sent_by_name: str | None,
) -> dict[str, Any]:
    """One lead, one reminder. Claimed before calling Meta — CLAIM_EW_REMINDER also moves
    New Lead → Message Sent — so two staff clicking Send produce exactly one message."""
    ew_lead_id = row["ew_lead_id"]
    result_base = {"band": row.get("band"), "customer_name": row.get("full_name"), "ew_lead_id": ew_lead_id}

    claimed = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=ExtendedWarrantyServerSql.CLAIM_EW_REMINDER,
        sql_args={"branch_id": branch_id, "ew_lead_id": ew_lead_id, "sent_by": sent_by, "sent_by_name": sent_by_name},
    )
    if not claimed:
        # Sent in this band already, or the lead changed between selection and send.
        return {**result_base, "error": "Already sent in this expiry window", "status": "SKIPPED"}
    ew_message_id = claimed[0]["ew_message_id"]

    header_values, body_values = _build_reminder_params(bu_name, row, settings_row)
    ok, error = await _send_and_settle(
        db_name,
        schema,
        ew_message_id,
        normalize_mobile(row["mobile"]),
        "EXTENDED_WARRANTY",
        header_values,
        body_values,
        [sign_ew(db_name, schema, ew_lead_id, ew_message_id)],
    )
    return {**result_base, "band": claimed[0]["band"], "error": error, "status": "SENT" if ok else "FAILED"}


async def get_ew_settings(db_name: str, schema: str) -> dict[str, Any]:
    """The `extended_warranty` app_setting row merged over defaults, so a missing or partial
    row never raises — it is admin-editable JSON."""
    rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.GET_APP_SETTING_BY_KEY,
        sql_args={"setting_key": "extended_warranty"},
    )
    stored = rows[0]["setting_value"] if rows else None
    merged = dict(_EW_DEFAULT_SETTINGS)
    if isinstance(stored, dict):
        merged.update({k: v for k, v in stored.items() if v is not None})
    return merged


def is_ew_enabled(settings_row: dict[str, Any]) -> bool:
    """`extended_warranty.enabled` — shows the module and permits sending. Strict `is True`:
    a missing key, a non-bool or the string "true" all read as off."""
    return settings_row.get("enabled") is True


async def send_ew_lead_alert(db_name: str, schema: str, ew_lead_id: int) -> str:
    """Send the whole lead to the business's own WhatsApp number. Called after the
    customer's interest has COMMITTED, and by resendEwLeadAlert.

    Never raises: the customer's request must not fail because of Meta, a bad number or a
    timeout. A failure is recorded as a FAILED LEAD_ALERT row so staff can see it and
    re-send. Returns what happened: SENT, FAILED, NO_STAFF_NUMBER, INVALID_STAFF_NUMBER,
    NOT_FOUND or ERROR."""
    try:
        settings_row = await get_ew_settings(db_name, schema)
        staff_number = str(settings_row.get("staff_whatsapp_number") or "").strip()
        if not staff_number:
            return "NO_STAFF_NUMBER"
        if not is_valid_mobile(staff_number):
            await exec_sql(
                db_name=db_name,
                schema=schema,
                sql=ExtendedWarrantyServerSql.CLAIM_EW_LEAD_ALERT,
                sql_args={
                    "error": "staff_whatsapp_number is not a valid mobile number",
                    "ew_lead_id": ew_lead_id,
                    "rank": _RANK["FAILED"],
                    "status": "FAILED",
                },
            )
            return "INVALID_STAFF_NUMBER"

        rows = await exec_sql_query(
            db_name=db_name,
            schema=schema,
            sql=ExtendedWarrantySql.GET_EW_LEAD_DETAIL,
            sql_args={"branch_id": None, "ew_lead_id": ew_lead_id},
        )
        if not rows:
            return "NOT_FOUND"

        claimed = await exec_sql(
            db_name=db_name,
            schema=schema,
            sql=ExtendedWarrantyServerSql.CLAIM_EW_LEAD_ALERT,
            sql_args={"error": None, "ew_lead_id": ew_lead_id, "rank": _RANK["PENDING"], "status": "PENDING"},
        )
        header_values, body_values = _build_lead_alert_params(await _bu_name(db_name, schema), rows[0])
        # The button suffix is the lead id — a deep link into the authenticated app
        # (/client/custom/ew/<id>), where ProtectedRoute is the credential, so no token.
        ok, _error = await _send_and_settle(
            db_name,
            schema,
            claimed[0]["id"],
            normalize_mobile(staff_number),
            "EXTENDED_WARRANTY_LEAD",
            header_values,
            body_values,
            [str(ew_lead_id)],
        )
        logger.info("send_ew_lead_alert: schema=%s lead=%s ok=%s", schema, ew_lead_id, ok)
        return "SENT" if ok else "FAILED"
    except Exception:  # pylint: disable=broad-except
        logger.exception("send_ew_lead_alert failed for ew_lead_id=%s — the lead is already saved", ew_lead_id)
        return "ERROR"


async def send_ew_reminders(
    db_name: str, schema: str = "public", value: str = "", sent_by: int | None = None
) -> dict[str, Any]:
    """sendEwReminders — payload `{branch_id, ew_lead_ids}`.

    The server re-checks every lead (GET_EW_LEADS_FOR_SEND: this branch, can_send), skips
    invalid mobiles, applies the daily cap once up front, and claims each lead before
    calling Meta. `sent_by` comes from the authenticated session, never the payload.

    Returns `{"results": [{band, customer_name, error, ew_lead_id, status}]}` with status
    SENT | FAILED | SKIPPED | CAPPED, or `{"disabled": True, "results": []}` when either
    switch is off. Dispatch results only; delivery arrives later through the webhook."""
    payload = _decode_value(value, "sendEwReminders")
    branch_id = payload.get("branch_id")
    try:
        ew_lead_ids = list(dict.fromkeys(int(i) for i in payload.get("ew_lead_ids") or []))
    except (TypeError, ValueError) as e:
        raise ValidationException(message=AppMessages.INVALID_INPUT, extensions={"field": "ew_lead_ids"}) from e
    if not branch_id or not ew_lead_ids:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING, extensions={"field": "branch_id/ew_lead_ids"}
        )

    db_name_arg = db_name or ""
    schema_name = schema or "public"

    settings_row = await get_ew_settings(db_name_arg, schema_name)
    if not is_ew_enabled(settings_row) or not await _is_event_enabled(db_name_arg, schema_name, "EXTENDED_WARRANTY"):
        return {"disabled": True, "results": []}

    rows = await exec_sql_query(
        db_name=db_name_arg,
        schema=schema_name,
        sql=ExtendedWarrantyServerSql.GET_EW_LEADS_FOR_SEND,
        sql_args={"branch_id": branch_id, "ew_lead_ids": ew_lead_ids},
    )
    found = {r["ew_lead_id"] for r in rows}
    skipped = [
        {"band": None, "customer_name": None, "error": "No longer sendable", "ew_lead_id": i, "status": "SKIPPED"}
        for i in ew_lead_ids
        if i not in found
    ]
    skipped += [
        {
            "band": r["band"],
            "customer_name": r["full_name"],
            "error": "Invalid or missing mobile number",
            "ew_lead_id": r["ew_lead_id"],
            "status": "SKIPPED",
        }
        for r in rows
        if not is_valid_mobile(r["mobile"])
    ]
    sendable = [r for r in rows if is_valid_mobile(r["mobile"])]

    # Daily cap, per BU schema, checked once up front so a large selection degrades
    # predictably instead of half-sending. 0 = unlimited; an unreadable value falls back
    # to the default rather than to unlimited.
    try:
        cap = max(0, int(settings_row.get("daily_send_cap") or 0))
    except (TypeError, ValueError):
        cap = _EW_DEFAULT_SETTINGS["daily_send_cap"]
    if cap:
        sent_rows = await exec_sql_query(
            db_name=db_name_arg, schema=schema_name, sql=ExtendedWarrantyServerSql.GET_EW_SENT_TODAY_COUNT
        )
        remaining = max(0, cap - int(sent_rows[0]["sent_today"]))
    else:
        remaining = len(sendable)
    allowed, capped = sendable[:remaining], sendable[remaining:]

    bu_name = await _bu_name(db_name_arg, schema_name)
    sent_by_name = await staff_name(db_name_arg, sent_by)
    semaphore = asyncio.Semaphore(_SEND_CONCURRENCY)

    async def _guarded(row: dict) -> dict[str, Any]:
        async with semaphore:
            return await _send_one_reminder(
                db_name_arg, schema_name, row, int(branch_id), bu_name, settings_row, sent_by, sent_by_name
            )

    sent = list(await asyncio.gather(*(_guarded(r) for r in allowed)))
    capped_results = [
        {
            "band": r["band"],
            "customer_name": r["full_name"],
            "error": "Daily send cap reached",
            "ew_lead_id": r["ew_lead_id"],
            "status": "CAPPED",
        }
        for r in capped
    ]

    logger.info(
        "sendEwReminders: schema=%s selected=%d attempted=%d capped=%d skipped=%d",
        schema_name, len(ew_lead_ids), len(allowed), len(capped), len(skipped),
    )
    return {"results": [*sent, *capped_results, *skipped]}


async def staff_name(db_name: str, user_id: int | None) -> str | None:
    """Display name stamped on events and sends, looked up from the authenticated user id
    — never taken from the client."""
    if not user_id:
        return None
    rows = await exec_sql_query(
        db_name=db_name,
        schema="security",
        sql=ExtendedWarrantyServerSql.GET_EW_STAFF_NAME,
        sql_args={"user_id": user_id},
    )
    return rows[0]["full_name"] if rows else None
