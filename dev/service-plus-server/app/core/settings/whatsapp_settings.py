"""Account settings for the WhatsApp Cloud API (Meta) BSP."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WhatsappSettings(BaseSettings):
    """WhatsApp Business Solution Provider (BSP) account settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    whatsapp_api_version: str = Field(default="v20.0", description="WhatsApp Cloud API version")
    whatsapp_base_url: str = Field(
        default="https://graph.facebook.com", description="WhatsApp Cloud API base URL"
    )
    whatsapp_phone_number_id: str = Field(
        default="", description="WhatsApp Cloud API phone number id"
    )
    whatsapp_waba_id: str = Field(default="", description="WhatsApp Business Account id")
    whatsapp_access_token_env: str = Field(
        default="WHATSAPP_ACCESS_TOKEN",
        description="Name of the env var holding the access token — never the token value itself",
    )
