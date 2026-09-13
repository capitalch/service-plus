"""Extended Warranty mutation helpers (plans/plan-ew-final.md §C5.3).

The transition table lives here and is authoritative; the client mirrors it in
src/features/client/components/custom/extended-warranty/ew-state-machine.ts. A state or
stage changes only through transition_ew_lead / add_ew_follow_up here, the send claim
(app/whatsapp/ew_sender.py) and the public interest route — never through genericUpdate.

`user_id` always comes from the authenticated context (mutation.py), never the payload;
the display name stamped on events is looked up from it.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import exec_sql, exec_sql_query
from app.db.sql.sql_extended_warranty import ExtendedWarrantyServerSql, ExtendedWarrantySql
from app.graphql.pubsub import publish_ew_lead_changed
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.whatsapp.ew_sender import send_ew_lead_alert, staff_name

# Gates the Extended Warranty screen, all four mutations and genericUpdate on ew_lead.
EW_ACCESS_RIGHT = "CUSTOM_EXTENDED_WARRANTY"

CUSTOM_GENERIC_UPDATE_TABLE_RIGHTS: dict[str, str] = {"ew_lead": EW_ACCESS_RIGHT}

# §C2.3 — MUST match EW_TRANSITIONS in the client's ew-state-machine.ts. NEW_LEAD →
# MESSAGE_SENT is absent on purpose: it happens only by sending (CLAIM_EW_REMINDER).
# In Progress → In Progress (a stage advance) is handled by allowed_from().
EW_TRANSITIONS: dict[str, set[str]] = {
    "CANCELLED": {"IN_PROGRESS"},
    "IN_PROGRESS": {"CANCELLED", "LOST", "WON"},
    "INTERESTED": {"CANCELLED", "IN_PROGRESS", "LOST", "WON"},
    "LOST": {"IN_PROGRESS", "WON"},
    "MESSAGE_SENT": {"CANCELLED", "IN_PROGRESS", "INTERESTED", "LOST", "WON"},
    "NEW_LEAD": {"CANCELLED", "IN_PROGRESS", "LOST", "WON"},
    "WON": set(),
}

_FOLLOW_UP_PAST_TOLERANCE = timedelta(seconds=60)
_NOTES_MAX = 1000
_STAGES = {1, 2, 3}
_VALID_ACTIONS = {"CALL", "OTHER", "SMS", "VISIT", "WHATSAPP"}


def _invalid(field: str) -> ValidationException:
    return ValidationException(message=AppMessages.INVALID_INPUT, extensions={"field": field})


def _optional_notes(value: Any) -> str | None:
    """Trimmed notes, None when blank. Over _NOTES_MAX is refused, never silently cut."""
    notes = str(value or "").strip()
    if len(notes) > _NOTES_MAX:
        raise _invalid("notes")
    return notes or None


def _require_ids(payload: dict) -> tuple[int, int]:
    try:
        return int(payload.get("branch_id")), int(payload.get("ew_lead_id"))
    except (TypeError, ValueError) as e:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING, extensions={"field": "branch_id/ew_lead_id"}
        ) from e


def _stage(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value not in _STAGES:
        raise _invalid("progress_stage")
    return value


async def add_ew_follow_up(
    db_name: str, schema: str = "public", value: str = "", user_id: int | None = None
) -> dict[str, Any]:
    """addEwFollowUp — payload `{branch_id, ew_lead_id, action, notes, next_follow_up_at?,
    progress_stage?}`. In Progress only. `next_follow_up_at` is ISO-8601 with a time zone
    and must be in the future (60 s tolerance); null clears it. The stage never goes down."""
    payload = _decode_value(value, "addEwFollowUp")
    branch_id, ew_lead_id = _require_ids(payload)
    action = str(payload.get("action") or "").upper()
    if action not in _VALID_ACTIONS:
        raise _invalid("action")
    notes = _optional_notes(payload.get("notes"))
    if not notes:
        raise ValidationException(message=AppMessages.REQUIRED_FIELD_MISSING, extensions={"field": "notes"})

    next_follow_up_at = None
    if payload.get("next_follow_up_at"):
        try:
            next_follow_up_at = datetime.fromisoformat(str(payload["next_follow_up_at"]))
        except ValueError as e:
            raise _invalid("next_follow_up_at") from e
        if (
            next_follow_up_at.tzinfo is None
            or next_follow_up_at < datetime.now(timezone.utc) - _FOLLOW_UP_PAST_TOLERANCE
        ):
            raise _invalid("next_follow_up_at")
    progress_stage = _stage(payload.get("progress_stage"))

    rows = await exec_sql(
        db_name=db_name or "",
        schema=schema or "public",
        sql=ExtendedWarrantyServerSql.ADD_EW_FOLLOW_UP,
        sql_args={
            "action": action,
            "branch_id": branch_id,
            "by": user_id,
            "by_name": await staff_name(db_name or "", user_id),
            "ew_lead_id": ew_lead_id,
            "next_follow_up_at": next_follow_up_at,
            "notes": notes,
            "progress_stage": progress_stage,
        },
    )
    if not rows:
        return {"ok": False, "reason": "NOT_IN_PROGRESS"}

    logger.info(
        "addEwFollowUp: schema=%s lead=%s action=%s stage=%s by=%s",
        schema, ew_lead_id, action, rows[0]["progress_stage"], user_id,
    )
    await publish_ew_lead_changed(db_name or "", schema or "public", "FOLLOW_UP", ew_lead_id)
    return {"ew_lead_id": ew_lead_id, "ok": True, "progress_stage": rows[0]["progress_stage"]}


def allowed_from(to_state: str, is_stage_advance: bool) -> list[str]:
    """States a lead may be in for this move: In Progress alone for a stage advance,
    otherwise every state whose EW_TRANSITIONS entry contains `to_state`."""
    if is_stage_advance:
        return ["IN_PROGRESS"]
    return sorted(state for state, targets in EW_TRANSITIONS.items() if to_state in targets)


async def resend_ew_lead_alert(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """resendEwLeadAlert — payload `{branch_id, ew_lead_id}`. For a lead whose staff alert
    failed or was never sent (no staff number at the time). The lead must have interest."""
    payload = _decode_value(value, "resendEwLeadAlert")
    branch_id, ew_lead_id = _require_ids(payload)
    rows = await exec_sql_query(
        db_name=db_name or "",
        schema=schema or "public",
        sql=ExtendedWarrantySql.GET_EW_LEAD_DETAIL,
        sql_args={"branch_id": branch_id, "ew_lead_id": ew_lead_id},
    )
    if not rows:
        return {"ok": False, "reason": "NOT_FOUND"}
    if not rows[0]["interest_at"]:
        return {"ok": False, "reason": "NO_INTEREST"}

    status = await send_ew_lead_alert(db_name or "", schema or "public", ew_lead_id)
    await publish_ew_lead_changed(db_name or "", schema or "public", "LEAD_ALERT_RESENT", ew_lead_id)
    return {"ok": status == "SENT", "status": status}


async def transition_ew_lead(
    db_name: str, schema: str = "public", value: str = "", user_id: int | None = None
) -> dict[str, Any]:
    """transitionEwLead — payload `{branch_id, ew_lead_id, to_state, progress_stage?, notes?}`.

    A stage advance is `to_state = IN_PROGRESS` with `progress_stage` 2 or 3. Entering In
    Progress from another state always starts at Stage 1 (D3). Returns `{ok: False,
    reason: "STALE"}` when the lead changed under the user or the move is not allowed."""
    payload = _decode_value(value, "transitionEwLead")
    branch_id, ew_lead_id = _require_ids(payload)
    to_state = str(payload.get("to_state") or "").upper()
    # MESSAGE_SENT is reached only by sending a reminder, never by a bare state change.
    if to_state not in EW_TRANSITIONS or to_state == "MESSAGE_SENT":
        raise _invalid("to_state")
    progress_stage = _stage(payload.get("progress_stage"))
    is_stage_advance = to_state == "IN_PROGRESS" and progress_stage in (2, 3)

    rows = await exec_sql(
        db_name=db_name or "",
        schema=schema or "public",
        sql=ExtendedWarrantyServerSql.TRANSITION_EW_LEAD,
        sql_args={
            "allowed_from": allowed_from(to_state, is_stage_advance),
            "branch_id": branch_id,
            "by": user_id,
            "by_name": await staff_name(db_name or "", user_id),
            "ew_lead_id": ew_lead_id,
            "notes": _optional_notes(payload.get("notes")),
            "progress_stage": progress_stage if is_stage_advance else None,
            "to_state": to_state,
        },
    )
    if not rows:
        return {"ok": False, "reason": "STALE"}

    row = rows[0]
    logger.info(
        "transitionEwLead: schema=%s lead=%s %s -> %s stage=%s by=%s",
        schema, ew_lead_id, row["from_state"], row["to_state"], row["progress_stage"], user_id,
    )
    await publish_ew_lead_changed(db_name or "", schema or "public", "TRANSITION", ew_lead_id)
    return {
        "from_state": row["from_state"],
        "ok": True,
        "progress_stage": row["progress_stage"],
        "to_state": row["to_state"],
    }
