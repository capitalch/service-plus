"""Client and service database connection settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Client and service PostgreSQL connection settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Client Database Settings
    client_db_host: str = "node150483-trace-link.cloudjiffy.net"
    client_db_port: int = 11085
    client_db_name: str = "service_plus_client"
    client_db_user: str = "webadmin"
    client_db_password: str
    client_db_ip_address: str = "192.168.14.20"
    client_db_internal_port: int = 5432

    # Service database settings
    service_db_host: str = "node150483-trace-link.cloudjiffy.net"
    service_db_port: int = 11085
    service_db_user: str = "webadmin"
    service_db_password: str
    service_db_ip_address: str = "192.168.14.20"
    service_db_internal_port: int = 5432
