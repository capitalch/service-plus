"""Extended Warranty mutation helpers.

Only three operations need a resolver of their own: the send, the follow-up write (it
needs the authenticated user, so it cannot go through `genericUpdate`), and the staff
alert re-send. Everything else — the customer CRUD and every read — uses the existing
generic envelope.
"""

from datetime import datetime, timezone
from typing import Any

from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import exec_sql, exec_sql_query
from app.db.sql.sql_base import SqlStore
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.whatsapp.sender import send_ew_lead_alert

# The business ladder, per customer per stage. START is never stored — it is the absence
# of the stage key. Ranks exist so a follow-up can never walk a lead backwards.
EW_STAGE_STATUS_RANK = {
    "START": 0,
    "MESSAGE_SENT": 1,
    "INTERESTED": 2,
    "FOLLOWED_UP": 3,
    "CONVERTED": 9,
    "NOT_INTERESTED": 9,
    "UNREACHABLE": 9,
}

# What a staff action means for the customer-level outcome. Anything not terminal keeps
# the lead OPEN so it stays in the working list.
_TERMINAL_OUTCOMES = {"CONVERTED", "NOT_INTERESTED", "UNREACHABLE"}

_VALID_ACTIONS = {"CALL", "WHATSAPP", "SMS", "VISIT", "OTHER"}


async def add_ew_follow_up(
    db_name: str, schema: str = "public", value: str = "", staff_id: int | None = None,
) -> dict[str, Any]:
    """Record one staff follow-up action against a lead.

    This is the single close point for BOTH follow-up channels — the in-app Interest
    grid and the deep link from the staff WhatsApp alert both land here, so there is one
    lead and one history rather than a WhatsApp-side record and an app-side record to
    reconcile.

    `staff_id` comes from the authenticated session's own context, never a
    client-supplied field — same precedent as verifyJobDeliveryOtp; the display name is
    then looked up from it rather than accepted from the client."""
    payload = _decode_value(value, "addEwFollowUp")
    ew_customer_id = payload.get("ew_customer_id")
    action = (payload.get("action") or "").upper()
    outcome = (payload.get("outcome") or "OPEN").upper()
    stage = payload.get("stage")
    remarks = (payload.get("remarks") or "").strip() or None

    if not ew_customer_id or action not in _VALID_ACTIONS:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "ew_customer_id/action"},
        )
    if outcome not in _TERMINAL_OUTCOMES | {"OPEN", "IN_PROGRESS"}:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING, extensions={"field": "outcome"}
        )

    # A terminal action closes the stage at the same value; anything else means the lead
    # has been worked but is still open.
    stage_status = outcome if outcome in _TERMINAL_OUTCOMES else "FOLLOWED_UP"
    customer_outcome = outcome if outcome in _TERMINAL_OUTCOMES else "OPEN"

    staff_name = None
    if staff_id:
        name_rows = await exec_sql_query(
            db_name=db_name or "", schema="security", sql=SqlStore.GET_EW_STAFF_NAME,
            sql_args={"user_id": staff_id},
        )
        staff_name = name_rows[0]["full_name"] if name_rows else None

    rows = await exec_sql(
        db_name=db_name or "", schema=schema or "public", sql=SqlStore.APPEND_EW_FOLLOW_UP,
        sql_args={
            "ew_customer_id": ew_customer_id,
            "at": datetime.now(timezone.utc).isoformat(),
            "by": staff_id,
            "by_name": staff_name,
            "stage": str(stage) if stage is not None else None,
            "action": action,
            "outcome": customer_outcome,
            "stage_status": stage_status,
            "remarks": remarks,
        },
    )
    if not rows:
        return {"ok": False}

    logger.info(
        "addEwFollowUp: customer_id=%s stage=%s action=%s outcome=%s",
        ew_customer_id, stage, action, customer_outcome,
    )
    return {"ok": True, "ew_customer_id": ew_customer_id, "outcome": customer_outcome}


async def resend_ew_lead_alert(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """Re-send the staff WhatsApp alert for a lead whose first attempt failed or was
    never sent (no `staff_whatsapp_number` configured at the time). Reachable from the
    Interest grid's alert chip — a failed alert must be visible and recoverable, never
    swallowed."""
    payload = _decode_value(value, "resendEwLeadAlert")
    ew_customer_id = payload.get("ew_customer_id")
    stage = payload.get("stage")
    if not ew_customer_id or stage is None:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "ew_customer_id/stage"},
        )

    rows = await exec_sql_query(
        db_name=db_name or "", schema=schema or "public", sql=SqlStore.GET_EW_LEAD_DETAIL,
        sql_args={"ew_customer_id": ew_customer_id, "stage": str(stage)},
    )
    if not rows:
        return {"ok": False}

    await send_ew_lead_alert(db_name or "", schema or "public", int(ew_customer_id), int(stage))
    return {"ok": True}
