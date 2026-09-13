"""
Composed SQL store for the entire application.

SqlStore is assembled via multiple inheritance from the per-domain classes
below so every existing `SqlStore.CONST_NAME` call site keeps working
unmodified — only the constant *definitions* moved out of the old
app/db/sql_store.py into domain-specific files.
"""

from app.db.sql.sql_bu_admin import BuAdminSql
from app.db.sql.sql_inventory import InventorySql
from app.db.sql.sql_jobs import JobsSql
from app.db.sql.sql_reports_audit import ReportsAuditSql
from app.db.sql.sql_sales_accounts import SalesAccountsSql
from app.db.sql.sql_shared import SharedSql


class SqlStore(
    JobsSql,
    InventorySql,
    SalesAccountsSql,
    BuAdminSql,
    ReportsAuditSql,
    SharedSql,
):
    """Single source of truth for every SQL query and builder in the server."""
