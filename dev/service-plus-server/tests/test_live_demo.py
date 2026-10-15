"""The live demo is read-only and silent (plans/plan.md Step 2) — no DB, Meta or SMTP: the
billing lookup, WhatsApp client, usage counter and SMTP send are stubbed."""
import asyncio
from types import SimpleNamespace

import pytest

from app.config import settings
from app.core import email as email_module
from app.core.exceptions import AuthorizationException
from app.graphql.resolvers.auth_guards import require_bu_writable
from app.services import bu_billing
from app.whatsapp import metered

DEMO_DB = "service_plus_demo_test"
DEMO_BU = "servicedemo"


@pytest.fixture(autouse=True)
def demo_settings(monkeypatch):
    monkeypatch.setattr(settings, "demo_bu_code", DEMO_BU)
    monkeypatch.setattr(settings, "demo_db_name", DEMO_DB)
    monkeypatch.setattr(settings, "demo_username", "demouser1")
    monkeypatch.setattr(settings, "demo_writable", False)


def _info(**context):
    return SimpleNamespace(context=context)


def _stub_billing(monkeypatch, status="active"):
    calls = []

    async def fake(db_name, schema):
        calls.append((db_name, schema))
        return {"branchLimit": None, "paidThrough": "2026-10-01", "planCode": "basic", "status": status}

    monkeypatch.setattr(bu_billing, "get_bu_billing", fake)
    return calls


# ── require_bu_writable ──────────────────────────────────────────────────────

@pytest.mark.parametrize("user_type", ["A", "B"])
def test_demo_bu_write_is_refused(monkeypatch, user_type):
    calls = _stub_billing(monkeypatch)
    with pytest.raises(AuthorizationException) as exc:
        asyncio.run(require_bu_writable(_info(user_type=user_type), DEMO_DB, DEMO_BU))
    assert exc.value.code == "DEMO_READ_ONLY"
    assert calls == []


def test_demo_beats_the_payment_message(monkeypatch):
    _stub_billing(monkeypatch, "read_only")
    with pytest.raises(AuthorizationException) as exc:
        asyncio.run(require_bu_writable(_info(user_type="B"), DEMO_DB, DEMO_BU))
    assert exc.value.code == "DEMO_READ_ONLY"


def test_super_admin_writes_to_demo(monkeypatch):
    _stub_billing(monkeypatch)
    asyncio.run(require_bu_writable(_info(user_type="S"), DEMO_DB, DEMO_BU))


def test_demo_writable_lets_visitors_write(monkeypatch):
    monkeypatch.setattr(settings, "demo_writable", True)
    _stub_billing(monkeypatch)
    asyncio.run(require_bu_writable(_info(user_type="B"), DEMO_DB, DEMO_BU))


@pytest.mark.parametrize("db_name, schema", [(DEMO_DB, "demo1"), ("service_plus_customers", DEMO_BU)])
def test_other_bus_are_unchanged(monkeypatch, db_name, schema):
    calls = _stub_billing(monkeypatch)
    asyncio.run(require_bu_writable(_info(user_type="B"), db_name, schema))
    assert calls == [(db_name, schema)]


def test_no_demo_configured_means_no_demo_check(monkeypatch):
    monkeypatch.setattr(settings, "demo_db_name", "")
    _stub_billing(monkeypatch)
    asyncio.run(require_bu_writable(_info(user_type="B"), DEMO_DB, DEMO_BU))


# ── WhatsApp ─────────────────────────────────────────────────────────────────

def _stub_whatsapp(monkeypatch):
    sent, released = [], []

    async def fake_send(*args, **kwargs):
        sent.append(args)
        return SimpleNamespace(ok=True)

    async def fake_reserve(db_name, schema, count):
        return True

    async def fake_release(db_name, schema, count):
        released.append((db_name, schema, count))

    monkeypatch.setattr(metered, "send_template", fake_send)
    monkeypatch.setattr(metered, "reserve_whatsapp", fake_reserve)
    monkeypatch.setattr(metered, "release_whatsapp", fake_release)
    return sent, released


