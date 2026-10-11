"""Replace the invalid default HSN 11236 with SAC 998719 in app setting show_parts_in_job_invoice.

Runs in every BU schema (every schema that has an `app_setting` table) of every client database
listed in public.client, plus service_plus_service (the template) when that database exists on
this server. Only a setting whose hsn is still exactly 11236 is changed, so a value an Admin
already edited is left alone. Each schema runs in its own transaction. Safe to run again: later
runs report 0 rows.

Back up every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from the env file):
    python scripts/run_fix_show_parts_hsn.py --dry-run    # report current hsn per schema
    python scripts/run_fix_show_parts_hsn.py              # run

Exit code 0 = every schema ran.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from psycopg import sql

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection  # noqa: E402

TEMPLATE_DB = "service_plus_service"
OLD_HSN = "11236"
NEW_HSN = 998719

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

TEMPLATE_DB_EXISTS = """
    SELECT 1 AS found FROM pg_database WHERE datname = %(db_name)s
"""

LIST_BU_SCHEMAS = """
    SELECT schemaname FROM pg_tables WHERE tablename = 'app_setting' ORDER BY schemaname
"""

GET_HSN = """
    SELECT setting_value->>'hsn' FROM app_setting WHERE setting_key = 'show_parts_in_job_invoice'
"""

# Only rows still carrying the old value; the ->> comparison matches both 11236 and "11236".
FIX_HSN = """
    UPDATE app_setting
    SET setting_value = jsonb_set(setting_value, '{hsn}', to_jsonb(%(new_hsn)s::int))
    WHERE setting_key = 'show_parts_in_job_invoice' AND setting_value->>'hsn' = %(old_hsn)s
"""


async def list_bu_schemas(db_name: str) -> list[str] | None:
    """Every schema in the database that has an app_setting table; None if the database cannot be read."""
    try:
        async with get_service_db_connection(db_name) as conn:
            cur = await conn.execute(LIST_BU_SCHEMAS)
            return [r[0] for r in await cur.fetchall()]
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  listing schemas on {db_name}: {e}")
        return None


async def run_on_schema(db_name: str, schema: str, dry_run: bool) -> bool:
    """Report (dry run) or fix the hsn in one BU schema, in one transaction."""
    try:
        async with get_service_db_connection(db_name) as conn:
            await conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
            if dry_run:
                row = await (await conn.execute(GET_HSN)).fetchone()
                print(f"  hsn={row[0] if row else '(setting missing)'}  {db_name}.{schema}")
                return True
            cur = await conn.execute(FIX_HSN, {"new_hsn": NEW_HSN, "old_hsn": OLD_HSN})
            changed = cur.rowcount
            await conn.commit()
        print(f"  ok      {db_name}.{schema}: {changed} row(s) updated")
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
        targets.extend((db_name, s) for s in schemas)

    results = [await run_on_schema(db_name, schema, dry_run) for db_name, schema in targets]
    failed = results.count(False) + listing_failed
    print(f"{'Dry run: nothing changed. ' if dry_run else ''}Done: {results.count(True)} ok, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report only; change nothing")
    sys.exit(asyncio.run(main(parser.parse_args().dry_run)))
