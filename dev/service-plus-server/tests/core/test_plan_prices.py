"""plans/plan.md Step 4 — price list (app/core/plan_prices.py). No DB."""
import pytest

from app.core import plan_prices
from app.core.plan_prices import PlanPriceSettings, get_plan_price, get_price_list

_PRICE_KEYS = [name.upper() for name in PlanPriceSettings.model_fields]


@pytest.fixture
def defaults_only(monkeypatch):
    """Ignore the developer's .env so the defaults are what is tested."""
    for key in _PRICE_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setitem(PlanPriceSettings.model_config, "env_file", None)


def test_defaults_are_todays_prices_in_paise(defaults_only):  # pylint: disable=unused-argument
    prices = get_price_list()
    assert (prices.plans["basic"].setup_fee_paise, prices.plans["basic"].monthly_fee_paise) == (200000, 299900)
    assert (prices.plans["standard"].setup_fee_paise, prices.plans["standard"].monthly_fee_paise) == (200000, 599900)
    assert (prices.plans["enterprise"].setup_fee_paise, prices.plans["enterprise"].monthly_fee_paise) == (
        500000,
        1099900,
    )
    assert prices.extra_bu_monthly_paise == 300000
    assert prices.enterprise_included_bus == 5


def test_lite_is_always_free(defaults_only, monkeypatch):  # pylint: disable=unused-argument
    monkeypatch.setenv("PRICE_BASIC_SETUP", "9999")
    lite = get_plan_price("lite")
    assert (lite.setup_fee_paise, lite.monthly_fee_paise) == (0, 0)
    assert get_plan_price("basic").setup_fee_paise == 999900


def test_every_plan_code_is_priced(defaults_only):  # pylint: disable=unused-argument
    assert set(get_price_list().plans) == set(plan_prices.PLAN_CODES)
