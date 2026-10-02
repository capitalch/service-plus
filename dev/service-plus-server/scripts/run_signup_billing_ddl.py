"""Your Part D of plans/plan.md — create the sign-up and billing tables and columns.

Runs, each script in its own transaction (all are safe to run twice):

1. SignupServerSql.SALES_ENQUIRY_DDL      on the default customer database (DEFAULT_CUSTOMER_DB_NAME)
2. SignupServerSql.SALES_ENQUIRY_ENT_ALTER on service_plus_client (the control plane)
3. BillingServerSql.BU_BILLING_DDL         on every client database listed in public.client,
                                           plus service_plus_service (the template the
                                           schema dump and generated client types come from)

Nothing here creates a trigger. Existing BUs get billing_required = false and
branch_limit = null, so existing customers behave exactly as before.

Back up service_plus_client and every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from .env):
    python scripts/run_signup_billing_ddl.py --dry-run    # list the targets, change nothing
    python scripts/run_signup_billing_ddl.py              # run

Exit code 0 = every script ran.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.db.connection.psycopg_driver import (  # noqa: E402
    exec_sql,
    get_client_db_connection,
    get_service_db_connection,
)
from app.db.sql.sql_billing import BillingServerSql  # noqa: E402
from app.db.sql.sql_signups import SignupServerSql  # noqa: E402

TEMPLATE_DB = "service_plus_service"

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""


async def run_on_service_db(db_name: str, label: str, sql: str) -> bool:
    """Run one script on a tenant database in one transaction; report and return success."""
    try:
        async with get_service_db_connection(db_name) as conn:
            await conn.execute(sql)
            await conn.commit()
        print(f"  ok      {label} on {db_name}")
        return True
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  {label} on {db_name}: {e}")
        return False


async def run_on_client_db(label: str, sql: str) -> bool:
    """Run one script on service_plus_client in one transaction; report and return success."""
    try:
        async with get_client_db_connection() as conn:
            await conn.execute(sql)
            await conn.commit()
        print(f"  ok      {label} on {settings.client_db_name}")
        return True
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  {label} on {settings.client_db_name}: {e}")
        return False


async def main(dry_run: bool) -> int:
    default_db = (settings.default_customer_db_name or "").strip()
    if not default_db:
        print("DEFAULT_CUSTOMER_DB_NAME is empty in .env — set it first (Your Part B).")
        return 1

    rows = await exec_sql(db_name=None, schema="public", sql=LIST_CLIENT_DBS)
    tenant_dbs = [r["db_name"] for r in rows]
    if TEMPLATE_DB not in tenant_dbs:
        tenant_dbs.append(TEMPLATE_DB)

    print(f"1. SALES_ENQUIRY_DDL       -> {default_db}")
    print(f"2. SALES_ENQUIRY_ENT_ALTER -> {settings.client_db_name}")
    print(f"3. BU_BILLING_DDL          -> {', '.join(tenant_dbs)}")
    if default_db not in tenant_dbs:
        print(f"   warning: {default_db} is not any client's database")
    if dry_run:
        print("Dry run: nothing changed.")
        return 0

    results = [
        await run_on_service_db(default_db, "SALES_ENQUIRY_DDL", SignupServerSql.SALES_ENQUIRY_DDL),
        await run_on_client_db("SALES_ENQUIRY_ENT_ALTER", SignupServerSql.SALES_ENQUIRY_ENT_ALTER),
    ]
    for db_name in tenant_dbs:
        results.append(await run_on_service_db(db_name, "BU_BILLING_DDL", BillingServerSql.BU_BILLING_DDL))

    failed = results.count(False)
    print(f"Done: {len(results) - failed} ran, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="list the targets and change nothing")
    sys.exit(asyncio.run(main(parser.parse_args().dry_run)))
