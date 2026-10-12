"""Monthly job and WhatsApp allowances of a BU (plans/plan.md Steps 4–7).

The limits are stamped on security.bu when a plan is set (NULL = unlimited); the counters
live in security.bu_usage, one row per BU per IST calendar month, so a new month simply
starts a new row at 0. Reserving is one atomic statement (BillingServerSql.RESERVE_*):
there is no read-then-write, so two requests can never both take the last slot.

Never read through the 60-second billing cache: usage changes on every job and message.
"""

from datetime import date
from typing import Any

from psycopg import AsyncCursor

from app.core.billing import today_ist
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_billing import BillingServerSql

# Schemas that are not a BU are never counted (same set require_bu_writable skips).
_UNCOUNTED_SCHEMAS = frozenset({"", "public", "security"})


def is_counted(db_name: str | None, schema: str | None) -> bool:
    """True when (db_name, schema) names a BU whose usage is counted."""
    return bool(db_name) and (schema or "").lower() not in _UNCOUNTED_SCHEMAS


def month_start_ist() -> date:
    """The 1st of the current IST month: the usage row's period_start."""
    return today_ist().replace(day=1)


async def get_bu_usage(db_name: str, schema: str) -> dict[str, Any]:
    """{jobLimit, jobsUsed, whatsappLimit, whatsappUsed} of the current month; limits None =
    unlimited. An unknown BU or a tenant-wide schema reads as unlimited and unused."""
    row: dict[str, Any] = {}
    if is_counted(db_name, schema):
        rows = await exec_sql(
            db_name,
            "security",
            BillingServerSql.GET_BU_USAGE,
            {"code": schema, "period_start": month_start_ist()},
        )
        row = rows[0] if rows else {}
    return {
        "jobLimit": row.get("job_limit_monthly"),
        "jobsUsed": row.get("jobs_used", 0),
        "whatsappLimit": row.get("whatsapp_limit_monthly"),
        "whatsappUsed": row.get("whatsapp_used", 0),
    }


async def release_whatsapp(db_name: str, schema: str, n: int = 1) -> None:
    """Give back n reserved messages that Meta did not accept (never below 0)."""
    if n <= 0 or not is_counted(db_name, schema):
        return
    await exec_sql(
        db_name,
        "security",
        BillingServerSql.RELEASE_WHATSAPP,
        {"code": schema, "n": n, "period_start": month_start_ist()},
    )


async def reserve_jobs(cur: AsyncCursor, schema: str, n: int) -> bool:
    """True when n more jobs fit this month. Runs on the caller's cursor, so a rollback of
    the job insert also undoes the reservation: only saved jobs count."""
    if n <= 0:
        return True
    await cur.execute(BillingServerSql.RESERVE_JOBS, {"code": schema, "n": n, "period_start": month_start_ist()})
    return await cur.fetchone() is not None


async def reserve_whatsapp(db_name: str, schema: str, n: int = 1) -> bool:
    """True when n more messages fit this month; they are then counted until released."""
    if n <= 0 or not is_counted(db_name, schema):
        return True
    rows = await exec_sql(
        db_name,
        "security",
        BillingServerSql.RESERVE_WHATSAPP,
        {"code": schema, "n": n, "period_start": month_start_ist()},
    )
    return bool(rows)


async def reserve_whatsapp_up_to(db_name: str, schema: str, n: int) -> int:
    """Reserve as many of n messages as still fit this month and return how many. Used where
    a partial send is the right answer (Extended Warranty reminders)."""
    if n <= 0 or not is_counted(db_name, schema):
        return max(n, 0)
    if await reserve_whatsapp(db_name, schema, n):
        return n
    usage = await get_bu_usage(db_name, schema)
    room = max(0, (usage["whatsappLimit"] or 0) - usage["whatsappUsed"])
    if room and await reserve_whatsapp(db_name, schema, min(room, n)):
        return min(room, n)
    return 0
