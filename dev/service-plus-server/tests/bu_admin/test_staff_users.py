"""A Manager adding Receptionist / Technician users: who may, on which plan — no DB, no network."""
import json
from types import SimpleNamespace
from urllib.parse import quote

import pytest

from app.core.exceptions import AuthorizationException
from app.graphql.resolvers.auth_guards import require_sql_id_access
from app.graphql.resolvers.bu_admin import staff_users
from app.graphql.resolvers.bu_admin.staff_users import plan_allows_user_management, require_manager_creates_staff_user


def _info(**context):
    return SimpleNamespace(context=context)


def _value(role_id=3, bu_ids=(1,)):
    return quote(json.dumps({"bu_ids": list(bu_ids), "role_id": role_id}))


def _patch(monkeypatch, *, role_code="RECEPTIONIST", bu_code="demo1", plan="standard"):
    async def fake_exec_sql(_db, _schema, sql, args=None):
        if sql == staff_users.SqlStore.GET_ROLE_CODE_BY_ID:
            return [{"code": role_code}] if role_code else []
        return [{"id": i, "code": bu_code} for i in args["ids"]]

    async def fake_billing(_db, _code):
        return {"planCode": plan}

    monkeypatch.setattr(staff_users, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(staff_users, "get_bu_billing", fake_billing)


MANAGER = {"user_type": "B", "role_code": "MANAGER", "bu_codes": ["demo1"]}


@pytest.mark.parametrize("plan,allowed", [("lite", False), ("basic", False), ("standard", True), ("enterprise", True), (None, True)])
def test_plan_allows_user_management(plan, allowed):
    assert plan_allows_user_management(plan) is allowed


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["RECEPTIONIST", "TECHNICIAN"])
async def test_manager_may_add_staff_on_standard(monkeypatch, role):
    _patch(monkeypatch, role_code=role)
    await require_manager_creates_staff_user(_info(**MANAGER), "db", _value())


@pytest.mark.asyncio
@pytest.mark.parametrize("plan", ["lite", "basic"])
async def test_manager_refused_on_lite_and_basic(monkeypatch, plan):
    _patch(monkeypatch, plan=plan)
    with pytest.raises(AuthorizationException) as exc:
        await require_manager_creates_staff_user(_info(**MANAGER), "db", _value())
    assert exc.value.extensions.get("reason") == "plan_too_low"


@pytest.mark.asyncio
async def test_manager_cannot_add_a_manager(monkeypatch):
    _patch(monkeypatch, role_code="MANAGER")
    with pytest.raises(AuthorizationException) as exc:
        await require_manager_creates_staff_user(_info(**MANAGER), "db", _value(role_id=1))
    assert exc.value.extensions.get("reason") == "staff_role_not_allowed"


@pytest.mark.asyncio
async def test_manager_cannot_use_someone_elses_bu(monkeypatch):
    _patch(monkeypatch, bu_code="other")
    with pytest.raises(AuthorizationException) as exc:
        await require_manager_creates_staff_user(_info(**MANAGER), "db", _value())
    assert exc.value.extensions.get("reason") == "bu_mismatch"


@pytest.mark.asyncio
@pytest.mark.parametrize("ctx", [
    {"user_type": "B", "role_code": "RECEPTIONIST", "bu_codes": ["demo1"]},
    {"user_type": "B", "role_code": "TECHNICIAN", "bu_codes": ["demo1"]},
    {"user_type": "S", "role_code": None, "bu_codes": []},
])
async def test_only_a_manager_passes(monkeypatch, ctx):
    _patch(monkeypatch)
    with pytest.raises(AuthorizationException):
        await require_manager_creates_staff_user(_info(**ctx), "db", _value())


def test_staff_lists_are_manager_only():
    for sql_id in ("CHECK_BUSINESS_USER_EMAIL_EXISTS", "CHECK_BUSINESS_USER_USERNAME_EXISTS", "GET_STAFF_ROLES", "GET_STAFF_USERS"):
        require_sql_id_access(_info(user_type="B", role_code="MANAGER"), sql_id)
        require_sql_id_access(_info(user_type="A"), sql_id)
        with pytest.raises(AuthorizationException):
            require_sql_id_access(_info(user_type="B", role_code="TECHNICIAN"), sql_id)
