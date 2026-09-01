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
    # Dedicated to signing customer-facing status-link tokens (app/whatsapp/token.py) —
    # deliberately separate from whatsapp_app_secret (authenticates *Meta's* webhook
    # calls) and from settings.secret_key (authenticates *logged-in staff*), since a
    # customer-facing link token is a different trust boundary from both.
    whatsapp_link_token_secret: str = Field(
        default="", repr=False, description="HMAC secret for signing job-intake status-link tokens"
    )
    # A third, separate trust boundary from both secrets above: this one hashes
    # short-lived, attempt-limited job-delivery confirmation codes (app/whatsapp/otp.py)
    # rather than authenticating Meta or signing a long-lived customer link — deliberately
    # its own secret so rotating one never affects the other two.
    whatsapp_delivery_otp_secret: str = Field(
        default="", repr=False, description="HMAC secret for hashing job-delivery confirmation codes"
    )
