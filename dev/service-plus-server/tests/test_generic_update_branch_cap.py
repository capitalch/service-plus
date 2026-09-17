"""Unit tests for _require_basic_tier_branch_cap (plans/plan.md, Step 8) — no
real DB: exec_sql is monkeypatched to return canned rows."""
import json
from urllib.parse import quote

import pytest

from app.db.sql.sql_base import SqlStore
from app.graphql.resolvers import mutation as m


def _stub_exec_sql(responses: dict):
    async def _fake(db_name=None, schema=None, sql=None, sql_args=None, **_kwargs):
        return responses.get(sql, [])

    return _fake


def _branch_value(with_id: bool = False, is_id_insert: bool = False) -> str:
    x_data = {"name": "New Branch"}
    if with_id:
        x_data["id"] = 5
    if is_id_insert:
        x_data["isIdInsert"] = True
    return quote(json.dumps({"tableName": "branch", "xData": x_data}))


@pytest.mark.asyncio
async def test_basic_tier_rejects_a_second_branch(monkeypatch):
    monkeypatch.setattr(
        m,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BRANCHES: [{"branch_count": 1}],
            }
        ),
    )
    with pytest.raises(m.ValidationException):
        await m._require_basic_tier_branch_cap("db", "demo1", _branch_value())


@pytest.mark.asyncio
async def test_basic_tier_allows_the_first_branch(monkeypatch):
    monkeypatch.setattr(
        m,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BRANCHES: [{"branch_count": 0}],
            }
        ),
    )
    await m._require_basic_tier_branch_cap("db", "demo1", _branch_value())


@pytest.mark.asyncio
async def test_pro_tier_has_no_branch_cap(monkeypatch):
    monkeypatch.setattr(
        m,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "PRO"}],
                SqlStore.COUNT_BRANCHES: [{"branch_count": 4}],
            }
        ),
    )
    await m._require_basic_tier_branch_cap("db", "demo1", _branch_value())


@pytest.mark.asyncio
async def test_editing_the_existing_branch_is_always_allowed(monkeypatch):
    # An UPDATE (real id, no isIdInsert) never counts against the cap, even at
    # the limit — this only blocks a NEW branch, not editing the one you have.
    monkeypatch.setattr(
        m,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BRANCHES: [{"branch_count": 1}],
            }
        ),
    )
    await m._require_basic_tier_branch_cap("db", "demo1", _branch_value(with_id=True))


@pytest.mark.asyncio
async def test_an_explicit_id_insert_still_counts_as_new(monkeypatch):
    # isIdInsert forces an explicit-id INSERT despite carrying an id — still a
    # new row for the cap's purposes.
    monkeypatch.setattr(
        m,
        "exec_sql",
        _stub_exec_sql(
            {
                SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME: [{"subscription_tier": "BASIC"}],
                SqlStore.COUNT_BRANCHES: [{"branch_count": 1}],
            }
        ),
    )
    with pytest.raises(m.ValidationException):
        await m._require_basic_tier_branch_cap(
            "db", "demo1", _branch_value(with_id=True, is_id_insert=True)
        )


@pytest.mark.asyncio
async def test_other_tables_are_never_touched_by_this_check(monkeypatch):
    # Sanity: a non-"branch" table never triggers the tier/count lookups at all.
    async def _explode(**_kwargs):
        raise AssertionError("exec_sql should not be called for a non-branch table")

    monkeypatch.setattr(m, "exec_sql", _explode)
    value = quote(json.dumps({"tableName": "division", "xData": {"name": "X"}}))
    await m._require_basic_tier_branch_cap("db", "demo1", value)
