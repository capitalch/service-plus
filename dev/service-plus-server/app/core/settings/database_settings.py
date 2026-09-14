"""Client and service database connection settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Client and service PostgreSQL connection settings.

    Every field that identifies or reaches the real database — host, external port,
    name, user, password, IP — is required with no default, so it can only come from
    `.env` (see `.env.example`), never a value baked into source. Only the internal
    port is a plain default: 5432 is the standard Postgres port on the DB's own host
    network, not an externally reachable address, and is the same for every deployment.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Client Database Settings
    client_db_host: str = Field(description="Client database host")
    client_db_port: int = Field(description="Client database external port")
    client_db_name: str = Field(description="Client database name")
    client_db_user: str = Field(description="Client database user")
    client_db_password: str = Field(description="Client database password")
    client_db_ip_address: str = Field(description="Client database IP address")
    client_db_internal_port: int = 5432

    # Service database settings
    service_db_host: str = Field(description="Service database host")
    service_db_port: int = Field(description="Service database external port")
    service_db_user: str = Field(description="Service database user")
    service_db_password: str = Field(description="Service database password")
    service_db_ip_address: str = Field(description="Service database IP address")
    service_db_internal_port: int = 5432
