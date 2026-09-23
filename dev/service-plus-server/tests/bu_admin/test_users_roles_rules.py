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


# ── _validate_and_save_branch_restrictions (plans/plan.md, Step 6) ──────────
#
# Unlike the rules above, this one calls exec_sql with different sql_args (and,
# across BUs, a different `schema`) on each call, and also writes through a raw
# cursor rather than exec_sql — so it needs its own argument-aware fake rather
# than the single-static-response _stub_exec_sql used above.


class _FakeCursor:
    """Records every INSERT this function issues, in order."""

    def __init__(self):
        self.inserts: list[tuple] = []

    async def execute(self, _sql, params):
        self.inserts.append(params)


def _fake_branch_exec_sql(bu_codes: dict, valid_branch_ids_by_schema: dict):
    """bu_codes: {bu_id: bu_schema_code}. valid_branch_ids_by_schema: {schema: {branch_id, ...}}
    — CHECK_BRANCH_IDS_EXIST is answered per-schema, so a branch valid in one BU's
    schema but not another is exactly what catches a cross-BU branch id."""

    async def _fake(db_name=None, schema=None, sql=None, sql_args=None, **_kwargs):
        if sql == SqlStore.GET_BU_CODE_BY_ID:
            code = bu_codes.get(sql_args["id"])
            return [{"code": code}] if code else []
        if sql == SqlStore.CHECK_BRANCH_IDS_EXIST:
            valid = valid_branch_ids_by_schema.get(schema, set())
            return [{"id": i} for i in sql_args["ids"] if i in valid]
        return []

    return _fake


@pytest.mark.asyncio
async def test_branch_restrictions_are_validated_and_saved_per_bu(monkeypatch):
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _fake_branch_exec_sql(
            bu_codes={1: "demo1", 2: "demo2"},
            valid_branch_ids_by_schema={"demo1": {10, 11}, "demo2": {20}},
        ),
    )
    cur = _FakeCursor()
    await ur._validate_and_save_branch_restrictions(
        cur, "db", user_id=9, branch_ids_by_bu={1: [10, 11], 2: [20]}
    )
    # Read back what was actually persisted — every (user_id, bu_id, branch_id)
    # asked for, and nothing else, each looked up against its OWN BU's schema.
    assert cur.inserts == [(9, 1, 10), (9, 1, 11), (9, 2, 20)]


@pytest.mark.asyncio
async def test_branch_from_a_different_bu_is_rejected(monkeypatch):
    # Branch 99 is real, but only inside demo2's schema — asking for it under BU 1
    # (demo1) must fail rather than silently attach it to the wrong BU.
    monkeypatch.setattr(
        ur,
        "exec_sql",
        _fake_branch_exec_sql(
            bu_codes={1: "demo1"},
            valid_branch_ids_by_schema={"demo2": {99}},
        ),
    )
    cur = _FakeCursor()
    with pytest.raises(ur.ValidationException):
        await ur._validate_and_save_branch_restrictions(
            cur, "db", user_id=9, branch_ids_by_bu={1: [99]}
        )
    assert cur.inserts == []


@pytest.mark.asyncio
async def test_unknown_bu_id_raises_not_found(monkeypatch):
    monkeypatch.setattr(ur, "exec_sql", _fake_branch_exec_sql(bu_codes={}, valid_branch_ids_by_schema={}))
    cur = _FakeCursor()
    with pytest.raises(ur.ValidationException):
        await ur._validate_and_save_branch_restrictions(
            cur, "db", user_id=9, branch_ids_by_bu={404: [1]}
        )
    assert cur.inserts == []


@pytest.mark.asyncio
async def test_no_restriction_writes_nothing(monkeypatch):
    # Every existing user's default today: an absent bu_id, or one with an empty
    # list, must behave exactly as before — no lookup, no write, all branches.
    calls: list = []

    async def _fake(db_name=None, schema=None, sql=None, sql_args=None, **_kwargs):
        calls.append(sql)
        return []

    monkeypatch.setattr(ur, "exec_sql", _fake)
    cur = _FakeCursor()

    await ur._validate_and_save_branch_restrictions(cur, "db", user_id=9, branch_ids_by_bu={})
    await ur._validate_and_save_branch_restrictions(cur, "db", user_id=9, branch_ids_by_bu=None)
    await ur._validate_and_save_branch_restrictions(cur, "db", user_id=9, branch_ids_by_bu={1: []})

    assert calls == []
    assert cur.inserts == []
