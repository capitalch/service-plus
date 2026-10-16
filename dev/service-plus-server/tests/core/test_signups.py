"""Unit tests for the public sign-up logic (plans/plan.md Step 7) — no DB, no network,
no email: exec_sql, the default-client lookup, the pending-count push and the mailer
are stubbed."""
import asyncio
import re
from types import SimpleNamespace

import pytest

from app.config import settings
from app.core.exceptions import AppMessages, ServicePlusException
from app.db.sql.sql_signups import SignupServerSql
from app.services import signup_emails, signups
from app.services.signups import SignupException, bu_code_base, derive_bu_code, make_reference

LITE = {
    "branches": 1,
    "business_name": "Nav Technology Pvt. Ltd.",
    "city": "Kolkata",
    "email": " Owner@Example.COM ",
    "gstin": None,
    "message": None,
    "mobile": "9830012345",
    "name": "Asha Roy",
    "plan_code": "lite",
}


# ── BU code ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "name, expected",
    [
        ("Nav Technology Pvt. Ltd.", "nav_technology"),
        ("ABC Pvt Ltd", "abc"),
        ("Sharma & Co", "sharma"),
        ("Pvt Ltd", "pvt"),
        ("Ab Ltd", "ab_ltd"),
        ("A1", "bu_a1"),
        ("!!", "bu_new"),
        ("123 Repairs", "bu_123_repairs"),
        ("PG Shop", "bu_pg_shop"),
    ],
)
def test_bu_code_base(name, expected):
    assert bu_code_base(name) == expected


def test_bu_code_base_is_a_valid_code_with_room_for_a_suffix():
    code = bu_code_base("The Very Long Electronics Repair And Service Centre Of Kolkata")
    assert re.fullmatch(r"[a-z0-9_]{3,26}", code) and not code.endswith("_")


def test_same_business_name_gets_a_different_code_when_taken():
    taken = {"nav_technology"}

    async def is_taken(code):
        return code in taken

    assert asyncio.run(derive_bu_code("Nav Technology Pvt. Ltd.", is_taken)) == "nav_technology_2"


def test_a_taken_code_tries_the_city_before_a_number():
    taken = {"abc"}

    async def is_taken(code):
        return code in taken

    assert asyncio.run(derive_bu_code("ABC Pvt Ltd", is_taken, "Kolkata")) == "abc_kolkata"
    taken.add("abc_kolkata")
    assert asyncio.run(derive_bu_code("ABC Pvt Ltd", is_taken, "Kolkata")) == "abc_kolkata_2"


def test_reserved_names_are_never_used():
    async def nothing_taken(_code):
        return False

    assert asyncio.run(derive_bu_code("Public", nothing_taken)) == "public_2"
    assert asyncio.run(derive_bu_code("Security", nothing_taken)) == "security_2"


def test_reference_format():
    assert re.fullmatch(r"SP-[A-HJ-NP-Z2-9]{8}", make_reference())


# ── portal address and emails ────────────────────────────────────────────────

def test_portal_url_follows_debug():
    assert settings.model_copy(update={"debug": True}).portal_url == "http://localhost:3005"
    production = settings.model_copy(update={"debug": False, "portal_url_production": "https://myserviceplus.in/"})
    assert production.portal_url == "https://myserviceplus.in"


def test_lite_thank_you_links_to_the_status_page(monkeypatch):
    monkeypatch.setattr(signup_emails, "settings", SimpleNamespace(portal_url="http://localhost:3005"))
    subject, text = signup_emails.thank_you_email({**LITE, "reference": "SP-ABCDEFGH"})
    assert "SP-ABCDEFGH" in subject
    assert "http://localhost:3005/signup-status/" in text
    assert 'href="http://localhost:3005/signup-status/"' in signup_emails.build_html(text)


def test_paid_thank_you_states_both_fees():
    enquiry = {**LITE, "monthly_fee_paise": 299900, "plan_code": "basic", "reference": "SP-X", "setup_fee_paise": 200000}
    _, text = signup_emails.thank_you_email(enquiry)
    assert "₹2,000" in text and "₹2,999" in text


def test_rupees_uses_indian_grouping():
    assert signup_emails.rupees(109990000) == "10,99,900"
    assert signup_emails.rupees(50000) == "500"


# ── submit_lt_signup / submit_enterprise_enquiry with everything stubbed ──────

