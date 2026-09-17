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
