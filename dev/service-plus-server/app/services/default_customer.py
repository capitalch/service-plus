"""The default customer database (plans/plan.md, Step 2).

Every Lite / Basic / Standard customer is one BU inside a single shared tenant database,
named by settings.default_customer_db_name. It is an ordinary client: an active
public.client row points at it, and it uses the shared tenant credentials.
"""

from app.config import settings
from app.core.exceptions import AppMessages, ServicePlusException
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_signups import SignupServerSql


def is_default_customer_db(db_name: str | None) -> bool:
    """True only when the setting is set and names this database."""
    configured = (settings.default_customer_db_name or "").strip()
    return bool(configured) and db_name == configured


async def get_default_customer_client() -> dict:
    """The active public.client row of the default customer database: id, code, name,
    db_name. Raises DEFAULT_DB_NOT_CONFIGURED when the setting is empty or matches no
    active client — callers must never fall back to the control-plane table."""
    configured = (settings.default_customer_db_name or "").strip()
    rows = (
        await exec_sql(
            db_name=None,
            schema="public",
            sql=SignupServerSql.GET_DEFAULT_CUSTOMER_CLIENT,
            sql_args={"db_name": configured},
        )
        if configured
        else []
    )
    if not rows:
        raise ServicePlusException(
            message=AppMessages.DEFAULT_DB_NOT_CONFIGURED,
            code="DEFAULT_DB_NOT_CONFIGURED",
        )
    return dict(rows[0])


def get_enterprise_enquiry_notify_email() -> str:
    """Extra recipient for Enterprise enquiry mail: the dedicated setting, else the
    contact-form address, else the Super Admin."""
    return (
        settings.enterprise_enquiry_notify_email
        or settings.contact_notify_email
        or settings.super_admin_email
    )
