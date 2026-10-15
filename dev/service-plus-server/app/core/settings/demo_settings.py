"""Live demo from the portal — which database and business unit are the demo (plans/plan.md)."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DemoSettings(BaseSettings):
    """Live demo settings. Empty DEMO_DB_NAME / DEMO_BU_CODE means no demo on this server."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    demo_bu_code: str = Field(default="", description="Business unit code (schema) used as the live demo")
    demo_db_name: str = Field(default="", description="Tenant database holding the live demo business unit")
    demo_username: str = Field(default="", description="Business user every demo visitor is signed in as")
    demo_writable: bool = Field(default=False, description="True lets demo visitors save; False keeps it read-only")

    def is_demo_bu(self, db_name: str | None, schema: str | None) -> bool:
        """True when db_name/schema is the configured live demo business unit."""
        return bool(self.demo_bu_code) and self.is_demo_db(db_name) and (schema or "") == self.demo_bu_code

    def is_demo_db(self, db_name: str | None) -> bool:
        """True when db_name is the configured live demo database."""
        return bool(self.demo_db_name) and (db_name or "") == self.demo_db_name

    def is_demo_enabled(self) -> bool:
        """True when database, business unit and user are all set."""
        return bool(self.demo_db_name and self.demo_bu_code and self.demo_username)
