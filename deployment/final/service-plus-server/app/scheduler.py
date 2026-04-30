"""
Monthly stock snapshot scheduler.

Runs on the 1st of every month at 00:05 and generates stock snapshots
for all active client databases and their BU schemas.
"""
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.db.psycopg_driver import exec_sql
from app.db.sql_store import SqlStore
from app.exceptions import DatabaseException
from app.logger import logger

_scheduler: dict[str, AsyncIOScheduler | None] = {"instance": None}

_GET_ACTIVE_CLIENTS = """
    SELECT db_name FROM public.client WHERE is_active = true AND db_name IS NOT NULL
"""

_GET_ACTIVE_SCHEMAS = """
    SELECT code FROM security.bu WHERE is_active = true
"""


async def generate_snapshot_for_client(db_name: str, schema: str, year: int, month: int) -> int:
    """Run SQL_GENERATE_STOCK_SNAPSHOT for one client schema. Returns row count."""
    try:
        rows = await exec_sql(
            db_name=db_name,
            schema=schema,
            sql=SqlStore.SQL_GENERATE_STOCK_SNAPSHOT,
            sql_args={"year": year, "month": month},
        )
        count = len(rows) if isinstance(rows, list) else (rows or 0)
        logger.info("Snapshot %d/%d → %s/%s: %d rows", year, month, db_name, schema, count)
        return count
    except DatabaseException as exc:
        logger.error("Snapshot failed for %s/%s: %s", db_name, schema, exc)
        return 0


async def run_monthly_snapshot() -> None:
    """
    Job executed on the 1st of every month.
    Snapshots the previous month for all active clients and their BU schemas.
    """
    now = datetime.now()
    month = now.month - 1 if now.month > 1 else 12
    year  = now.year if now.month > 1 else now.year - 1

    logger.info("Monthly snapshot job started for %d/%d", year, month)

    try:
        client_rows = await exec_sql(db_name=None, schema="public", sql=_GET_ACTIVE_CLIENTS)
    except DatabaseException as exc:
        logger.error("Failed to fetch active clients for snapshot: %s", exc)
        return

    total = 0
    for client in client_rows:
        db_name: str = client["db_name"]
        try:
            schema_rows = await exec_sql(db_name=db_name,
                schema="security", sql=_GET_ACTIVE_SCHEMAS)
        except DatabaseException as exc:
            logger.error("Failed to fetch schemas for %s: %s", db_name, exc)
            continue

        for schema_row in schema_rows:
            schema: str = schema_row["code"]
            total += await generate_snapshot_for_client(db_name, schema, year, month)

    logger.info("Monthly snapshot job completed. Total rows: %d", total)


def start_scheduler() -> None:
    """Initialize and start the background scheduler for monthly tasks."""
    _scheduler["instance"] = AsyncIOScheduler()
    _scheduler["instance"].add_job(
        run_monthly_snapshot,
        trigger="cron",
        day=1,
        hour=0,
        minute=5,
        id="monthly_stock_snapshot",
        replace_existing=True,
    )
    _scheduler["instance"].start()
    logger.info("Stock snapshot scheduler started (runs on 1st of each month at 00:05)")


def stop_scheduler() -> None:
    """Safely shut down the running scheduler if it exists."""
    instance = _scheduler["instance"]
    if instance and instance.running:
        instance.shutdown(wait=False)
        logger.info("Stock snapshot scheduler stopped")
