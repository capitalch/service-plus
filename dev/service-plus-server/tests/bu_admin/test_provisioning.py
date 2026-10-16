"""
Smoke test for the Step 4 resolver split: bu_admin/users_roles.py.

resolve_create_admin_user_helper inserts a real security.user row and sends a
real password-reset email via SMTP. Skipped by default so importing/running
this test suite never creates real admin accounts or sends real email — see
plans/plan.md Step 6.2.

To actually exercise this against a disposable dev DB, remove the skip mark,
set _DEV_CLIENT_DB below to a throwaway client database, and use an email
address you control.
"""
import json
from urllib.parse import quote

import pytest

from app.graphql.resolvers.bu_admin.users_roles import resolve_create_admin_user_helper

_DEV_CLIENT_DB = "service_plus_demo"


@pytest.mark.skip(
    reason="Creates a real security.user row and sends a real reset-link email — "
    "enable explicitly against a disposable DB/inbox only."
)
@pytest.mark.asyncio
async def test_create_admin_user_creates_row_and_sends_email():
    payload = {
        "client_id": 1,
        "email": "test-admin@example.com",
        "full_name": "Test Admin",
        "mobile": "9999999999",
        "username": "test_admin_smoke",
    }
    value = quote(json.dumps(payload))

    result = await resolve_create_admin_user_helper(
        _DEV_CLIENT_DB, "security", value, request=None
    )

    assert "id" in result


# ── deleteBuSchema with delete_bu_row ─────────────────────────────────────────

def _stub_delete(monkeypatch, is_active=False, payments=0, signups=True):
    from app.db.sql.sql_base import SqlStore
    from app.db.sql.sql_signups import SignupServerSql
    from app.graphql.resolvers.bu_admin import provisioning

    calls = []

    async def fake_exec_sql(db_name=None, schema=None, sql=None, sql_args=None):
        calls.append(sql)
        if sql == SignupServerSql.GET_BU_DELETE_CHECK:
            return [{"is_active": is_active, "payments": payments}]
        if sql == SignupServerSql.HAS_SALES_ENQUIRY_TABLE:
            return [{"present": signups}]
        return []

    async def fake_dml(db_name=None, schema=None, sql=None, sql_args=None):
        calls.append("DROP SCHEMA")
        return 0

    async def fake_log(**kwargs):
        return None

    monkeypatch.setattr(provisioning, "exec_sql", fake_exec_sql)
    monkeypatch.setattr(provisioning, "exec_sql_dml", fake_dml)
    monkeypatch.setattr(provisioning.audit_logger, "log", fake_log)
    value = quote(json.dumps({"code": "business_002", "delete_bu_row": True}))
    return calls, value, provisioning, SqlStore, SignupServerSql


def test_delete_bu_releases_signups_and_deletes_the_row_before_the_schema(monkeypatch):
    import asyncio

    calls, value, provisioning, SqlStore, SignupServerSql = _stub_delete(monkeypatch)
    asyncio.run(provisioning.resolve_delete_bu_schema_helper("db", "security", value))
    assert calls == [
        SignupServerSql.GET_BU_DELETE_CHECK,
        SignupServerSql.HAS_SALES_ENQUIRY_TABLE,
        SignupServerSql.RELEASE_SALES_ENQUIRY_BU,
        SqlStore.DELETE_BU_BY_CODE,
        "DROP SCHEMA",
    ]


def test_delete_bu_skips_the_signup_release_without_the_table(monkeypatch):
    import asyncio

    calls, value, provisioning, _, SignupServerSql = _stub_delete(monkeypatch, signups=False)
    asyncio.run(provisioning.resolve_delete_bu_schema_helper("db", "security", value))
    assert SignupServerSql.RELEASE_SALES_ENQUIRY_BU not in calls and calls[-1] == "DROP SCHEMA"


@pytest.mark.parametrize("is_active, payments", [(True, 0), (False, 3)])
def test_delete_bu_refuses_an_active_or_paid_bu_and_keeps_the_schema(monkeypatch, is_active, payments):
    import asyncio

    from app.core.exceptions import ValidationException

    calls, value, provisioning, _, _ = _stub_delete(monkeypatch, is_active=is_active, payments=payments)
    with pytest.raises(ValidationException):
        asyncio.run(provisioning.resolve_delete_bu_schema_helper("db", "security", value))
    assert "DROP SCHEMA" not in calls
