"""Ask AI in the client Help Center — Gemini API settings (app/ai_help/)."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AiSettings(BaseSettings):
    """AI help settings. With no key set, Ask AI is hidden in the client (aiHelpEnabled)."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    ai_help_daily_limit_per_bu: int = Field(
        default=30, description="Ask AI questions allowed per business unit per India day"
    )
    ai_help_fallback_model: str = Field(
        default="gemini-3.5-flash-lite",
        description="Model tried once when the main one hits its quota; empty = no fallback",
    )
    ai_help_model: str = Field(default="gemini-3.8-flash", description="Main Ask AI model")
    ai_help_per_user_per_minute: int = Field(
        default=5, description="Ask AI questions allowed per user per minute"
    )
    ai_help_provider: str = Field(default="gemini", description="Ask AI provider (app/ai_help/providers/)")
    gemini_api_key: str = Field(default="", repr=False, description="Gemini API key")
