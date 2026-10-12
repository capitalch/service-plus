"""In-memory Ask AI limits, built like app/core/rate_limit.py. A server restart resets
them — fine for a free feature. Only answered questions are counted."""

import time
from collections import defaultdict
from datetime import date

from app.config import settings
from app.core.billing import today_ist
from app.core.exceptions import AppMessages, CodedValidationException

MINUTE_SECONDS = 60

_bu_days: dict[tuple[str, str], tuple[date, int]] = {}
_user_minutes: dict[str, list[float]] = defaultdict(list)


def _bu_key(db_name: str, schema: str) -> tuple[str, str]:
    return db_name, (schema or "").lower()


def _recent(user_key: str, now: float) -> list[float]:
    timestamps = _user_minutes[user_key]
    while timestamps and timestamps[0] <= now - MINUTE_SECONDS:
        timestamps.pop(0)
    return timestamps


def check(db_name: str, schema: str, user_key: str) -> None:
    """Raise AI_HELP_LIMIT_REACHED when the BU's day or the user's minute is used up."""
    day, count = _bu_days.get(_bu_key(db_name, schema), (today_ist(), 0))
    bu_full = day == today_ist() and count >= settings.ai_help_daily_limit_per_bu
    user_full = len(_recent(user_key, time.monotonic())) >= settings.ai_help_per_user_per_minute
    if bu_full or user_full:
        raise CodedValidationException(message=AppMessages.AI_HELP_LIMIT_REACHED, code="AI_HELP_LIMIT_REACHED")


def record(db_name: str, schema: str, user_key: str) -> None:
    """Count one answered question."""
    key = _bu_key(db_name, schema)
    today = today_ist()
    day, count = _bu_days.get(key, (today, 0))
    _bu_days[key] = (today, (count if day == today else 0) + 1)
    _recent(user_key, time.monotonic()).append(time.monotonic())


def reset() -> None:
    """Forget every count (tests)."""
    _bu_days.clear()
    _user_minutes.clear()
