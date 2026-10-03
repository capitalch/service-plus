"""Billing status of one BU, cached for the view-only guard (plans/plan.md Step 11).

`get_bu_billing` reads security.bu at most once a minute per (database, BU): every write
checks it, so it must be cheap, and a payment recorded by another server process is seen
within BU_BILLING_CACHE_SECONDS. A process that changes billing calls `clear_bu_billing`
so its own next request sees the change at once.
"""

import time
from datetime import date
from typing import Any

from app.core.billing import compute_billing_status, today_ist
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_billing import BillingServerSql

BU_BILLING_CACHE_SECONDS = 60

_cache: dict[tuple[str, str], tuple[float, dict]] = {}


def billing_summary(row: dict | None, today: date) -> dict[str, Any]:
    """{status, paidThrough, planCode, branchLimit} of a security.bu row (None = no such BU,
    treated as not billed)."""
    row = row or {}
    paid_through = row.get("paid_through")
    return {
        "branchLimit": row.get("branch_limit"),
        "paidThrough": paid_through.isoformat() if isinstance(paid_through, date) else paid_through,
        "planCode": row.get("plan_code"),
        "status": compute_billing_status(row, today),
    }


async def get_bu_billing(db_name: str, schema: str) -> dict[str, Any]:
    """The BU's billing summary, from the cache when fresh."""
    key = (db_name, (schema or "").lower())
    hit = _cache.get(key)
    now = time.monotonic()
    if hit and hit[0] > now:
        return hit[1]
    rows = await exec_sql(db_name, "security", BillingServerSql.GET_BU_BILLING_BY_CODE, {"code": key[1]})
    summary = billing_summary(rows[0] if rows else None, today_ist())
    _cache[key] = (now + BU_BILLING_CACHE_SECONDS, summary)
    return summary


def clear_bu_billing(db_name: str, schema: str | None = None) -> None:
    """Forget the cached status of one BU, or of every BU of the database (an Enterprise
    client's BUs share their dates)."""
    for key in list(_cache):
        if key[0] == db_name and (schema is None or key[1] == schema.lower()):
            del _cache[key]
