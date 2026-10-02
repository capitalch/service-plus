"""Unit tests for auth_guards.py's tenant/BU-membership guards — no DB, no network."""
from types import SimpleNamespace

import pytest

from app.core.exceptions import AuthorizationException
from app.graphql.resolvers.auth_guards import require_bu_access, require_own_tenant, require_user_type


def _info(**context):
    return SimpleNamespace(context=context)


# ── require_own_tenant ──────────────────────────────────────────────────────

def test_require_own_tenant_allows_matching_db_name():
    require_own_tenant(_info(user_type="B", db_name="service_plus_demo"), "service_plus_demo")


def test_require_own_tenant_rejects_mismatched_db_name():
    with pytest.raises(AuthorizationException) as exc:
        require_own_tenant(_info(user_type="B", db_name="service_plus_demo"), "service_plus_other")
    assert exc.value.extensions.get("reason") == "tenant_mismatch"


def test_require_own_tenant_admin_is_not_a_cross_tenant_bypass():
    with pytest.raises(AuthorizationException):
        require_own_tenant(_info(user_type="A", db_name="service_plus_demo"), "service_plus_other")


def test_require_own_tenant_bypasses_for_super_admin():
    require_own_tenant(_info(user_type="S", db_name=None), "anything_at_all")


def test_require_own_tenant_rejects_on_bad_token():
    with pytest.raises(AuthorizationException):
        require_own_tenant(_info(auth_error="expired"), "service_plus_demo")


# ── require_bu_access ────────────────────────────────────────────────────────

def test_require_bu_access_allows_membership():
    require_bu_access(_info(user_type="B", bu_codes=["capitalelectronics"]), "capitalelectronics")


def test_require_bu_access_is_case_insensitive():
    require_bu_access(_info(user_type="B", bu_codes=["capitalelectronics"]), "CapitalElectronics")


def test_require_bu_access_rejects_non_member_bu():
    with pytest.raises(AuthorizationException) as exc:
        require_bu_access(_info(user_type="B", bu_codes=["capitalelectronics"]), "navtechnology")
    assert exc.value.extensions.get("reason") == "bu_mismatch"


def test_require_bu_access_fails_closed_on_missing_claim():
    # Pre-fix token: no bu_codes claim at all -> treated as [] -> must reject.
    with pytest.raises(AuthorizationException):
        require_bu_access(_info(user_type="B"), "capitalelectronics")


@pytest.mark.parametrize("schema", [None, "", "public", "PUBLIC", "security", "Security"])
def test_require_bu_access_allows_tenant_wide_schemas_even_with_empty_bu_codes(schema):
    require_bu_access(_info(user_type="B", bu_codes=[]), schema)


@pytest.mark.parametrize("user_type", ["S", "A"])
def test_require_bu_access_bypasses_for_admin_and_super_admin(user_type):
    require_bu_access(_info(user_type=user_type, bu_codes=[]), "any_bu_not_owned")


def test_require_bu_access_rejects_on_bad_token():
    with pytest.raises(AuthorizationException):
        require_bu_access(_info(auth_error="expired"), "capitalelectronics")


# ── require_user_type ────────────────────────────────────────────────────────

def test_require_user_type_allows_a_listed_type():
    require_user_type(_info(user_type="S"), {"S"})


def test_require_user_type_rejects_an_unlisted_type():
    with pytest.raises(AuthorizationException) as exc:
        require_user_type(_info(user_type="A"), {"S"})
    assert exc.value.extensions.get("required_user_type") == ["S"]


def test_require_user_type_has_no_bypass_for_super_admin():
    # Unlike require_access_right/require_bu_access, this checks identity
    # directly — S is not automatically let through unless it's in `allowed`.
    with pytest.raises(AuthorizationException):
        require_user_type(_info(user_type="S"), {"A"})


def test_require_user_type_rejects_on_bad_token():
    with pytest.raises(AuthorizationException):
        require_user_type(_info(auth_error="expired"), {"S"})