def _stub(monkeypatch, pending=False, client=True, existing=None, managed=()):
    calls = {"emails": [], "published": [], "sql": []}

    async def fake_exec_sql(db_name, schema, sql, sql_args=None):
        calls["sql"].append((sql, sql_args))
        if sql == SignupServerSql.CHECK_LT_SIGNUP_PENDING:
            return [{"found": 1}] if pending else []
        if sql == SignupServerSql.GET_LT_SIGNUP_EXISTING_USER:
            return [existing] if existing else []
        if sql == SignupServerSql.GET_LT_MANAGED_BUS:
            return list(managed)
        if sql in (SignupServerSql.CHECK_LT_BU_NAME_TAKEN, SignupServerSql.CHECK_LT_BU_CODE_TAKEN):
            return [{"taken": False}]
        if sql in (SignupServerSql.GET_LT_PENDING_COUNT, SignupServerSql.GET_ENT_NEW_COUNT):
            return [{"pending": 3}]
        if sql == SignupServerSql.GET_ACTIVE_ADMIN_EMAILS:
            return [{"email": "admin@example.com"}]
        return [{"id": 1}]

    async def fake_client():
        if not client:
            raise ServicePlusException(message=AppMessages.DEFAULT_DB_NOT_CONFIGURED, code="DEFAULT_DB_NOT_CONFIGURED")
        return {"db_name": "service_plus_customers", "name": "customers"}

    async def fake_publish(db_name, kind, pending):
        calls["published"].append((db_name, kind, pending))

    async def fake_send(to, subject, text, reply_to=None):
        calls["emails"].append(to)
        return True

    monkeypatch.setattr(signups, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(signups, "get_default_customer_client", fake_client)
    monkeypatch.setattr(signups, "publish_sales_enquiry_count", fake_publish)
    monkeypatch.setattr(signups, "send_text_email", fake_send)
    return calls


def _inserts(calls, sql):
    return [args for s, args in calls["sql"] if s == sql]


def test_lite_signup_is_saved_published_and_mailed(monkeypatch):
    calls = _stub(monkeypatch)
    result = asyncio.run(signups.submit_lt_signup(LITE, "1.2.3.4"))
    (row,) = _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)
    assert result == {"reference": row["reference"], "status": "pending"}
    assert row["email"] == "owner@example.com"
    assert row["bu_code"] == "nav_technology"
    assert (row["setup_fee_paise"], row["payment_status"]) == (0, "not_required")
    assert calls["published"] == [("service_plus_customers", "LT", 3)]
    assert "owner@example.com" in calls["emails"] and "admin@example.com" in calls["emails"]


def test_basic_signup_starts_with_setup_payment_pending(monkeypatch):
    calls = _stub(monkeypatch)
    asyncio.run(signups.submit_lt_signup({**LITE, "plan_code": "basic"}, None))
    (row,) = _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)
    assert row["payment_status"] == "pending" and row["setup_fee_paise"] > 0


def test_no_default_database_writes_nothing(monkeypatch):
    calls = _stub(monkeypatch, client=False)
    with pytest.raises(ServicePlusException) as exc:
        asyncio.run(signups.submit_lt_signup(LITE, None))
    assert exc.value.code == "DEFAULT_DB_NOT_CONFIGURED"
    assert calls["sql"] == [] and calls["emails"] == []


def test_pending_request_with_this_email_is_refused(monkeypatch):
    calls = _stub(monkeypatch, pending=True)
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_signup(LITE, None))
    assert exc.value.code == "SIGNUP_PENDING_EXISTS"
    assert not _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)


def test_pending_check_is_by_email_only(monkeypatch):
    calls = _stub(monkeypatch)
    asyncio.run(signups.check_lt_signup(LITE))
    assert _inserts(calls, SignupServerSql.CHECK_LT_SIGNUP_PENDING) == [{"email": "owner@example.com"}]
    assert not _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)


def test_new_applicant_has_no_existing_login(monkeypatch):
    calls = _stub(monkeypatch)
    result = asyncio.run(signups.submit_lt_signup(LITE, None))
    assert "existing_login" not in result
    assert _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)[0]["existing_user_id"] is None


def test_returning_applicant_is_saved_against_their_login(monkeypatch):
    user = {"id": 7, "is_active": True, "is_admin": False, "username": "asharoy"}
    calls = _stub(monkeypatch, existing=user)
    result = asyncio.run(signups.submit_lt_signup(LITE, None))
    assert result["existing_login"] is True and result["username"] == "asharoy"
    assert _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)[0]["existing_user_id"] == 7


def test_admin_email_is_refused_with_the_neutral_message(monkeypatch):
    user = {"id": 1, "is_active": True, "is_admin": True, "username": "admin"}
    calls = _stub(monkeypatch, existing=user)
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_signup(LITE, None))
    assert exc.value.message == AppMessages.SIGNUP_DUPLICATE
    assert not _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)


def test_lite_and_basic_allow_one_branch_only(monkeypatch):
    _stub(monkeypatch)
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_signup({**LITE, "branches": 2, "plan_code": "basic"}, None))
    assert exc.value.message == AppMessages.SIGNUP_BRANCHES_ONE


def test_business_name_must_pass_the_bu_name_rule(monkeypatch):
    _stub(monkeypatch)
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_signup({**LITE, "business_name": "Nav#Tech"}, None))
    assert exc.value.message == AppMessages.BU_NAME_FORMAT


