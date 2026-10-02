"""Plan price list (plans/plan.md Step 4) — the only place prices live.

Read from the server .env in whole rupees and handed out in paise. Every key is
optional; the defaults are today's prices. The server never takes a price from the
browser: setup fees are stamped on the enquiry row and monthly fees on security.bu
when a customer is approved, so a later .env change affects only new customers and
new payments (plans/plan.md, constraint 8).
"""

from dataclasses import dataclass
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PlanCodeType = Literal["lite", "basic", "standard", "enterprise"]

PLAN_CODES: tuple[PlanCodeType, ...] = ("lite", "basic", "standard", "enterprise")

PAISE_PER_RUPEE = 100


class PlanPriceSettings(BaseSettings):
    """Price keys from .env, in whole rupees."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    enterprise_included_bus: int = Field(default=5, ge=1)
    price_basic_monthly: int = Field(default=2999, ge=0)
    price_basic_setup: int = Field(default=2000, ge=0)
    price_enterprise_monthly: int = Field(default=10999, ge=0)
    price_enterprise_setup: int = Field(default=5000, ge=0)
    price_extra_bu_monthly: int = Field(default=3000, ge=0)
    price_standard_monthly: int = Field(default=5999, ge=0)
    price_standard_setup: int = Field(default=2000, ge=0)


@dataclass(frozen=True)
class PlanPriceType:
    """One plan's fees, in paise."""

    monthly_fee_paise: int
    plan_code: PlanCodeType
    setup_fee_paise: int


@dataclass(frozen=True)
class PriceListType:
    """The whole price list, in paise."""

    enterprise_included_bus: int
    extra_bu_monthly_paise: int
    plans: dict[str, PlanPriceType]


def get_price_list() -> PriceListType:
    """The current price list. Read fresh from .env on each call; Lite is always free."""
    s = PlanPriceSettings()
    rupees = {
        "basic": (s.price_basic_setup, s.price_basic_monthly),
        "enterprise": (s.price_enterprise_setup, s.price_enterprise_monthly),
        "lite": (0, 0),
        "standard": (s.price_standard_setup, s.price_standard_monthly),
    }
    return PriceListType(
        enterprise_included_bus=s.enterprise_included_bus,
        extra_bu_monthly_paise=s.price_extra_bu_monthly * PAISE_PER_RUPEE,
        plans={
            code: PlanPriceType(
                monthly_fee_paise=monthly * PAISE_PER_RUPEE,
                plan_code=code,
                setup_fee_paise=setup * PAISE_PER_RUPEE,
            )
            for code, (setup, monthly) in rupees.items()
        },
    )


def get_plan_price(plan_code: str) -> PlanPriceType:
    """One plan's fees; raises KeyError for an unknown plan code."""
    return get_price_list().plans[plan_code]