# ── Step 1 (plans/plan.md): every resolver guarded, sqlId allowlists ─────────
import inspect
import json
import re
from pathlib import Path
from urllib.parse import quote

from app.graphql.resolvers.auth_guards import (
    ADMIN_ONLY_SQL_IDS,
    NON_ADMIN_SECURITY_SQL_IDS,
    require_authenticated,
    require_sql_id_access,
)
from app.graphql.resolvers import mutation as mutation_module
from app.graphql.resolvers import query as query_module

# Resolvers deliberately reachable without any guard. Keep empty unless a resolver
# is truly public; anything unauthenticated belongs on REST (website/auth routers).
PUBLIC_ON_PURPOSE: set[str] = set()

_GUARD_CALL = re.compile(r"\brequire_\w+\(\s*info\b")

_BU_USER = {"user_type": "B", "db_name": "service_plus_demo", "bu_codes": ["demo1"], "access_rights": []}


def _value(payload: dict) -> str:
    return quote(json.dumps(payload))


def _registered_resolvers():
    for kind, bindable in (("Mutation", mutation_module.mutation), ("Query", query_module.query)):
        for field, fn in bindable._resolvers.items():  # pylint: disable=protected-access
            yield f"{kind}.{field}", fn


def test_every_resolver_calls_a_guard():
    unguarded = [
        name
        for name, fn in _registered_resolvers()
        if name.split(".", 1)[1] not in PUBLIC_ON_PURPOSE
        and not _GUARD_CALL.search(inspect.getsource(inspect.unwrap(fn)))
    ]
    assert not unguarded, f"Resolvers with no require_* guard: {unguarded}"


def test_require_authenticated_rejects_missing_token():
    with pytest.raises(AuthorizationException) as exc:
        require_authenticated(_info(user_type=None))
    assert exc.value.extensions.get("reason") == "unauthenticated"


def test_require_authenticated_keeps_token_expired_code():
    with pytest.raises(AuthorizationException) as exc:
        require_authenticated(_info(auth_error="expired"))
    assert exc.value.code == "TOKEN_EXPIRED"


def test_allowlisted_security_ids_are_real_tenant_wide_ids():
    # A stale allowlist entry (renamed id, or one no longer touching security.) is noise.
    assert NON_ADMIN_SECURITY_SQL_IDS <= ADMIN_ONLY_SQL_IDS


@pytest.mark.parametrize("sql_id", ["RESET_ADMIN_PASSWORD", "GET_BUSINESS_USERS", "GET_ADMIN_USERS"])
def test_business_user_cannot_run_security_ids(sql_id):
    with pytest.raises(AuthorizationException) as exc:
        require_sql_id_access(_info(**_BU_USER), sql_id)
    assert exc.value.extensions.get("reason") == "admin_only_sql_id"


@pytest.mark.parametrize("user_type", ["S", "A"])
def test_admins_may_run_security_ids(user_type):
    require_sql_id_access(_info(user_type=user_type), "GET_BUSINESS_USERS")


def test_business_user_may_run_allowlisted_and_bu_ids():
    require_sql_id_access(_info(**_BU_USER), "GET_JOB_TRANSACTIONS_BY_JOB")
    require_sql_id_access(_info(**_BU_USER), "NOT_A_SECURITY_ID")


@pytest.mark.parametrize("sql_id", ["RESET_ADMIN_PASSWORD", "GET_BUSINESS_USERS", "GET_ADMIN_USERS"])
async def test_generic_query_refuses_security_ids_with_own_bu_code(sql_id):
    with pytest.raises(AuthorizationException):
        await query_module.resolve_generic_query(
            None, _info(**_BU_USER), db_name="service_plus_demo", schema="demo1", value=_value({"sqlId": sql_id})
        )


async def test_generic_batch_query_refuses_a_security_id_item():
    items = [_value({"sqlId": "GET_BUSINESS_USERS", "schema": "demo1"})]
    with pytest.raises(AuthorizationException):
        await query_module.resolve_generic_batch_query(None, _info(**_BU_USER), db_name="service_plus_demo", items=items)


