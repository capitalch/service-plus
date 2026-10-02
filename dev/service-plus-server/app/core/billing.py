"""Monthly billing rules (plans/plan.md Step 5) — pure functions, no database.

Dates are IST calendar dates. `paid_through` is the last day a BU may write; the day
after it, the BU is view-only (no grace period). A month is a calendar month counted
from the day paid, clamped to the month's last day (31 Jan + 1 month → end of February).
"""

import calendar
from collections.abc import Mapping
from datetime import date, datetime, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

BillingStatusType = Literal["not_billed", "read_only", "due_soon", "active"]

IST = ZoneInfo("Asia/Kolkata")

# Warn (amber banner, reminder email) during the last DUE_SOON_DAYS days, paid_through included.
DUE_SOON_DAYS = 5

# A customer may prepay at most this many months, in one payment or several stacked.
MAX_PREPAID_MONTHS = 60


def today_ist() -> date:
    """Today's date in India. Every billing decision uses this, never the server's local date."""
    return datetime.now(IST).date()


def add_months(start: date, months: int) -> date:
    """`start` moved forward by calendar months, clamped to the target month's last day."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(start.day, calendar.monthrange(year, month)[1]))


def compute_billing_status(bu: Mapping[str, Any], today: date) -> BillingStatusType:
    """Billing status of one security.bu row (or a dict with its billing columns).

    not_billed — billing is off (Lite, and every BU that existed before billing).
    read_only  — on hold, never paid, or today is after paid_through.
    due_soon   — inside the last DUE_SOON_DAYS days; a warning only, writes still work.
    active     — otherwise.
    """
    if not bu.get("billing_required"):
        return "not_billed"
    paid_through = bu.get("paid_through")
    if bu.get("billing_hold") or paid_through is None or today > paid_through:
        return "read_only"
    if (paid_through - today).days < DUE_SOON_DAYS:
        return "due_soon"
    return "active"


def extend_paid_through(paid_through: date | None, today: date, months: int) -> date:
    """New paid_through after paying `months` months (1–MAX_PREPAID_MONTHS; a year is 12).

    Counts from the later of paid_through and yesterday: an advance payment stacks on the
    paid period, a late one starts from the day it is paid, so lapsed days are not billed.
    """
    if not 1 <= months <= MAX_PREPAID_MONTHS:
        raise ValueError(f"months must be between 1 and {MAX_PREPAID_MONTHS}")
    yesterday = today - timedelta(days=1)
    start = max(paid_through, yesterday) if paid_through else yesterday
    return add_months(start, months)


def exceeds_prepaid_limit(new_paid_through: date, today: date) -> bool:
    """True when a payment would put paid_through more than MAX_PREPAID_MONTHS ahead."""
    return new_paid_through > add_months(today, MAX_PREPAID_MONTHS)


def rebase_paid_through(
    paid_through: date | None, today: date, old_fee_paise: int, new_fee_paise: int
) -> date | None:
    """paid_through after a fee change, keeping the unused prepaid value (constraint 8).

    The days left after today are re-priced at the new fee, rounded down to whole days:
    an upgrade moves the date earlier, a downgrade later. Unchanged when nothing is
    prepaid beyond today, the fee is the same, or either fee is not positive.
    """
    if (
        paid_through is None
        or paid_through <= today
        or old_fee_paise == new_fee_paise
        or old_fee_paise <= 0
        or new_fee_paise <= 0
    ):
        return paid_through
    remaining_days = (paid_through - today).days
    return today + timedelta(days=remaining_days * old_fee_paise // new_fee_paise)