def test_demo_whatsapp_never_reaches_meta(monkeypatch):
    sent, released = _stub_whatsapp(monkeypatch)
    result = asyncio.run(metered.send_metered(DEMO_DB, DEMO_BU, "9000010001"))
    assert result.error_code == metered.DEMO_NO_SEND and not result.ok
    result = asyncio.run(metered.send_reserved(DEMO_DB, "demo1", "9000010001"))
    assert result.error_code == metered.DEMO_NO_SEND
    assert sent == []
    assert released == [(DEMO_DB, "demo1", 1)]


def test_other_database_whatsapp_still_sends(monkeypatch):
    sent, _ = _stub_whatsapp(monkeypatch)
    assert asyncio.run(metered.send_metered("service_plus_customers", "acme", "9000010001")).ok
    assert len(sent) == 1


# ── Email ────────────────────────────────────────────────────────────────────

def _stub_smtp(monkeypatch):
    sent = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(email_module, "_send_email_sync", lambda to, *rest: sent.append(to))
    return sent


def test_demo_email_is_dropped(monkeypatch):
    sent = _stub_smtp(monkeypatch)
    asyncio.run(email_module.send_email("a@example.com", "s", "b", db_name=DEMO_DB))
    assert sent == []


@pytest.mark.parametrize("db_name", [None, "service_plus_customers"])
def test_other_email_still_sends(monkeypatch, db_name):
    sent = _stub_smtp(monkeypatch)
    asyncio.run(email_module.send_email("a@example.com", "s", "b", db_name=db_name))
    assert sent == ["a@example.com"]


# ── Demo sign-in (Step 3) ────────────────────────────────────────────────────

def test_demo_login_refused_when_not_configured(monkeypatch):
    from app.routers.auth.helper import demo_login_helper  # pylint: disable=import-outside-toplevel

    monkeypatch.setattr(settings, "demo_username", "")
    with pytest.raises(AuthorizationException) as exc:
        asyncio.run(demo_login_helper())
    assert exc.value.code == "DEMO_NOT_AVAILABLE"


def test_demo_login_refuses_an_admin(monkeypatch):
    from app.routers.auth import helper  # pylint: disable=import-outside-toplevel

    async def fake_exec_sql(db_name=None, schema="public", sql=None, sql_args=None, **_):
        if db_name is None:
            return [{"code": "demo", "db_name": DEMO_DB, "id": 1}]
        return [{"id": 7, "is_active": True, "is_admin": True}]

    monkeypatch.setattr(helper, "exec_sql", fake_exec_sql)
    with pytest.raises(AuthorizationException) as exc:
        asyncio.run(helper.demo_login_helper())
    assert exc.value.code == "DEMO_NOT_AVAILABLE"


# ── Demo data (Steps 6–7) ────────────────────────────────────────────────────

@pytest.mark.parametrize("user_type", ["A", "B"])
def test_demo_operations_are_super_admin_only(user_type):
    import inspect  # pylint: disable=import-outside-toplevel

    from app.graphql.resolvers.mutation import resolve_demo_top_up  # pylint: disable=import-outside-toplevel
    from app.graphql.resolvers.query import resolve_demo_status  # pylint: disable=import-outside-toplevel

    info = _info(user_type=user_type, db_name=DEMO_DB)
    for resolver in (resolve_demo_top_up, resolve_demo_status):
        with pytest.raises(AuthorizationException):
            asyncio.run(inspect.unwrap(resolver)(None, info))


def test_generator_refuses_without_settings(monkeypatch):
    from app.demo import demo_data  # pylint: disable=import-outside-toplevel

    monkeypatch.setattr(settings, "demo_bu_code", "")
    with pytest.raises(demo_data.DemoNotConfiguredError):
        asyncio.run(demo_data.run_demo_top_up())