async def test_generic_update_script_is_deny_by_default_for_business_users():
    with pytest.raises(AuthorizationException) as exc:
        await mutation_module.resolve_generic_update_script(
            None,
            _info(**_BU_USER),
            db_name="service_plus_demo",
            schema="demo1",
            value=_value({"sql_id": "RESET_ADMIN_PASSWORD", "sql_args": {}}),
        )
    assert exc.value.extensions.get("reason") == "script_not_allowed"


def test_generic_update_script_rights_still_apply():
    info = _info(**_BU_USER)
    with pytest.raises(AuthorizationException) as exc:
        mutation_module._require_generic_update_script_right(  # pylint: disable=protected-access
            info, _value({"sql_id": "SET_PART_LOCATIONS"})
        )
    assert exc.value.extensions.get("required_access_right") == "INVENTORY_SET_PART_LOCATION"
    mutation_module._require_generic_update_script_right(  # pylint: disable=protected-access
        info, _value({"sql_id": "DELETE_PURCHASE_INVOICE"})
    )


_NO_TOKEN_CALLS = [
    (mutation_module.resolve_drop_database, {"db_name": "service_plus_demo", "value": "x"}),
    (mutation_module.resolve_delete_client, {"db_name": "", "value": "x"}),
    (mutation_module.resolve_create_client, {"db_name": "", "value": "x"}),
    (mutation_module.resolve_create_single_job, {"db_name": "service_plus_demo", "schema": "demo1", "value": "x"}),
    (query_module.resolve_super_admin_clients_data, {}),
    (query_module.resolve_audit_logs, {}),
]


@pytest.mark.parametrize("resolver,kwargs", _NO_TOKEN_CALLS, ids=lambda x: getattr(x, "__name__", ""))
async def test_rejected_without_a_token(resolver, kwargs):
    with pytest.raises(AuthorizationException):
        await resolver(None, _info(), **kwargs)


@pytest.mark.parametrize(
    "resolver",
    [mutation_module.resolve_drop_database, mutation_module.resolve_delete_client, mutation_module.resolve_create_client],
)
async def test_admin_cannot_call_super_admin_only(resolver):
    with pytest.raises(AuthorizationException):
        await resolver(None, _info(user_type="A", db_name="service_plus_demo"), db_name="service_plus_demo", value="x")


@pytest.mark.parametrize(
    "db_name,schema", [("service_plus_demo", "otherbu"), ("service_plus_other", "demo1")], ids=["other-bu", "other-tenant"]
)
@pytest.mark.parametrize(
    "resolver",
    [mutation_module.resolve_create_single_job, mutation_module.resolve_create_job_invoice],
)
async def test_bu_user_cannot_write_another_bu_or_tenant(resolver, db_name, schema):
    with pytest.raises(AuthorizationException):
        await resolver(None, _info(**_BU_USER), db_name=db_name, schema=schema, value="x")


# Non-admin client code: the client screens plus shared code they use. Admin and
# Super Admin features are excluded — their callers are A/S and bypass the list.
_CLIENT_SRC = Path(__file__).resolve().parents[2] / "service-plus-client" / "src"
_NON_ADMIN_DIRS = ["features/client", "components", "lib", "store"]
_SQL_ID_REF = re.compile(r"SQL_MAP\.([A-Z0-9_]+)|sqlId:\s*\"([A-Z0-9_]+)\"")


@pytest.mark.skipif(not _CLIENT_SRC.is_dir(), reason="client checkout not alongside the server")
def test_non_admin_client_screens_use_no_unlisted_security_ids():
    used: set[str] = set()
    for sub in _NON_ADMIN_DIRS:
        for path in (_CLIENT_SRC / sub).rglob("*.ts*"):
            for a, b in _SQL_ID_REF.findall(path.read_text(encoding="utf-8")):
                used.add(a or b)
    blocked = (used & ADMIN_ONLY_SQL_IDS) - NON_ADMIN_SECURITY_SQL_IDS
    assert not blocked, f"Non-admin client code uses admin-only sqlIds: {sorted(blocked)}"
