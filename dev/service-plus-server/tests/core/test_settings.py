"""
Smoke test for the Step 2/Step 3 reorg: Settings composition (app/core/settings/)
and SqlStore composition (app/db/sql/) via multiple inheritance.

No DB or network access — pure import/attribute checks.
"""
from app.config import Settings, settings
from app.core.settings.api_settings import ApiSettings
from app.core.settings.auth_settings import AuthSettings
from app.core.settings.database_settings import DatabaseSettings
from app.core.settings.email_settings import EmailSettings
from app.db.sql.sql_base import SqlStore


def test_settings_composes_all_domain_settings():
    """Settings must inherit from every per-concern settings class."""
    assert issubclass(Settings, DatabaseSettings)
    assert issubclass(Settings, AuthSettings)
    assert issubclass(Settings, EmailSettings)
    assert issubclass(Settings, ApiSettings)


def test_settings_instance_has_fields_from_every_domain():
    """Spot-check one field owned by each domain settings class."""
    assert hasattr(settings, "client_db_host")  # DatabaseSettings
    assert hasattr(settings, "secret_key")  # AuthSettings
    assert hasattr(settings, "smtp_host")  # EmailSettings
    assert hasattr(settings, "app_env")  # ApiSettings


def test_computed_fields_resolve():
    assert settings.file_server_url in (
        settings.file_server_url_development,
        settings.file_server_url_production,
    )
    assert settings.trace_plus_url in (
        settings.trace_plus_url_development,
        settings.trace_plus_url_production,
    )
    assert settings.frontend_url


def test_sqlstore_composes_all_domain_sql_classes():
    """Spot-check one constant owned by each of the 6 domain SQL classes resolves on SqlStore."""
    assert isinstance(SqlStore.CHECK_JOB_DELIVERY_MANNER_CODE_EXISTS, str)  # jobs
    assert isinstance(SqlStore.CHECK_BRAND_CODE_EXISTS, str)  # inventory
    assert isinstance(SqlStore.CHECK_CUSTOMER_TYPE_CODE_EXISTS, str)  # sales_accounts
    assert isinstance(SqlStore.CHECK_ADMIN_EMAIL_EXISTS, str)  # bu_admin
    assert isinstance(SqlStore.BU_SCHEMA_DDL, str)  # bu_admin (generated DDL)
    assert isinstance(SqlStore.GET_DASHBOARD_KPIS, str)  # reports_audit
    assert isinstance(SqlStore.GET_APP_SETTINGS, str)  # shared
    assert isinstance(SqlStore.GET_ACTIVE_CLIENTS, str)  # shared (moved from scheduler.py)
