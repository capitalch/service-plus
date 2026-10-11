"""plans/plan.md Step 2 — take MASTERS_SERVICE_CONFIG away from the MANAGER role.

Runs the same DELETE as scripts/revoke_manager_service_config.sql in the `security` schema
of every client database listed in public.client, plus service_plus_service (the template)
when that database exists on this server. The default customer database that hosts the
shared Lite/Basic/Standard tenants is a public.client row too, so it is covered. Each
database runs in its own transaction, so one failure leaves the others done. Safe to run
again: the first run reports 1 grant removed, later runs 0.

The dry run changes nothing; it reports whether each database still has the Manager grant.

Back up every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from the env file):
    python scripts/run_revoke_manager_service_config.py --dry-run    # report only
    python scripts/run_revoke_manager_service_config.py              # run

Exit code 0 = every database ran.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection  # noqa: E402

TEMPLATE_DB = "service_plus_service"

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

TEMPLATE_DB_EXISTS = """
    SELECT 1 AS found FROM pg_database WHERE datname = %(db_name)s
"""

COUNT_MANAGER_GRANT = """
    SELECT COUNT(*) AS n
    FROM security.role_access_right ra
    JOIN security.role r ON r.id = ra.role_id
    JOIN security.access_right a ON a.id = ra.access_right_id
    WHERE r.code = 'MANAGER' AND a.code = 'MASTERS_SERVICE_CONFIG'
"""

# Same statement as scripts/revoke_manager_service_config.sql.
REVOKE_MANAGER_GRANT = """
    DELETE FROM security.role_access_right
    WHERE role_id = (SELECT id FROM security.role WHERE code = 'MANAGER')
      AND access_right_id = (SELECT id FROM security.access_right WHERE code = 'MASTERS_SERVICE_CONFIG')
"""


async def report_db(db_name: str) -> bool:
    """Print whether the Manager grant is still there; change nothing."""
    try:
        async with get_service_db_connection(db_name) as conn:
            cur = conn.cursor(row_factory=dict_row)
            await cur.execute(COUNT_MANAGER_GRANT)
            n = (await cur.fetchone())["n"]
        print(f"  {'GRANTED' if n else 'clean  '} {db_name}: Manager {'still has' if n else 'does not have'} the right")
        return True
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  {db_name}: {e}")
        return False


async def run_on_db(db_name: str) -> bool:
    """Remove the Manager grant from one database in one transaction."""
    try:
        async with get_service_db_connection(db_name) as conn:
            cur = await conn.execute(REVOKE_MANAGER_GRANT)
            removed = cur.rowcount
            await conn.commit()
        print(f"  ok      {db_name}: {removed} grant(s) removed")
        return True
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  {db_name}: {e}")
        return False


async def main(dry_run: bool) -> int:
    rows = await exec_sql(db_name=None, schema="public", sql=LIST_CLIENT_DBS)
    targets = [r["db_name"] for r in rows]
    template_found = await exec_sql(
        db_name=None, schema="public", sql=TEMPLATE_DB_EXISTS, sql_args={"db_name": TEMPLATE_DB}
    )
    if template_found and TEMPLATE_DB not in targets:
        targets.append(TEMPLATE_DB)
    if not template_found:
        print(f"note: template {TEMPLATE_DB} is not on this server; skipped")

    runner = report_db if dry_run else run_on_db
    results = [await runner(db_name) for db_name in targets]
    failed = results.count(False)
    if dry_run:
        print(f"Dry run: {len(targets)} database(s) checked; nothing changed.")
    else:
        print(f"Done: {results.count(True)} ran, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report only; change nothing")
    sys.exit(asyncio.run(main(parser.parse_args().dry_run)))
