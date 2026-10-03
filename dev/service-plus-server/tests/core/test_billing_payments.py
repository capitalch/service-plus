"""Monthly payment rules and reminders (plans/plan.md Step 13) — pure helpers, no DB."""
from datetime import date, timedelta

import pytest

from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.bu_admin.billing import _check_amount, _new_paid_through, _parse_months, period_text
from app.services.billing_reminders import reminder_kind

TODAY = date(2026, 10, 3)


@pytest.mark.parametrize("months, text", [(1, "1 month"), (5, "5 months"), (12, "1 year"), (24, "2 years"), (36, "3 years")])
def test_period_text(months, text):
    assert period_text(months) == text


@pytest.mark.parametrize("bad", [0, 61, "x", None])
def test_months_are_1_to_60(bad):
    with pytest.raises(ValidationException):
        _parse_months({"months": bad})


def test_amount_below_fee_times_months_is_refused():
    with pytest.raises(ValidationException) as exc:
        _check_amount({"amount_paise": 599899, "note": None}, 599900)
    assert exc.value.message == AppMessages.PAYMENT_AMOUNT_BELOW_DUE


def test_amount_above_due_needs_a_note():
    with pytest.raises(ValidationException):
        _check_amount({"amount_paise": 700000, "note": None}, 599900)
    _check_amount({"amount_paise": 700000, "note": "rounded up"}, 599900)


def test_three_years_moves_paid_through_36_months():
    period_from, period_to = _new_paid_through(date(2026, 12, 31), 36, TODAY)
    assert period_from == date(2027, 1, 1) and period_to == date(2029, 12, 31)


def test_stacked_payments_cannot_pass_five_years():
    with pytest.raises(ValidationException) as exc:
        _new_paid_through(date(2030, 10, 3), 13, TODAY)
    assert exc.value.code == "PREPAID_LIMIT_EXCEEDED"


def test_a_late_payment_starts_today():
    period_from, _ = _new_paid_through(date(2026, 9, 1), 1, TODAY)
    assert period_from == TODAY


def _bu(paid_through, kind=None, on=None, hold=False):
    return {"billing_hold": hold, "last_reminder_kind": kind, "last_reminder_on": on, "paid_through": paid_through}


@pytest.mark.parametrize(
    "days_left, expected",
    [(6, None), (5, "due_soon"), (1, "due_soon"), (0, "due_today"), (-1, "lapsed"), (-30, "lapsed")],
)
def test_reminder_kind_by_days_left(days_left, expected):
    assert reminder_kind(_bu(TODAY + timedelta(days=days_left)), TODAY) == expected


def test_each_reminder_goes_once_per_period():
    paid_through = TODAY + timedelta(days=3)
    assert reminder_kind(_bu(paid_through, "due_soon", TODAY - timedelta(days=2)), TODAY) is None
    assert reminder_kind(_bu(TODAY - timedelta(days=2), "lapsed", TODAY - timedelta(days=1)), TODAY) is None


def test_at_most_one_email_a_day_and_none_on_hold():
    assert reminder_kind(_bu(TODAY, on=TODAY), TODAY) is None
    assert reminder_kind(_bu(TODAY - timedelta(days=1), hold=True), TODAY) is None


def test_first_payment_reminder_goes_once():
    assert reminder_kind(_bu(None), TODAY) == "first_payment"
    assert reminder_kind(_bu(None, "first_payment", TODAY - timedelta(days=1)), TODAY) is None
