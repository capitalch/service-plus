"""Shared helpers for WhatsApp sends: mobile validation/normalization and the
per-job `whatsapp_notifications` jsonb_set update args. Used by both the
sendWhatsappCompletion GraphQL mutation (app/graphql/resolvers/jobs/whatsapp.py)
and the REST document-send endpoint (app/routers/notifications/whatsapp_router.py)
— see plans/plan-whatsapp.md §4d/§4e.
"""

import json
import re
from datetime import datetime, timezone
from typing import Any


def normalize_mobile(mobile: str | None) -> str:
    """Digits-only with a leading 91 country code — the `to` format the BSP expects."""
    digits = re.sub(r"\D", "", mobile or "")
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def is_valid_mobile(mobile: str | None) -> bool:
    """Mirrors the client's isValidMobile: a 10-digit Indian mobile number, after
    stripping a +91/91 prefix."""
    digits = re.sub(r"\D", "", mobile or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return len(digits) == 10


def build_notification_update_args(
    job_id: int,
    event_type: str,
    current_notifications: dict[str, Any] | None,
    sent: bool,
    error_message: str | None,
) -> dict[str, Any]:
    """sql_args for SqlStore.SET_JOB_WHATSAPP_NOTIFICATION — increments exactly one
    of success_count/fail_count on top of whatever's already stored for this event,
    per the shape documented in plans/plan-whatsapp.md §3."""
    existing = (current_notifications or {}).get(event_type) or {}
    event_data = {
        "success_count": existing.get("success_count", 0) + (1 if sent else 0),
        "fail_count": existing.get("fail_count", 0) + (0 if sent else 1),
        "last_sent_at": datetime.now(timezone.utc).isoformat(),
        "last_status": "SENT" if sent else "FAILED",
        "last_error": None if sent else error_message,
    }
    return {
        "job_id": job_id,
        "event_path": [event_type],
        "event_json": json.dumps(event_data),
    }
