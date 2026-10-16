"""JWT/token and super-admin authentication settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AuthSettings(BaseSettings):
    """JWT/token and super-admin authentication settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Security Settings
    secret_key: str = Field(description="Secret key for JWT and encryption")
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=30, description="Access token expiration time in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=7, description="Refresh token expiration time in days"
    )

    # Hashes the one-time codes that prove a portal applicant owns their email
    # (app/services/signup_otp.py). Its own secret, so rotating it touches nothing else;
    # required, so the server never hashes codes with an empty key.
    signup_otp_secret: str = Field(
        min_length=16, repr=False, description="HMAC secret for hashing sign-up email codes"
    )

    # super admin
    super_admin_username: str = Field(
        default="superadmin", description="Super admin UID"
    )
    super_admin_email: str = Field(
        default="capitalch@gmail.com", description="Super admin email"
    )
    super_admin_password_hash: str = Field(
        description="Super admin password hash,s...3",
    )
    super_admin_mobile: str = Field(
        default="98888888888", description="Super admin mobile number"
    )
