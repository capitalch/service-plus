"""
Application configuration management using Pydantic Settings.
"""

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


# Create global settings instance
settings = Settings()
