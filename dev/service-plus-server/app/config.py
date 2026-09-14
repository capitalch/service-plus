"""
Application configuration management using Pydantic Settings.
"""

from pydantic import ValidationError
from pydantic_settings import SettingsConfigDict

from app.core.settings.api_settings import ApiSettings
from app.core.settings.auth_settings import AuthSettings
from app.core.settings.database_settings import DatabaseSettings
from app.core.settings.email_settings import EmailSettings
from app.core.settings.whatsapp_settings import WhatsappSettings


class Settings(DatabaseSettings, AuthSettings, EmailSettings, WhatsappSettings, ApiSettings):
    """
    Application settings loaded from environment variables.

    Composed from per-concern settings classes via multiple inheritance so every
    existing `settings.<field>` reference keeps working unmodified — only the
    field *definitions* moved into app/core/settings/.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )


def _build_settings() -> Settings:
    """Construct Settings with a sanitized failure path.

    Pydantic-settings collects every field's raw value from `.env`/the environment
    into one dict BEFORE per-field type coercion. If any field fails validation
    (missing, wrong type), pydantic's error for THAT field embeds the whole raw
    dict as context — every already-supplied password, token and secret, in
    plaintext, regardless of the field's declared type (SecretStr does not help:
    its masking only wraps a value AFTER successful construction, which never
    happens here). Left uncaught, Python's default traceback prints that dict
    verbatim to the console/log. Catching it here and re-raising with only the
    dotted field *names* — never `err["input"]`, never `str(exc)` — keeps a
    misconfigured `.env` a debuggable error without an incidental secrets leak.
    `from None` suppresses exception chaining, which would otherwise still print
    the original (value-bearing) ValidationError underneath this one.
    """
    try:
        return Settings()
    except ValidationError as exc:
        missing = sorted({".".join(str(part) for part in err["loc"]) for err in exc.errors()})
        raise RuntimeError(
            "Missing or invalid required settings (see .env.example): " + ", ".join(missing)
        ) from None


# Create global settings instance
settings = _build_settings()
