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
def test_require_bu_access_refuses_tenant_wide_schemas_to_business_users(schema):
    # plans/plan.md Step 6: security/public/empty reach the whole tenant.
    with pytest.raises(AuthorizationException) as exc:
        require_bu_access(_info(user_type="B", bu_codes=["demo1"]), schema)
    assert exc.value.extensions.get("reason") == "tenant_wide_schema"


@pytest.mark.parametrize("schema", [None, "", "public", "security"])
@pytest.mark.parametrize("user_type", ["S", "A"])
def test_require_bu_access_lets_admins_use_tenant_wide_schemas(user_type, schema):
    require_bu_access(_info(user_type=user_type, bu_codes=[]), schema)


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
import asyncio
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



# ── Step 6 (plans/plan.md): shared-database security fixes ───────────────────
from fastapi import HTTPException

from app.core.security import create_access_token
from app.graphql.resolvers import subscription as subscription_module
from app.graphql.resolvers.auth_guards import (
    BU_BILLING_COLUMNS,
    SECURITY_SERVER_ONLY_TABLES,
    require_generic_update_access,
    subscriber_may_receive,
)
from app.graphql.schema import WS_CLAIMS_SCOPE_KEY, get_graphql_context, on_ws_connect
from app.routers.media.image_router import _require_media_scope

_BU_USER_7 = {**_BU_USER, "user_id": "7"}
_ADMIN = {"user_type": "A", "db_name": "service_plus_demo", "bu_codes": [], "access_rights": [], "user_id": "1"}


def _update(table: str, x_data, **extra) -> str:
    return _value({"tableName": table, "xData": x_data, **extra})


@pytest.mark.parametrize(
    "value",
    [
        _update("user", {"id": 7, "is_admin": True}),
        _update("user_bu_role", {"user_id": 7, "bu_id": 2, "role_id": 1}),
        _update("user", {"id": 1, "last_used_bu_id": 2}),  # someone else's row
        _update("user", {"id": 7, "last_used_bu_id": 2, "is_admin": True}),  # extra column
        _update("user", {"id": 7, "last_used_bu_id": 2}, deletedIds=[1]),
        _update("user", [{"id": 7, "last_used_bu_id": 2}]),  # list form
    ],
)
def test_business_user_cannot_write_security_tables(value):
    with pytest.raises(AuthorizationException):
        require_generic_update_access(_info(**_BU_USER_7), "security", value)


def test_business_user_may_save_own_last_used_bu_and_branch():
    value = _update("user", {"id": 7, "last_used_branch_id": 3, "last_used_bu_id": 2})
    require_generic_update_access(_info(**_BU_USER_7), "security", value)


@pytest.mark.parametrize("table", sorted(SECURITY_SERVER_ONLY_TABLES))
@pytest.mark.parametrize("ctx", [_BU_USER_7, _ADMIN, {"user_type": "S"}], ids=["B", "A", "S"])
@pytest.mark.parametrize("schema", ["security", "public", "demo1"])
def test_server_only_tables_refused_to_everyone(table, ctx, schema):
    with pytest.raises(AuthorizationException) as exc:
        require_generic_update_access(_info(**ctx), schema, _update(table, {"id": 1, "status": "approved"}))
    assert exc.value.extensions.get("reason") == "server_only_table"


def test_server_only_table_refused_when_nested():
    value = _update("job", {"id": 1, "xDetails": [{"tableName": "x", "xData": {"xDetails": {"tableName": "sales_enquiry", "xData": {"id": 1}}}}]})
    with pytest.raises(AuthorizationException):
        require_generic_update_access(_info(**_ADMIN), "demo1", value)


@pytest.mark.parametrize("column", sorted(BU_BILLING_COLUMNS))
def test_admin_cannot_write_bu_billing_columns(column):
    with pytest.raises(AuthorizationException) as exc:
        require_generic_update_access(_info(**_ADMIN), "security", _update("bu", {"id": 1, column: None}))
    assert exc.value.extensions.get("reason") == "billing_columns"


@pytest.mark.parametrize("x_data", [{"id": 1, "name": "Nav Technology"}, {"id": 1, "is_active": False}])
def test_admin_bu_dialogs_still_write(x_data):
    # edit / activate / deactivate BU dialogs send only these columns.
    require_generic_update_access(_info(**_ADMIN), "security", _update("bu", x_data))
    require_generic_update_access(_info(**_ADMIN), "security", _update("bu", {}, deletedIds=[1]))


def test_business_user_bu_schema_writes_unchanged():
    require_generic_update_access(_info(**_BU_USER_7), "demo1", _update("job", {"id": 1, "remarks": "x"}))
    with pytest.raises(AuthorizationException):
        require_generic_update_access(_info(**_BU_USER_7), "otherbu", _update("job", {"id": 1}))


async def test_generic_update_resolver_refuses_is_admin_edit():
    with pytest.raises(AuthorizationException):
        await mutation_module.resolve_generic_update(
            None, _info(**_BU_USER_7), db_name="service_plus_demo", schema="security", value=_update("user", {"id": 7, "is_admin": True})
        )


@pytest.mark.parametrize("schema", ["security", "public", "", "otherbu"])
async def test_generic_query_refuses_tenant_wide_or_foreign_schema(schema):
    with pytest.raises(AuthorizationException):
        await query_module.resolve_generic_query(
            None, _info(**_BU_USER), db_name="service_plus_demo", schema=schema, value=_value({"sqlId": "GET_BU_BRANCHES"})
        )


async def test_generic_update_script_refuses_security_schema_to_business_users():
    with pytest.raises(AuthorizationException):
        await mutation_module.resolve_generic_update_script(
            None, _info(**_BU_USER), db_name="service_plus_demo", schema="security",
            value=_value({"sql_id": "DELETE_PURCHASE_INVOICE", "sql_args": {}}),
        )