def test_plans_are_refused_at_the_wrong_endpoint(monkeypatch):
    calls = _stub(monkeypatch)

    async def notify(_enquiry, _recipients):
        raise AssertionError("must not notify")

    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_enterprise_enquiry(LITE, None, notify))
    assert exc.value.code == "SIGNUP_WRONG_ENDPOINT"
    with pytest.raises(SignupException):
        asyncio.run(signups.submit_lt_signup({**LITE, "plan_code": "enterprise"}, None))
    assert calls["sql"] == []


def test_enterprise_enquiry_lands_in_the_control_plane(monkeypatch):
    calls = _stub(monkeypatch)
    notified = []

    async def notify(enquiry, recipients):
        notified.append(enquiry["reference"])

    result = asyncio.run(signups.submit_enterprise_enquiry({**LITE, "plan_code": "enterprise"}, None, notify))
    (row,) = _inserts(calls, SignupServerSql.INSERT_ENT_ENQUIRY)
    assert result == {"reference": row["reference"], "status": "ok"} and notified == [row["reference"]]
    assert not _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)
    assert calls["published"][0][1] == "ENT"


def test_returning_thank_you_names_the_existing_login(monkeypatch):
    monkeypatch.setattr(signup_emails, "settings", SimpleNamespace(portal_url="http://localhost:3005"))
    enquiry = {"business_name": "Nav", "name": "Asha", "plan_code": "lite", "reference": "SP-ABCDEFGH"}
    _, new_text = signup_emails.thank_you_email(enquiry)
    _, returning_text = signup_emails.thank_you_email({**enquiry, "existing_username": "asharoy"})
    assert "asharoy" not in new_text
    assert returning_text.startswith(new_text) and "(asharoy)" in returning_text


# ── plan rules and upgrades ───────────────────────────────────────────────────

USER = {"full_name": "Asha Roy", "id": 7, "is_active": True, "is_admin": False, "mobile": "9830012345", "username": "asharoy"}
LITE_BU = {"code": "nav_technology", "id": 2, "name": "Nav Technology", "plan_code": "lite"}
BASIC_BU = {"code": "nav_kolkata", "id": 3, "name": "Nav Kolkata", "plan_code": "basic"}


@pytest.mark.parametrize("plan_code", ["lite", "basic", "standard"])
def test_a_lite_owner_must_upgrade_before_any_new_signup(monkeypatch, plan_code):
    calls = _stub(monkeypatch, existing=USER, managed=[LITE_BU])
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_signup({**LITE, "plan_code": plan_code}, None))
    assert exc.value.code == "SIGNUP_LITE_EXISTS"
    assert not _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)


def test_a_paid_owner_cannot_take_lite(monkeypatch):
    _stub(monkeypatch, existing=USER, managed=[BASIC_BU])
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_signup(LITE, None))
    assert exc.value.code == "SIGNUP_LITE_NOT_FOR_PAID"


def test_a_paid_owner_can_add_a_paid_bu(monkeypatch):
    calls = _stub(monkeypatch, existing=USER, managed=[BASIC_BU])
    result = asyncio.run(signups.submit_lt_signup({**LITE, "plan_code": "standard"}, None))
    assert result["existing_login"] is True and _inserts(calls, SignupServerSql.INSERT_LT_ENQUIRY)


def test_upgrade_request_targets_the_single_lite_bu_with_the_setup_fee(monkeypatch):
    calls = _stub(monkeypatch, existing=USER, managed=[LITE_BU, BASIC_BU])
    result = asyncio.run(signups.submit_lt_upgrade({"email": "Owner@Example.com", "plan_code": "basic"}, None))
    row = _inserts(calls, SignupServerSql.INSERT_LT_UPGRADE)[0]
    assert result["bu_name"] == "Nav Technology" and result["status"] == "pending"
    assert row["upgrade_bu_id"] == 2 and row["bu_code"] == "nav_technology" and row["existing_user_id"] == 7
    assert row["setup_fee_paise"] > 0 and row["payment_status"] == "pending"


@pytest.mark.parametrize(
    "existing, managed, code",
    [
        (None, [], "UPGRADE_NO_LITE"),
        (USER, [BASIC_BU], "UPGRADE_NO_LITE"),
        ({**USER, "is_active": False}, [LITE_BU], "UPGRADE_NO_LITE"),
        (USER, [LITE_BU, {**LITE_BU, "id": 4}], "UPGRADE_SEVERAL_LITE"),
    ],
)
def test_upgrade_needs_one_lite_bu(monkeypatch, existing, managed, code):
    calls = _stub(monkeypatch, existing=existing, managed=managed)
    with pytest.raises(SignupException) as exc:
        asyncio.run(signups.submit_lt_upgrade({"email": "owner@example.com", "plan_code": "standard"}, None))
    assert exc.value.code == code
    assert not _inserts(calls, SignupServerSql.INSERT_LT_UPGRADE)
