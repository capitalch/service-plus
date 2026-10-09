"""Sign-up approval and Enterprise extra-BU billing (plans/plan.md Steps 9, 10) — no DB:
exec_sql and the other side effects are stubbed."""
import asyncio
import json
from datetime import date, timedelta
from types import SimpleNamespace
from urllib.parse import quote

import pytest

from app.core.exceptions import AppMessages, ValidationException
from app.core.plan_prices import get_price_list
from app.db.sql.sql_billing import BillingServerSql
from app.db.sql.sql_signups import SignupServerSql
from app.graphql.resolvers.bu_admin import signups as approval
from app.graphql.resolvers.bu_admin.signups import parse_payment
from app.services import enterprise_billing


def _value(payload: dict) -> str:
    return quote(json.dumps(payload))


def _info(**context):
    return SimpleNamespace(context={"user_id": 7, "user_type": "A", **context})


# ── parse_payment ─────────────────────────────────────────────────────────────

def _payment(**overrides):
    return {
        "amount": 2000,
        "mode": "upi",
        "note": "",
        "received_on": date.today().isoformat(),
        "reference": "UTR123",
        **overrides,
    }


def test_payment_in_rupees_becomes_paise():
    assert parse_payment(_payment(), 200000)["amount_paise"] == 200000


def test_payment_below_the_setup_fee_is_refused():
    with pytest.raises(ValidationException) as exc:
        parse_payment(_payment(amount=1999), 200000)
    assert exc.value.message == AppMessages.ENQUIRY_PAYMENT_AMOUNT_LOW


def test_payment_dated_in_the_future_is_refused():
    with pytest.raises(ValidationException):
        parse_payment(_payment(received_on=(date.today() + timedelta(days=1)).isoformat()), 0)


@pytest.mark.parametrize("bad", [{"mode": "cheque"}, {"reference": "  "}, {"received_on": "03/10/2026"}])
def test_payment_needs_mode_reference_and_iso_date(bad):
    with pytest.raises(ValidationException):
        parse_payment(_payment(**bad), 0)


# ── approval ──────────────────────────────────────────────────────────────────

ENQUIRY = {
    "bu_code": "acme_repairs",
    "bu_id": None,
    "bu_name": "Acme Repairs",
    "bu_schema_ready_at": None,
    "city": "Kolkata",
    "email": "owner@example.com",
    "gstin": None,
    "id": 5,
    "login_email_sent": False,
    "mobile": "9830012345",
    "name": "Asha Roy",
    "payment_status": "pending",
    "plan_code": "basic",
    "reference": "SP-ABCDEFGH",
    "status": "pending",
    "user_id": None,
}


def _stub_db(monkeypatch, claimed):
    calls = []

    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        calls.append(sql)
        if sql == SignupServerSql.CLAIM_LT_ENQUIRY:
            return [claimed] if claimed else []
        if sql == SignupServerSql.GET_LT_ENQUIRY:
            return [ENQUIRY]
        return []

    monkeypatch.setattr(approval, "exec_sql", fake_exec_sql)
    return calls


def test_unpaid_basic_is_refused_and_creates_nothing(monkeypatch):
    calls = _stub_db(monkeypatch, ENQUIRY)
    with pytest.raises(ValidationException) as exc:
        asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert exc.value.code == "PAYMENT_NOT_RECEIVED"
    assert calls == [SignupServerSql.CLAIM_LT_ENQUIRY, SignupServerSql.RELEASE_LT_CLAIM]


def test_a_claimed_request_is_busy(monkeypatch):
    _stub_db(monkeypatch, None)
    with pytest.raises(ValidationException) as exc:
        asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert exc.value.message == AppMessages.ENQUIRY_BUSY


def test_rejection_needs_a_reason(monkeypatch):
    calls = _stub_db(monkeypatch, ENQUIRY)
    with pytest.raises(ValidationException):
        asyncio.run(approval.resolve_reject_sales_enquiry_helper(_info(), "db", _value({"id": 5, "reason": " "})))
    assert calls == []


@pytest.mark.parametrize(
    "name, email, expected",
    [
        ("Asha Roy", "admin@abc.com", "asharoy"),
        ("Dr. Asha Roy", "info@abc.com", "asharoy"),
        ("Raj Ko", "x@abc.com", "rajko"),
        ("Al Li", "ownerali@abc.com", "ownerali"),
        ("Al Li", "admin@abc.com", "alli"),
        ("Subramaniam Venkataraman Iyer", "a@b.com", "subramaniamvenkatara"),
    ],
)
def test_default_username(name, email, expected):
    assert approval.default_username(name, email) == expected


def test_free_username_follows_the_client_rule(monkeypatch):
    taken = {"ab0user", "owner"}

    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        return [{"exists": sql_args["username"] in taken}]

    monkeypatch.setattr(approval, "exec_sql", fake_exec_sql)
    assert asyncio.run(approval.free_username("db", "owner")) == "owner2"
    assert asyncio.run(approval.free_username("db", "a.b")) == "abuser"


# ── Enterprise later BUs ──────────────────────────────────────────────────────

def _bus(count, paid_through=None):
    return [
        {
            "billing_hold": False,
            "billing_required": True,
            "branch_limit": None,
            "code": f"bu{i}",
            "id": i,
            "monthly_fee_paise": 1099900 if i == 1 else 0,
            "paid_through": paid_through,
            "plan_code": "enterprise",
        }
        for i in range(1, count + 1)
    ]


def _stub_bus(monkeypatch, rows):
    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        assert sql == BillingServerSql.GET_BU_BILLING_ROWS
        return rows

    monkeypatch.setattr(enterprise_billing, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(enterprise_billing, "is_default_customer_db", lambda db: False)


def test_bus_two_to_five_are_included(monkeypatch):
    _stub_bus(monkeypatch, _bus(get_price_list().enterprise_included_bus - 1))
    plan = asyncio.run(enterprise_billing.plan_new_bu_billing("service_plus_acme", False))
    assert plan.bu_number == get_price_list().enterprise_included_bus and plan.fee_paise == 0


def test_a_sixth_bu_needs_confirmation(monkeypatch):
    _stub_bus(monkeypatch, _bus(get_price_list().enterprise_included_bus))
    with pytest.raises(ValidationException) as exc:
        asyncio.run(enterprise_billing.plan_new_bu_billing("service_plus_acme", False))
    assert exc.value.code == "EXTRA_BU_CONFIRM_REQUIRED"
    plan = asyncio.run(enterprise_billing.plan_new_bu_billing("service_plus_acme", True))
    extra = get_price_list().extra_bu_monthly_paise  # from .env, default ₹3,000
    assert plan.fee_paise == extra and plan.new_total_paise == 1099900 + extra


def test_a_prepaid_client_gets_its_date_rebased(monkeypatch):
    far = date.today() + timedelta(days=400)
    _stub_bus(monkeypatch, _bus(get_price_list().enterprise_included_bus, paid_through=far))
    plan = asyncio.run(enterprise_billing.plan_new_bu_billing("service_plus_acme", True))
    assert plan.paid_through < far


def test_an_unbilled_database_is_left_alone(monkeypatch):
    rows = _bus(2)
    for r in rows:
        r["billing_required"] = False
    _stub_bus(monkeypatch, rows)
    assert asyncio.run(enterprise_billing.plan_new_bu_billing("service_plus_old", False)) is None