# Subscriptions ───────────────────────────────────────────────────────────────

_EVENT = {"db_name": "service_plus_demo", "schema": "demo1"}


@pytest.mark.parametrize(
    "ctx,event,expected",
    [
        (_BU_USER, _EVENT, True),
        (_BU_USER, {**_EVENT, "schema": "DEMO1"}, True),
        (_BU_USER, {**_EVENT, "schema": "otherbu"}, False),
        (_BU_USER, {"db_name": "service_plus_demo"}, False),  # no schema: fails closed
        (_BU_USER, {**_EVENT, "db_name": "service_plus_other"}, False),
        (_ADMIN, {**_EVENT, "schema": "otherbu"}, True),
        (_ADMIN, {**_EVENT, "db_name": "service_plus_other"}, False),
        ({"user_type": "S"}, {**_EVENT, "db_name": "service_plus_other"}, True),
        ({}, _EVENT, False),
        ({**_BU_USER, "auth_error": "expired"}, _EVENT, False),
    ],
)
def test_subscriber_may_receive(ctx, event, expected):
    assert subscriber_may_receive(ctx, event) is expected


@pytest.mark.parametrize(
    "source,kwargs",
    [
        (subscription_module.whatsapp_delivery_status_source, {"db_name": "service_plus_other"}),
        (subscription_module.accounts_posting_progress_source, {"db_name": "service_plus_other", "branchId": "1"}),
        (subscription_module.sales_enquiry_count_source, {"db_name": "service_plus_demo"}),  # business user
    ],
)
async def test_subscription_sources_refuse_foreign_or_non_admin_callers(source, kwargs):
    with pytest.raises(AuthorizationException):
        await source(None, _info(**_BU_USER), **kwargs)


@pytest.mark.parametrize(
    "source,kwargs",
    [
        (subscription_module.whatsapp_delivery_status_source, {"db_name": "service_plus_demo"}),
        (subscription_module.accounts_posting_progress_source, {"db_name": "service_plus_demo", "branchId": "1"}),
        (subscription_module.sales_enquiry_count_source, {"db_name": "service_plus_demo"}),
    ],
)
async def test_subscription_sources_refuse_a_socket_without_token(source, kwargs):
    with pytest.raises(AuthorizationException):
        await source(None, _info(), **kwargs)


async def test_business_user_gets_no_other_bu_events():
    stream = await subscription_module.whatsapp_delivery_status_source(None, _info(**_BU_USER), db_name="service_plus_demo")
    received = []

    async def consume():
        async for data in stream:
            received.append(data)
            break

    task = asyncio.ensure_future(consume())
    await asyncio.sleep(0)
    await subscription_module.pubsub.publish("whatsapp_delivery_status", {**_EVENT, "schema": "otherbu", "job_id": 1})
    await subscription_module.pubsub.publish("whatsapp_delivery_status", {**_EVENT, "job_id": 2})
    await asyncio.wait_for(task, 1)
    assert [d["job_id"] for d in received] == [2]


def test_subscription_sources_are_guarded():
    sources = [subscription_module.whatsapp_delivery_status_source, subscription_module.accounts_posting_progress_source,
               subscription_module.sales_enquiry_count_source]
    for fn in sources:
        assert _GUARD_CALL.search(inspect.getsource(fn)), fn.__name__


class _FakeSocket:
    def __init__(self):
        self.scope: dict = {}


@pytest.mark.parametrize("payload", [None, {}, {"Authorization": "Bearer not-a-jwt"}, {"Authorization": "Basic x"}])
def test_ws_connect_rejects_missing_or_bad_token(payload):
    with pytest.raises(AuthorizationException):
        on_ws_connect(_FakeSocket(), payload)


async def test_ws_connect_keeps_claims_for_the_socket_context():
    token = create_access_token({"sub": "7", "user_type": "B", "db_name": "service_plus_demo", "bu_codes": ["demo1"]})
    socket = _FakeSocket()
    on_ws_connect(socket, {"Authorization": f"Bearer {token}"})
    assert socket.scope[WS_CLAIMS_SCOPE_KEY]["db_name"] == "service_plus_demo"
    context = await get_graphql_context(socket, None)
    assert context["user_type"] == "B" and context["bu_codes"] == ["demo1"]


# Media ───────────────────────────────────────────────────────────────────────

_BU_CLAIMS = {"user_type": "B", "db_name": "service_plus_demo", "bu_codes": ["demo1"], "client_id": 1}


@pytest.mark.parametrize(
    "db_name,schema,bu_code",
    [
        ("service_plus_demo", "otherbu", None),
        ("service_plus_other", "demo1", None),
        ("service_plus_demo", "security", None),
        ("service_plus_demo", "demo1", "otherbu"),
    ],
    ids=["other-bu", "other-tenant", "security", "bu-code-mismatch"],
)
async def test_media_writes_refused_outside_own_bu(db_name, schema, bu_code):
    with pytest.raises(HTTPException) as exc:
        await _require_media_scope(_BU_CLAIMS, db_name, schema, bu_code=bu_code)
    assert exc.value.status_code == 403


async def test_media_writes_allowed_in_own_bu():
    await _require_media_scope(_BU_CLAIMS, "service_plus_demo", "demo1", bu_code="DEMO1")
    await _require_media_scope({**_BU_CLAIMS, "user_type": "A", "bu_codes": []}, "service_plus_demo", "otherbu")
    await _require_media_scope({"user_type": "S"}, "service_plus_other", "x", client_code="y", bu_code="z")
