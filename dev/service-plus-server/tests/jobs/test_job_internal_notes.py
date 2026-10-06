"""Internal notes on jobs (plans/plan.md, Step 3) — no DB: writes and lookups are stubbed."""
import asyncio
import json
from types import SimpleNamespace
from urllib.parse import quote

import pytest

from app.core.exceptions import AuthorizationException, ValidationException
from app.db.sql.sql_base import SqlStore
from app.db.sql.sql_job_internal_notes import JobInternalNoteServerSql
from app.graphql.resolvers import mutation as mutation_module
from app.graphql.resolvers.auth_guards import require_generic_update_access
from app.graphql.resolvers.jobs import mutations as jobs_mutations
from app.graphql.resolvers.jobs.mutations import INTERNAL_NOTE_MAX, _clean_note


def _info(**context):
    return SimpleNamespace(context=context)


def _value(obj) -> str:
    return quote(json.dumps(obj))


BUSINESS = {"bu_codes": ["demo1"], "db_name": "service_plus_demo", "user_id": 7, "user_type": "B"}


@pytest.fixture
def stubbed(monkeypatch):
    """Stub the BU billing check and every helper write; record what the helpers got."""
    calls: list[tuple[str, int | None]] = []

    async def writable(*_args):
        return None

    def helper(name):
        async def fake(_db, _schema, _value, user_id):
            calls.append((name, user_id))
            return {"ok": True}

        return fake

    monkeypatch.setattr(mutation_module, "require_bu_writable", writable)
    monkeypatch.setattr(mutation_module, "add_job_internal_note", helper("add"))
    monkeypatch.setattr(mutation_module, "update_job_internal_note", helper("update"))
    monkeypatch.setattr(mutation_module, "delete_job_internal_note", helper("delete"))
    return calls


def _run(resolver, context):
    return asyncio.run(resolver(None, _info(**context), "service_plus_demo", "demo1", _value({})))


# ── _clean_note ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("note", ["", "    ", None])
def test_clean_note_rejects_empty(note):
    with pytest.raises(ValidationException):
        _clean_note({"note": note})


def test_clean_note_rejects_over_limit():
    with pytest.raises(ValidationException):
        _clean_note({"note": "x" * (INTERNAL_NOTE_MAX + 1)})


def test_clean_note_trims_and_keeps_limit():
    assert _clean_note({"note": "  hello  "}) == "hello"
    assert len(_clean_note({"note": "x" * INTERNAL_NOTE_MAX})) == INTERNAL_NOTE_MAX


# ── genericUpdate cannot reach the table ─────────────────────────────────────

def test_generic_update_refuses_top_level_table():
    payload = {"tableName": "job_internal_note", "xData": {"job_id": 1, "note": "x", "created_by": 1}}
    with pytest.raises(AuthorizationException) as exc:
        require_generic_update_access(_info(**BUSINESS), "demo1", _value(payload))
    assert exc.value.extensions.get("reason") == "server_only_table"


def test_generic_update_refuses_nested_table():
    payload = {
        "tableName": "job",
        "xData": {"id": 1, "remarks": "x", "xDetails": {"tableName": "job_internal_note", "fkeyName": "job_id",
                                                        "xData": {"note": "x", "created_by": 1}}},
    }
    with pytest.raises(AuthorizationException):
        require_generic_update_access(_info(**BUSINESS), "demo1", _value(payload))


def test_generic_update_refuses_even_super_admin():
    payload = {"tableName": "job_internal_note", "deletedIds": [1], "xData": {}}
    with pytest.raises(AuthorizationException):
        require_generic_update_access(_info(user_type="S"), "demo1", _value(payload))


# ── who may add / edit / delete ──────────────────────────────────────────────

def test_any_business_user_may_add(stubbed):
    _run(mutation_module.resolve_add_job_internal_note, {**BUSINESS, "access_rights": []})
    assert stubbed == [("add", 7)]


@pytest.mark.parametrize(
    "resolver",
    [mutation_module.resolve_update_job_internal_note, mutation_module.resolve_delete_job_internal_note],
)
def test_edit_and_delete_need_the_right(stubbed, resolver):
    with pytest.raises(AuthorizationException) as exc:
        _run(resolver, {**BUSINESS, "access_rights": ["JOBS_RECEIPTS"]})
    assert exc.value.extensions.get("required_access_right") == "JOBS_INTERNAL_NOTES_MANAGE"
    assert stubbed == []


@pytest.mark.parametrize(
    "resolver",
    [mutation_module.resolve_update_job_internal_note, mutation_module.resolve_delete_job_internal_note],
)
def test_edit_and_delete_allowed_with_right_or_admin(stubbed, resolver):
    _run(resolver, {**BUSINESS, "access_rights": ["JOBS_INTERNAL_NOTES_MANAGE"]})
    _run(resolver, {"db_name": "service_plus_demo", "user_id": 1, "user_type": "A"})
    assert [c[1] for c in stubbed] == [7, 1]


# ── the add helper never writes an existing row; ids come from the session ──

def test_add_ignores_payload_id_and_author(monkeypatch):
    seen = {}

    async def fake_exec_sql(**kwargs):
        seen.update(kwargs)
        return [{"created_at": "2026-10-06T10:00:00+05:30", "id": 5}]

    async def fake_staff_name(_db, user_id):
        return f"user{user_id}"

    monkeypatch.setattr(jobs_mutations, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(jobs_mutations, "staff_name", fake_staff_name)
    payload = {"branch_id": 2, "by": 99, "by_name": "forged", "id": 123, "job_id": 3, "note": " hi "}
    result = asyncio.run(jobs_mutations.add_job_internal_note("db", "demo1", _value(payload), 7))
    assert result["ok"] is True
    assert seen["sql"] == JobInternalNoteServerSql.ADD_JOB_INTERNAL_NOTE
    assert seen["sql_args"] == {"branch_id": 2, "by": 7, "by_name": "user7", "job_id": 3, "note": "hi"}


def test_missing_job_is_reported(monkeypatch):
    async def fake_exec_sql(**_kwargs):
        return []

    async def fake_staff_name(_db, _user_id):
        return None

    monkeypatch.setattr(jobs_mutations, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(jobs_mutations, "staff_name", fake_staff_name)
    payload = {"branch_id": 2, "id": 9, "note": "x"}
    result = asyncio.run(jobs_mutations.update_job_internal_note("db", "demo1", _value(payload), 7))
    assert result == {"ok": False, "reason": "NOTE_NOT_FOUND"}


# ── never printed: the print query does not touch the table; writes not in SqlStore ──

def test_job_detail_never_reads_notes():
    assert "job_internal_note" in SqlStore.GET_JOB_INTERNAL_NOTES
    assert "job_internal_note" not in SqlStore.GET_JOB_DETAIL


def test_writes_are_not_reachable_through_generic_query():
    for name in ("ADD_JOB_INTERNAL_NOTE", "UPDATE_JOB_INTERNAL_NOTE", "DELETE_JOB_INTERNAL_NOTE"):
        assert not hasattr(SqlStore, name)
