"""SMTP settings for outbound email."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EmailSettings(BaseSettings):
    """SMTP settings for outbound email."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    smtp_host: str = Field(
        default="mail.kushinfotech.in",
        description="SMTP server host. Leave empty to disable email sending.",
    )
    smtp_from: str = Field(
        default="admin@kushinfotech.in", description="Sender email address"
    )
    smtp_password: str = Field(description="SMTP login password")
    smtp_port: int = Field(default=587, description="SMTP server port")  # 587
    smtp_user: str = Field(
        default="admin@kushinfotech.in", description="SMTP login username"
    )
