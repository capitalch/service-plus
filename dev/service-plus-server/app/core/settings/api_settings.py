"""Application, GraphQL, file-server, logging, audit, and trace-plus integration settings."""

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ApiSettings(BaseSettings):
    """Cross-cutting application/API settings not specific to database, auth, or email."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Runtime environment
    app_env: str = Field(
        default="development",
        description="Runtime environment: 'development' or 'production'",
    )

    # Application Settings
    app_name: str = Field(default="Service Plus API", description="Application name")
    app_version: str = Field(default="1.0.0", description="Application version")
    debug: bool = Field(default=True, description="Debug mode")
    host: str = Field(default="127.0.0.1", description="Server host")
    port: int = Field(default=8000, description="Server port")
    upload_base_dir: str = "uploads"
    # upload_max_size_kb: int = 100

    # CORS Settings
    cors_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3004",
            "https://serviceplus.kushinfotech.in",
            "https://serviceplus.capital-chowringhee.com",
            "https://kushinfotech.in",
            "https://www.kushinfotech.in",
        ],
        description="Allowed CORS origins. Set to the real client domain(s) in production.",
    )

    # File Server Settings
    # "http://node270118-service-plus-file-server.cloudjiffy.net:11047", http://localhost:9000
    file_server_url_development: str = Field(
        default="http://node270118-service-plus-file-server.cloudjiffy.net:11047",
        description="""File server base URL. In production, set to the Cloudjiffy
            file server hostname.""",
    )
    file_server_url_production: str = Field(
        default="http://192.168.15.85:9000",
        description="""File server base URL. In production, set to the Cloudjiffy
            file server hostname.""",
    )
    file_server_api_key: str = Field(
        description="Shared API key for file server. Must match the file server's FILE_SERVER_API_KEY.",
    )
    website_api_key: str = Field(
        description="""Shared API key for the public website (service-plus-web),
            sent as the X-Website-Key header. Must match service-plus-web's
            NEXT_PUBLIC_WEBSITE_KEY.""",
    )
    # GraphQL Settings
    graphql_path: str = Field(default="/graphql", description="GraphQL endpoint path")
    graphql_playground: bool = Field(
        default=True, description="Enable GraphQL playground"
    )

    # Logging Settings
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log format",
    )

    # Audit log settings
    audit_log_dir: str = Field(
        default="logs/audit", description="Directory for audit JSONL files"
    )
    audit_log_max_read_days: int = Field(
        default=30, description="Max date-range a single query may span"
    )
    audit_log_retention_days: int = Field(
        default=90, description="Days to keep audit log files"
    )

    # trace-plus accounts integration
    trace_plus_url_development: str = Field(
        default="http://localhost:8001",
        description="Trace-plus base URL for local development (no trailing slash)",
    )
    trace_plus_url_production: str = Field(
        default="http://192.168.14.60", # pilot
        # default="http://192.168.11.195", # stage
        description="Trace-plus base URL for production (no trailing slash)",
    )
    trace_plus_service_key: str = Field(
        default="5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6",
        description="Pre-shared key for trace-plus internal endpoint (X-Service-Key header). Must match trace-plus SERVICE_PLUS_API_KEY.",
    )

    @computed_field
    @property
    def frontend_url(self) -> str:
        """Derive frontend URL from debug mode: localhost:3000 in dev,
        https://host in production."""
        if self.debug:
            return "http://localhost:3000"
        return f"https://{self.host}"

    @computed_field
    @property
    def trace_plus_url(self) -> str:
        """Select trace-plus URL based on app_env (mirrors file_server_url pattern)."""
        if self.app_env == "production":
            return self.trace_plus_url_production
        return self.trace_plus_url_development

    @computed_field
    @property
    def file_server_url(self) -> str:
        """Select file-server base URL based on app_env."""
        if self.app_env == "production":
            return self.file_server_url_production
        return self.file_server_url_development
