"""Sign-up approval and Enterprise extra-BU billing (plans/plan.md Steps 9, 10) — no DB:
exec_sql and the other side effects are stubbed."""
import asyncio
import json
from datetime import date, timedelta
from types import SimpleNamespace
from urllib.parse import quote, unquote

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


# ── approval of a returning applicant (plans/plan.md Step 6) ──────────────────

READY = {**ENQUIRY, "bu_id": 9, "bu_schema_ready_at": "2026-10-16", "payment_status": "received"}


def _stub_returning(monkeypatch, user):
    calls = {"created": [], "emails": [], "sql": []}

    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        calls["sql"].append((sql, sql_args))
        if sql == SignupServerSql.CLAIM_LT_ENQUIRY:
            return [READY]
        if sql == SignupServerSql.GET_BU_BY_ID:
            return [{"code": "acme_repairs", "id": 9, "name": "Acme Repairs"}]
        if sql == SignupServerSql.GET_LT_SIGNUP_EXISTING_USER:
            return [user] if user else []
        if sql == SignupServerSql.GET_ROLE_ID_BY_CODE:
            return [{"id": 3}]
        if sql == SignupServerSql.GET_USERNAME:
            return [{"username": "approver"}]
        return []

    async def fake_noop(*args, **kwargs):
        return None

    async def fake_create(db_name, schema, value, request=None):
        calls["created"].append(value)
        return {"email_sent": True, "id": 50}

    async def fake_client():
        return {"db_name": "db", "name": "Service Plus"}

    async def fake_send(to, subject, text, reply_to=None):
        calls["emails"].append((to, subject))
        return True

    async def fake_log(**kwargs):
        return None

    monkeypatch.setattr(approval, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(approval, "set_bu_plan", fake_noop)
    monkeypatch.setattr(approval, "set_head_office_city_gstin", fake_noop)
    monkeypatch.setattr(approval, "resolve_create_business_user_helper", fake_create)
    monkeypatch.setattr(approval, "get_default_customer_client", fake_client)
    monkeypatch.setattr(approval, "send_text_email", fake_send)
    monkeypatch.setattr(approval, "_publish_pending_count", fake_noop)
    monkeypatch.setattr(approval.audit_logger, "log", fake_log)
    return calls


def _sql_args(calls, sql):
    return [args for s, args in calls["sql"] if s == sql]


def test_returning_applicant_gets_the_bu_on_their_login(monkeypatch):
    calls = _stub_returning(monkeypatch, {"id": 7, "is_active": True, "is_admin": False, "username": "asharoy"})
    result = asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert result["existing_user"] is True and result["user_id"] == 7 and result["username"] == "asharoy"
    assert _sql_args(calls, SignupServerSql.INSERT_LT_USER_BU_ROLE) == [{"bu_id": 9, "role_id": 3, "user_id": 7}]
    assert _sql_args(calls, SignupServerSql.SET_LT_USER) == [{"id": 5, "login_email_sent": True, "user_id": 7}]
    assert calls["created"] == []
    assert calls["emails"] == [("owner@example.com", "Your new Service+ business unit Acme Repairs is ready")]


def test_new_applicant_still_gets_a_new_manager(monkeypatch):
    calls = _stub_returning(monkeypatch, None)
    result = asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert result["existing_user"] is False and result["user_id"] == 50
    assert len(calls["created"]) == 1 and not _sql_args(calls, SignupServerSql.INSERT_LT_USER_BU_ROLE)


@pytest.mark.parametrize(
    "user, message",
    [
        ({"id": 7, "is_active": False, "is_admin": False, "username": "asharoy"}, AppMessages.ENQUIRY_EXISTING_USER_INACTIVE),
        ({"id": 1, "is_active": True, "is_admin": True, "username": "admin"}, AppMessages.ENQUIRY_EXISTING_USER_ADMIN),
    ],
)
def test_inactive_or_admin_login_is_refused_and_released(monkeypatch, user, message):
    calls = _stub_returning(monkeypatch, user)
    with pytest.raises(ValidationException) as exc:
        asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert exc.value.message == message
    assert not _sql_args(calls, SignupServerSql.INSERT_LT_USER_BU_ROLE)
    assert _sql_args(calls, SignupServerSql.RELEASE_LT_CLAIM)


# ── deleting a rejected request ───────────────────────────────────────────────

def test_rejected_request_is_deleted_and_audited(monkeypatch):
    sqls, logged = [], []

    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        sqls.append((sql, sql_args))
        if sql == SignupServerSql.DELETE_LT_ENQUIRY:
            return [{"business_name": "Acme", "id": 5, "reference": "SP-ABCDEFGH"}]
        if sql == SignupServerSql.GET_USERNAME:
            return [{"username": "approver"}]
        return []

    async def fake_log(**kwargs):
        logged.append(kwargs["action"])

    monkeypatch.setattr(approval, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(approval.audit_logger, "log", fake_log)
    result = asyncio.run(approval.resolve_delete_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert result == {"id": 5, "status": "deleted"}
    assert sqls[0] == (SignupServerSql.DELETE_LT_ENQUIRY, {"id": 5})
    assert logged == ["DELETE_SALES_ENQUIRY"]


def test_only_a_rejected_request_can_be_deleted(monkeypatch):
    _stub_db(monkeypatch, ENQUIRY)  # DELETE_LT_ENQUIRY matches no row: not rejected
    with pytest.raises(ValidationException) as exc:
        asyncio.run(approval.resolve_delete_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert exc.value.message == AppMessages.ENQUIRY_DELETE_NOT_ALLOWED



# ── plan rule at approval, and upgrades ───────────────────────────────────────

def test_approval_refuses_a_new_bu_for_a_lite_owner(monkeypatch):
    calls = _stub_returning(monkeypatch, {"id": 7, "is_active": True, "is_admin": False, "username": "asharoy"})
    original = approval.exec_sql

    async def with_lite(db_name, schema, sql, sql_args=None):
        if sql == SignupServerSql.GET_LT_MANAGED_BUS:
            return [{"code": "old", "id": 2, "name": "Old", "plan_code": "lite"}]
        return await original(db_name, schema, sql, sql_args)

    monkeypatch.setattr(approval, "exec_sql", with_lite)
    with pytest.raises(ValidationException) as exc:
        asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert exc.value.message == AppMessages.SIGNUP_LITE_EXISTS
    assert not _sql_args(calls, SignupServerSql.INSERT_LT_USER_BU_ROLE)


UPGRADE = {**READY, "bu_id": None, "existing_user_id": 7, "kind": "upgrade", "plan_code": "standard", "upgrade_bu_id": 2}


def _stub_upgrade(monkeypatch, bu_plan):
    calls = {"changed": [], "emails": [], "sql": []}

    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        calls["sql"].append((sql, sql_args))
        if sql == SignupServerSql.CLAIM_LT_ENQUIRY:
            return [UPGRADE]
        if sql == SignupServerSql.GET_BU_BY_ID:
            return [{"code": "nav", "id": 2, "name": "Nav", "plan_code": bu_plan}] if bu_plan else []
        if sql == SignupServerSql.GET_USERNAME:
            return [{"username": "approver"}]
        return []

    async def fake_change(info, db_name, value):
        calls["changed"].append(json.loads(unquote(value)))
        return {}

    async def fake_send(to, subject, text, reply_to=None):
        calls["emails"].append(subject)
        return True

    async def fake_noop(*args, **kwargs):
        return None

    from app.graphql.resolvers.bu_admin import billing

    monkeypatch.setattr(approval, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(billing, "resolve_change_bu_plan_helper", fake_change)
    monkeypatch.setattr(approval, "send_text_email", fake_send)
    monkeypatch.setattr(approval, "_publish_pending_count", fake_noop)
    monkeypatch.setattr(approval.audit_logger, "log", fake_noop)
    return calls


def test_upgrade_approval_changes_the_plan_and_finishes(monkeypatch):
    calls = _stub_upgrade(monkeypatch, "lite")
    result = asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert result["kind"] == "upgrade" and result["plan_code"] == "standard"
    assert calls["changed"] == [{"bu_id": 2, "plan_code": "standard"}]
    assert calls["emails"] == ["Your business unit Acme Repairs is now on Service+ Standard"]
    assert _sql_args(calls, SignupServerSql.FINISH_LT_APPROVAL)


def test_resumed_upgrade_does_not_change_the_plan_twice(monkeypatch):
    calls = _stub_upgrade(monkeypatch, "standard")
    asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert calls["changed"] == [] and _sql_args(calls, SignupServerSql.FINISH_LT_APPROVAL)


@pytest.mark.parametrize("bu_plan, message", [("basic", AppMessages.UPGRADE_NOT_LITE), (None, AppMessages.UPGRADE_BU_MISSING)])
def test_upgrade_of_a_bu_no_longer_lite_is_refused(monkeypatch, bu_plan, message):
    calls = _stub_upgrade(monkeypatch, bu_plan)
    with pytest.raises(ValidationException) as exc:
        asyncio.run(approval.resolve_approve_sales_enquiry_helper(_info(), "db", _value({"id": 5})))
    assert exc.value.message == message and calls["changed"] == []
    assert _sql_args(calls, SignupServerSql.RELEASE_LT_CLAIM)
