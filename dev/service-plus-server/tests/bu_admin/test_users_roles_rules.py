"""Unit tests for the Manager-created-users rule (plans/plan.md, Steps 4 & 6) —
_check_basic_tier_user_cap and _require_can_create_business_user. No real DB:
exec_sql is monkeypatched to return canned rows, matching test_auth_guards.py's
"no DB, no network" style."""
from types import SimpleNamespace

import pytest

from app.db.sql.sql_base import SqlStore
from app.graphql.resolvers.bu_admin import users_roles as ur


def _info(**context):
    return SimpleNamespace(context=context)


def _stub_exec_sql(responses: dict):
    """responses: SqlStore constant -> rows to return when exec_sql is called with
    that `sql` argument. Anything not listed returns []."""

    async def _fake(db_name=None, schema=None, sql=None, sql_args=None, **_kwargs):
        return responses.get(sql, [])

    return _fake


# ── _check_basic_tier_user_cap ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_basic_tier_allows_the_first_user_as_manager(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BUSINESS_USERS: [{"business_user_count": 0}],
            }
        ),
    )
    await ur._check_basic_tier_user_cap("db", "security", ur.MANAGER_ROLE_ID)


@pytest.mark.asyncio
async def test_basic_tier_rejects_a_second_business_user(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BUSINESS_USERS: [{"business_user_count": 1}],
            }
        ),
    )
    with pytest.raises(ur.ValidationException):
        await ur._check_basic_tier_user_cap("db", "security", ur.MANAGER_ROLE_ID)


@pytest.mark.asyncio
async def test_basic_tier_rejects_a_non_manager_first_user(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BUSINESS_USERS: [{"business_user_count": 0}],
            }
        ),
    )
    with pytest.raises(ur.ValidationException):
        await ur._check_basic_tier_user_cap("db", "security", role_id=2)  # TECHNICIAN


@pytest.mark.asyncio
async def test_pro_tier_has_no_user_cap(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "PRO"}],
                SqlStore.COUNT_BUSINESS_USERS: [{"business_user_count": 5}],
            }
        ),
    )
    await ur._check_basic_tier_user_cap("db", "security", role_id=3)  # RECEPTIONIST


# ── _require_can_create_business_user ───────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_is_unrestricted():
    await ur._require_can_create_business_user(
        _info(user_type="A"), "db", role_id=ur.MANAGER_ROLE_ID, bu_ids=[1, 2]
    )


@pytest.mark.asyncio
async def test_super_admin_is_unrestricted():
    await ur._require_can_create_business_user(
        _info(user_type="S"), "db", role_id=ur.MANAGER_ROLE_ID, bu_ids=[1]
    )


@pytest.mark.asyncio
async def test_business_user_without_the_right_is_rejected():
    with pytest.raises(ur.AuthorizationException):
        await ur._require_can_create_business_user(
            _info(user_type="B", access_rights=[], user_id=9), "db", role_id=2, bu_ids=[1]
        )


@pytest.mark.asyncio
async def test_technician_role_code_is_not_enough_without_the_right():
    # Holding SOME access rights but not USERS_MANAGE_OWN_BU is still a reject.
    with pytest.raises(ur.AuthorizationException):
        await ur._require_can_create_business_user(
            _info(user_type="B", access_rights=["JOBS_RECEIPTS"], user_id=9),
            "db",
            role_id=2,
            bu_ids=[1],
        )


@pytest.mark.asyncio
async def test_manager_cannot_create_another_manager(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql({SqlStore.GET_MANAGER_BU_IDS_FOR_USER: [{"bu_id": 1}]}),
    )
    with pytest.raises(ur.AuthorizationException):
        await ur._require_can_create_business_user(
            _info(user_type="B", access_rights=["USERS_MANAGE_OWN_BU"], user_id=9),
            "db",
            role_id=ur.MANAGER_ROLE_ID,
            bu_ids=[1],
        )


@pytest.mark.asyncio
async def test_manager_cannot_create_a_user_for_a_bu_they_dont_manage(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql({SqlStore.GET_MANAGER_BU_IDS_FOR_USER: [{"bu_id": 1}]}),
    )
    with pytest.raises(ur.AuthorizationException):
        await ur._require_can_create_business_user(
            _info(user_type="B", access_rights=["USERS_MANAGE_OWN_BU"], user_id=9),
            "db",
            role_id=2,
            bu_ids=[1, 2],  # 2 isn't theirs
        )


@pytest.mark.asyncio
async def test_manager_can_create_a_technician_for_their_own_bus(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _stub_exec_sql({SqlStore.GET_MANAGER_BU_IDS_FOR_USER: [{"bu_id": 1}, {"bu_id": 2}]}),
    )
    await ur._require_can_create_business_user(
        _info(user_type="B", access_rights=["USERS_MANAGE_OWN_BU"], user_id=9),
        "db",
        role_id=2,
        bu_ids=[1, 2],
    )
