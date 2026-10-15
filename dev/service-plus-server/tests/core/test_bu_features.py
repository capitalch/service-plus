"""plans/plan.md Steps 3–5 — per-BU features switched on by the Super Admin. No DB: the
billing lookup is stubbed."""
import asyncio
import inspect
import json
from types import SimpleNamespace
from urllib.parse import quote

import pytest

from app.core.bu_features import BU_FEATURES, SPARE_PARTS_WEB
from app.core.exceptions import AuthorizationException, ValidationException
from app.graphql.resolvers import mutation as mutation_module
from app.graphql.resolvers.auth_guards import (
    FEATURE_TABLES,
    generic_update_features,
    require_bu_feature,
    require_generic_update_features,
)
from app.graphql.resolvers.bu_admin.bu_features import _parse_bus
from app.services import bu_billing


def _value(payload) -> str:
    return quote(json.dumps(payload))


def _stub(monkeypatch, features: list[str]):
    calls = []

    async def fake(db_name, schema):
        calls.append((db_name, schema))
        return {"branchLimit": None, "features": features, "paidThrough": None, "planCode": None, "status": "not_billed"}

    monkeypatch.setattr(bu_billing, "get_bu_billing", fake)
    return calls


# ── the catalogue ─────────────────────────────────────────────────────────────


def test_feature_tables_name_known_features():
    assert set(FEATURE_TABLES.values()) <= set(BU_FEATURES)


def test_client_mirror_lists_the_same_features():
    from pathlib import Path

    client = Path(__file__).resolve().parents[3] / "service-plus-client/src/constants/bu-features.ts"
    if not client.exists():
        pytest.skip("service-plus-client is not next to the server")
    text = client.read_text()
    for name in BU_FEATURES:
        assert f'"{name}"' in text, f"{name} missing from {client}"


# ── setBuFeatures payload ─────────────────────────────────────────────────────


def test_parse_sorts_and_removes_duplicates():
    assert _parse_bus({"bus": [{"features": [SPARE_PARTS_WEB, SPARE_PARTS_WEB], "id": "3"}]}) == [
        (3, [SPARE_PARTS_WEB])
    ]


def test_parse_allows_switching_everything_off():
    assert _parse_bus({"bus": [{"features": [], "id": 1}]}) == [(1, [])]


def test_parse_refuses_an_unknown_feature():
    with pytest.raises(ValidationException) as exc:
        _parse_bus({"bus": [{"features": ["time_travel"], "id": 1}]})
    assert exc.value.extensions == {"feature": "time_travel"}


@pytest.mark.parametrize("payload", [{}, {"bus": []}, {"bus": [{"id": 1}]}, {"bus": [{"features": [], "id": "x"}]}])
def test_parse_refuses_a_malformed_payload(payload):
    with pytest.raises(ValidationException):
        _parse_bus(payload)


def test_set_bu_features_is_super_admin_only():
    source = inspect.getsource(mutation_module.resolve_set_bu_features)
    assert 'require_user_type(info, {"S"})' in source


# ── the guard ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("user_type", ["A", "B"])
def test_feature_off_is_refused(monkeypatch, user_type):
    _stub(monkeypatch, [])
    with pytest.raises(AuthorizationException) as exc:
        asyncio.run(require_bu_feature({"user_type": user_type}, "service_plus_demo", "demo1", SPARE_PARTS_WEB))
    assert exc.value.code == "FEATURE_NOT_ENABLED"


def test_feature_on_passes(monkeypatch):
    _stub(monkeypatch, [SPARE_PARTS_WEB])
    asyncio.run(require_bu_feature({"user_type": "B"}, "service_plus_demo", "demo1", SPARE_PARTS_WEB))


def test_super_admin_passes_without_a_lookup(monkeypatch):
    calls = _stub(monkeypatch, [])
    asyncio.run(require_bu_feature({"user_type": "S"}, "service_plus_demo", "demo1", SPARE_PARTS_WEB))
    assert calls == []


def test_generic_update_finds_feature_tables_at_any_depth():
    nested = {"tableName": "brand", "xData": {"id": 1, "xDetails": {"tableName": "spare_part_web", "xData": {"id": 2}}}}
    assert generic_update_features(_value(nested)) == {SPARE_PARTS_WEB}
    assert generic_update_features(_value({"tableName": "brand", "xData": {"id": 1}})) == set()
    assert generic_update_features("not json") == set()


def test_generic_update_on_spare_part_web_needs_the_feature(monkeypatch):
    info = SimpleNamespace(context={"user_type": "A"})
    value = _value({"tableName": "spare_part_web", "xData": {"id": 1, "name": "Panel"}})
    _stub(monkeypatch, [])
    with pytest.raises(AuthorizationException):
        asyncio.run(require_generic_update_features(info, "service_plus_demo", "demo1", value))
    _stub(monkeypatch, [SPARE_PARTS_WEB])
    asyncio.run(require_generic_update_features(info, "service_plus_demo", "demo1", value))


def test_generic_update_calls_the_feature_guard():
    source = inspect.getsource(mutation_module.resolve_generic_update)
    assert "require_generic_update_features(" in source
