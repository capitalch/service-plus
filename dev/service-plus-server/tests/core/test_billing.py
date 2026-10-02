"""plans/plan.md Step 5 — billing status and date rules (app/core/billing.py). No DB."""
from datetime import date, timedelta

import pytest

from app.core.billing import (
    compute_billing_status,
    exceeds_prepaid_limit,
    extend_paid_through,
    rebase_paid_through,
)

TODAY = date(2027, 3, 10)


def _bu(**overrides):
    return {"billing_hold": False, "billing_required": True, "paid_through": TODAY + timedelta(days=30), **overrides}


# ── compute_billing_status ───────────────────────────────────────────────────

def test_billing_off_is_not_billed_whatever_the_dates():
    assert compute_billing_status(_bu(billing_required=False, paid_through=None), TODAY) == "not_billed"


def test_hold_is_read_only_even_when_paid():
    assert compute_billing_status(_bu(billing_hold=True), TODAY) == "read_only"


def test_never_paid_is_read_only():
    assert compute_billing_status(_bu(paid_through=None), TODAY) == "read_only"


@pytest.mark.parametrize(
    "offset,expected",
    [(-1, "read_only"), (0, "due_soon"), (1, "due_soon"), (4, "due_soon"), (5, "active")],
    ids=["day-after", "day-of", "day-before", "last-of-window", "before-window"],
)
def test_status_around_paid_through(offset, expected):
    # offset = days from today to paid_through
    assert compute_billing_status(_bu(paid_through=TODAY + timedelta(days=offset)), TODAY) == expected


# ── extend_paid_through ──────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "paid_through,today,months,expected",
    [
        (None, date(2027, 1, 15), 1, date(2027, 2, 14)),  # first payment 15 Jan
        (date(2027, 2, 14), date(2027, 2, 10), 1, date(2027, 3, 14)),  # paid again early: stacks
        (date(2027, 3, 14), date(2027, 3, 20), 1, date(2027, 4, 19)),  # paid late after lapsing
        (date(2027, 1, 31), date(2027, 1, 20), 1, date(2027, 2, 28)),  # end of month clamps
        (None, date(2027, 1, 15), 24, date(2029, 1, 14)),  # two years ahead
        (date(2029, 1, 14), date(2027, 6, 1), 12, date(2030, 1, 14)),  # another year stacked
        (date(2028, 2, 29), date(2028, 2, 1), 12, date(2029, 2, 28)),  # leap day + 12 months
    ],
)
def test_extend_paid_through(paid_through, today, months, expected):
    assert extend_paid_through(paid_through, today, months) == expected


@pytest.mark.parametrize("months", [0, 61, -1])
def test_extend_paid_through_refuses_out_of_range_months(months):
    with pytest.raises(ValueError):
        extend_paid_through(None, TODAY, months)


def test_prepaid_limit_is_sixty_months_from_today():
    assert not exceeds_prepaid_limit(date(2032, 3, 10), TODAY)
    assert exceeds_prepaid_limit(date(2032, 3, 11), TODAY)


# ── rebase_paid_through ──────────────────────────────────────────────────────

def test_upgrade_shortens_prepaid_time():
    assert rebase_paid_through(TODAY + timedelta(days=100), TODAY, 299900, 599900) == TODAY + timedelta(days=49)


def test_downgrade_lengthens_prepaid_time():
    assert rebase_paid_through(TODAY + timedelta(days=100), TODAY, 599900, 299900) == TODAY + timedelta(days=200)


@pytest.mark.parametrize(
    "paid_through,old_fee,new_fee",
    [
        (TODAY - timedelta(days=1), 299900, 599900),  # paid through yesterday
        (TODAY, 299900, 599900),  # nothing left after today
        (None, 299900, 599900),  # never paid
        (TODAY + timedelta(days=30), 299900, 299900),  # same fee
        (TODAY + timedelta(days=30), 0, 299900),  # nothing prepaid to convert
    ],
)
def test_rebase_leaves_date_unchanged(paid_through, old_fee, new_fee):
    assert rebase_paid_through(paid_through, TODAY, old_fee, new_fee) == paid_through
