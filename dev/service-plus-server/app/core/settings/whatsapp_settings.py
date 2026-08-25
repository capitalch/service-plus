"""Account settings for the WhatsApp Cloud API — direct with Meta, no BSP."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WhatsappSettings(BaseSettings):
    """WhatsApp Cloud API account settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    whatsapp_api_version: str = Field(default="v26.0", description="WhatsApp Cloud API version")
    whatsapp_base_url: str = Field(
        default="https://graph.facebook.com", description="WhatsApp Cloud API base URL"
    )
    whatsapp_phone_number_id: str = Field(
        default="", description="WhatsApp Cloud API phone number id"
    )
    whatsapp_waba_id: str = Field(default="", description="WhatsApp Business Account id")
    # repr=False keeps this out of any repr()/str() dump of the settings object (e.g. a
    # startup log line that prints `settings`) without needing the old name-indirection
    # trick — and as a real declared field, it's picked up by the same `.env` loading
    # that already works for the other WhatsApp settings. (The old
    # os.environ.get(whatsapp_access_token_env) pattern silently returned "" for a
    # `.env`-only value, since pydantic-settings never copies undeclared keys into the
    # real process environment.)
    whatsapp_access_token: str = Field(
        default="", repr=False, description="WhatsApp Cloud API permanent access token"
    )
    whatsapp_app_secret: str = Field(
        default="", description="Meta App Secret — verifies X-Hub-Signature-256 on inbound webhooks"
    )
    whatsapp_webhook_verify_token: str = Field(
        default="", description="Verify token echoed back during webhook subscription setup"
    )
