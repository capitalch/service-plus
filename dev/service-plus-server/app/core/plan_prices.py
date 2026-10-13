"""Plan price list (plans/plan.md Step 4) — the only place prices live.

Read from the server .env in whole rupees and handed out in paise. Every key is
optional; the defaults are today's prices. The server never takes a price from the
browser: setup fees are stamped on the enquiry row and monthly fees on security.bu
when a customer is approved, so a later .env change affects only new customers and
new payments (plans/plan.md, constraint 8).

The monthly job and WhatsApp allowances (PlanLimitSettings) follow the same rule: read
from .env and stamped on security.bu when a plan is set. Keep them in step with
service-plus-portal/content/pricing.ts (jobsPerMonth, whatsappPerMonth).
"""

from dataclasses import dataclass
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

PlanCodeType = Literal["lite", "basic", "standard", "enterprise"]

PLAN_CODES: tuple[PlanCodeType, ...] = ("lite", "basic", "standard", "enterprise")

PAISE_PER_RUPEE = 100



class FileFirstSettings(BaseSettings):
    """Settings where the .env file wins over the process environment.

    Prices and allowances are read fresh on every call so an edit to .env takes effect
    without a restart. Environment variables are fixed when the process starts, and an
    IDE debugger copies .env into them at launch, so with the default order a stale copy
    would silently override the file. A key missing from .env still falls back to the
    environment.
    """

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return init_settings, dotenv_settings, env_settings, file_secret_settings


class PlanPriceSettings(FileFirstSettings):
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


class PlanLimitSettings(FileFirstSettings):
    """Monthly allowance keys from .env; a blank value means unlimited.

    Same numbers as service-plus-portal/content/pricing.ts — change both together.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    limit_basic_jobs: int | None = Field(default=150, ge=0)
    limit_basic_whatsapp: int | None = Field(default=150, ge=0)
    limit_enterprise_jobs: int | None = Field(default=None, ge=0)
    limit_enterprise_whatsapp: int | None = Field(default=None, ge=0)
    limit_lite_jobs: int | None = Field(default=75, ge=0)
    limit_lite_whatsapp: int | None = Field(default=20, ge=0)
    limit_standard_jobs: int | None = Field(default=400, ge=0)
    limit_standard_whatsapp: int | None = Field(default=300, ge=0)

    @field_validator("*", mode="before")
    @classmethod
    def blank_is_unlimited(cls, value: object) -> object:
        """`LIMIT_X=` in .env means unlimited, not a parse error."""
        return None if isinstance(value, str) and not value.strip() else value


@dataclass(frozen=True)
class PlanLimitType:
    """One plan's monthly allowances; None = unlimited."""

    jobs: int | None
    whatsapp: int | None


def get_plan_limits(plan_code: str) -> PlanLimitType:
    """The allowances to stamp on a BU of this plan. Read fresh from .env on each call;
    raises KeyError for an unknown plan code."""
    if plan_code not in PLAN_CODES:
        raise KeyError(plan_code)
    s = PlanLimitSettings()
    return PlanLimitType(
        jobs=getattr(s, f"limit_{plan_code}_jobs"),
        whatsapp=getattr(s, f"limit_{plan_code}_whatsapp"),
    )
