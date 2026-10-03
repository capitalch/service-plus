"""Unit tests for resolvers/masters/branches.py's genericUpdate payload guards
(plans/plan2.md Step 2) — no DB, no network."""
import asyncio

import pytest

from app.core.exceptions import ValidationException
from app.graphql.resolvers.masters import branches
from app.graphql.resolvers.masters.branches import (
    division_ids_to_check,
    refuse_branch_insert,
    refuse_default_division_change,
)


# ── refuse_branch_insert ─────────────────────────────────────────────────────

def test_top_level_branch_insert_is_refused():
    with pytest.raises(ValidationException) as exc:
        refuse_branch_insert({"tableName": "branch", "xData": {"code": "BR2", "name": "Two"}})
    assert exc.value.code == "BRANCH_INSERT_VIA_ADD_BRANCH"


def test_nested_branch_insert_is_refused():
    payload = {
        "tableName": "technician",
        "xData": {"id": 3, "xDetails": [{"tableName": "branch", "xData": [{"code": "BR2"}]}]},
    }
    with pytest.raises(ValidationException):
        refuse_branch_insert(payload)


def test_branch_insert_with_explicit_id_is_refused():
    with pytest.raises(ValidationException):
        refuse_branch_insert({"tableName": "branch", "xData": {"id": 9, "isIdInsert": True}})


def test_branch_edit_and_delete_pass():
    refuse_branch_insert({"tableName": "branch", "xData": {"id": 2, "name": "Renamed"}})
    refuse_branch_insert({"tableName": "branch", "deletedIds": [2], "xData": {}})


def test_unreadable_payload_passes_through():
    refuse_branch_insert(None)
    refuse_branch_insert("not a dict")


# ── division_ids_to_check ────────────────────────────────────────────────────

def test_division_delete_ids_are_checked():
    assert division_ids_to_check({"tableName": "division", "deletedIds": [4], "xData": {}}) == [4]


def test_division_deactivate_is_checked_but_ordinary_edit_is_not():
    assert division_ids_to_check({"tableName": "division", "xData": {"id": 5, "is_active": False}}) == [5]
    assert division_ids_to_check({"tableName": "division", "xData": {"id": 5, "is_active": True, "name": "X"}}) == []


def test_division_move_to_another_branch_is_checked():
    assert division_ids_to_check({"tableName": "division", "xData": {"id": 6, "branch_id": 3}}) == [6]


def test_division_insert_is_not_checked():
    payload = {"tableName": "division", "xData": {"id": 7, "isIdInsert": True, "branch_id": 2, "code": "B"}}
    assert division_ids_to_check(payload) == []


def test_setting_is_default_is_refused_outright():
    with pytest.raises(ValidationException) as exc:
        division_ids_to_check({"tableName": "division", "xData": {"id": 2, "is_default": True}})
    assert exc.value.code == "DEFAULT_DIVISION_LOCKED"


def test_branch_delete_does_not_trip_the_division_guard():
    # Deleting a fresh branch cascades to its Main in the database; the payload names only the branch.
    assert division_ids_to_check({"tableName": "branch", "deletedIds": [9], "xData": {}}) == []


# ── refuse_default_division_change (DB lookup stubbed) ───────────────────────

def _stub_defaults(monkeypatch, default_ids):
    calls = []

    async def fake_exec_sql(db_name, schema, sql, sql_args):
        calls.append(sql_args["ids"])
        return [{"id": i} for i in sql_args["ids"] if i in default_ids]

    monkeypatch.setattr(branches, "exec_sql", fake_exec_sql)
    return calls


def test_deleting_a_default_division_is_refused(monkeypatch):
    _stub_defaults(monkeypatch, {1})
    with pytest.raises(ValidationException) as exc:
        asyncio.run(refuse_default_division_change("db", "bu", {"tableName": "division", "deletedIds": [1]}))
    assert exc.value.extensions["ids"] == [1]


def test_deleting_a_non_default_division_passes(monkeypatch):
    _stub_defaults(monkeypatch, {1})
    asyncio.run(refuse_default_division_change("db", "bu", {"tableName": "division", "deletedIds": [2]}))


def test_no_lookup_when_nothing_to_check(monkeypatch):
    calls = _stub_defaults(monkeypatch, {1})
    asyncio.run(refuse_default_division_change("db", "bu", {"tableName": "division", "xData": {"id": 1, "name": "M"}}))
    assert calls == []
