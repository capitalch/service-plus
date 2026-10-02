"""plans/plan.md Steps 2 and 3 — BU name rule, default customer database flag and guard. No DB."""
from types import SimpleNamespace

import pytest

from app.config import settings
from app.core.exceptions import AuthorizationException
from app.graphql.resolvers.auth_guards import require_default_customer_db
from app.graphql.resolvers.bu_admin.provisioning import BU_NAME_PATTERN
from app.services.default_customer import is_default_customer_db


@pytest.mark.parametrize(
    "name", ["Nav Technology Pvt Ltd.", "Demo Unit", "A&B Services (Kolkata)", "R/S Mobile, Unit-2", "O'Brien 24x7", "abc"]
)
def test_bu_name_accepts_real_business_names(name):
    assert BU_NAME_PATTERN.match(name)


@pytest.mark.parametrize("name", ["...", "-abc", "ab", "", " Demo", "Demo@Unit", "x" * 101])
def test_bu_name_rejects_bad_names(name):
    assert not BU_NAME_PATTERN.match(name)


def test_default_customer_db_flag(monkeypatch):
    monkeypatch.setattr(settings, "default_customer_db_name", "service_plus_customers")
    assert is_default_customer_db("service_plus_customers")
    assert not is_default_customer_db("service_plus_demo")
    assert not is_default_customer_db(None)


def test_default_customer_db_flag_is_false_when_unset(monkeypatch):
    monkeypatch.setattr(settings, "default_customer_db_name", "")
    assert not is_default_customer_db("")
    assert not is_default_customer_db("service_plus_customers")


def test_require_default_customer_db(monkeypatch):
    monkeypatch.setattr(settings, "default_customer_db_name", "service_plus_customers")
    info = SimpleNamespace(context={"user_type": "A", "db_name": "service_plus_customers"})
    require_default_customer_db(info, "service_plus_customers")
    with pytest.raises(AuthorizationException) as exc:
        require_default_customer_db(info, "service_plus_demo")
    assert exc.value.extensions.get("reason") == "not_default_customer_db"
