"""Your Part B of plans/plan2.md — give every branch a default division.

Runs DivisionServerSql.DEFAULT_DIVISION_DDL once in every BU schema (every schema that
has a `division` table) of every client database listed in public.client, plus
service_plus_service (the template the schema dump and generated client types come
from) when that database exists on this server. Each schema runs in its own
transaction, so one failure leaves the others done. Safe to run again.

Per schema it adds division.is_default with its one-per-branch index, makes the
division -> branch foreign key ON DELETE CASCADE, marks a default in every branch,
adds Main to branches with no division, and retires app setting default_division_id
(closing the id gap). Nothing here creates a trigger.

Back up every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from .env):
    python scripts/run_default_division_ddl.py --dry-run    # list the targets, change nothing
    python scripts/run_default_division_ddl.py              # run

Exit code 0 = every schema ran.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from psycopg import sql
from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection  # noqa: E402
from app.db.sql.sql_divisions import DivisionServerSql  # noqa: E402

TEMPLATE_DB = "service_plus_service"

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

TEMPLATE_DB_EXISTS = """
    SELECT 1 AS found FROM pg_database WHERE datname = %(db_name)s
"""

LIST_BU_SCHEMAS = """
    SELECT schemaname FROM pg_tables WHERE tablename = 'division' ORDER BY schemaname
"""


async def list_bu_schemas(db_name: str) -> list[str] | None:
    """Every schema in the database that has a division table; None if the database cannot be read."""
    try:
        async with get_service_db_connection(db_name) as conn:
            cur = await conn.execute(LIST_BU_SCHEMAS)
            return [r[0] for r in await cur.fetchall()]
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  listing schemas on {db_name}: {e}")
        return None


async def run_on_schema(db_name: str, schema: str) -> bool:
    """Run the script on one BU schema in one transaction; print each branch's default."""
    try:
        async with get_service_db_connection(db_name) as conn:
            await conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
            await conn.execute(DivisionServerSql.DEFAULT_DIVISION_DDL)
            cur = conn.cursor(row_factory=dict_row)
            await cur.execute(DivisionServerSql.GET_BRANCH_DEFAULTS)
            defaults = await cur.fetchall()
            await conn.commit()
        print(f"  ok      {db_name}.{schema}")
        for d in defaults:
            print(f"            branch {d['branch_code']}: default division {d['division_id']} {d['division_code']}")
        return True
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  {db_name}.{schema}: {e}")
        return False


async def main(dry_run: bool) -> int:
    rows = await exec_sql(db_name=None, schema="public", sql=LIST_CLIENT_DBS)
    tenant_dbs = [r["db_name"] for r in rows]
    template_found = await exec_sql(
        db_name=None, schema="public", sql=TEMPLATE_DB_EXISTS, sql_args={"db_name": TEMPLATE_DB}
    )
    if template_found and TEMPLATE_DB not in tenant_dbs:
        tenant_dbs.append(TEMPLATE_DB)
    if not template_found:
        print(f"note: template {TEMPLATE_DB} is not on this server; skipped")

    targets: list[tuple[str, str]] = []
    listing_failed = 0
    for db_name in tenant_dbs:
        schemas = await list_bu_schemas(db_name)
        if schemas is None:
            listing_failed += 1
            continue
        print(f"{db_name}: {', '.join(schemas) or '(no BU schema)'}")
        targets.extend((db_name, s) for s in schemas)

    if dry_run:
        print(f"Dry run: {len(targets)} schema(s) would run; nothing changed.")
        return 1 if listing_failed else 0

    results = [await run_on_schema(db_name, schema) for db_name, schema in targets]
    failed = results.count(False) + listing_failed
    print(f"Done: {results.count(True)} ran, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="list the targets and change nothing")
    sys.exit(asyncio.run(main(parser.parse_args().dry_run)))
