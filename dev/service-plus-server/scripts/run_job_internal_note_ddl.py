"""Your Part B of plans/plan.md — internal notes on jobs.

Per database (every database listed in public.client, plus service_plus_service — the
template the schema dump and generated client types come from — when it exists on this
server):

- adds access right 21 JOBS_INTERNAL_NOTES_MANAGE to `security` and grants it to the
  MANAGER role (role 1) — the same rows SeedSecurityData.ACCESS_RIGHT_SEED_SQL carries;
- runs scripts/job_internal_note_schema.sql in every schema that has a `job` table.

Every step runs in its own transaction, so one failure leaves the others done. Safe to
run again. Back up every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from .env):
    python scripts/run_job_internal_note_ddl.py --dry-run    # list the targets, change nothing
    python scripts/run_job_internal_note_ddl.py              # run

Exit code 0 = every step ran.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from psycopg import sql

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection  # noqa: E402

TEMPLATE_DB = "service_plus_service"

TABLE_DDL = (Path(__file__).resolve().parent / "job_internal_note_schema.sql").read_text(encoding="utf-8")

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

TEMPLATE_DB_EXISTS = """
    SELECT 1 AS found FROM pg_database WHERE datname = %(db_name)s
"""

LIST_BU_SCHEMAS = """
    SELECT schemaname FROM pg_tables WHERE tablename = 'job' ORDER BY schemaname
"""

# Fails loudly rather than let ON CONFLICT silently skip an id that belongs to another right.
ACCESS_RIGHT_SQL = """
    DO $$
    DECLARE
        taken_by text;
    BEGIN
        SELECT code INTO taken_by FROM security.access_right WHERE id = 21;
        IF taken_by IS NOT NULL AND taken_by <> 'JOBS_INTERNAL_NOTES_MANAGE' THEN
            RAISE EXCEPTION 'access_right id 21 is already used by "%"', taken_by;
        END IF;
        IF EXISTS (SELECT 1 FROM security.access_right WHERE code = 'JOBS_INTERNAL_NOTES_MANAGE' AND id <> 21) THEN
            RAISE EXCEPTION 'JOBS_INTERNAL_NOTES_MANAGE exists under an id other than 21';
        END IF;
    END $$;

    INSERT INTO security.access_right (id, code, name, module, description)
    OVERRIDING SYSTEM VALUE VALUES
        (21, 'JOBS_INTERNAL_NOTES_MANAGE', 'Edit Internal Notes', 'JOBS', 'Edit or delete internal notes on a job')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO security.role_access_right (role_id, access_right_id) VALUES (1, 21)
    ON CONFLICT (role_id, access_right_id) DO NOTHING;
"""


async def list_bu_schemas(db_name: str) -> list[str] | None:
    """Every schema in the database that has a job table; None if the database cannot be read."""
    try:
        async with get_service_db_connection(db_name) as conn:
            cur = await conn.execute(LIST_BU_SCHEMAS)
            return [r[0] for r in await cur.fetchall()]
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  listing schemas on {db_name}: {e}")
        return None


async def run_access_right(db_name: str) -> bool:
    """Add right 21 and its MANAGER mapping to this database's security schema."""
    try:
        async with get_service_db_connection(db_name) as conn:
            await conn.execute(ACCESS_RIGHT_SQL)
            await conn.commit()
        print(f"  ok      {db_name}.security (right 21)")
        return True
    except Exception as e:  # pylint: disable=broad-except
        print(f"  FAILED  {db_name}.security: {e}")
        return False


async def run_on_schema(db_name: str, schema: str) -> bool:
    """Create the table in one BU schema, in one transaction."""
    try:
        async with get_service_db_connection(db_name) as conn:
            await conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
            await conn.execute(TABLE_DDL)
            await conn.commit()
        print(f"  ok      {db_name}.{schema}")
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

    targets: dict[str, list[str]] = {}
    listing_failed = 0
    for db_name in tenant_dbs:
        schemas = await list_bu_schemas(db_name)
        if schemas is None:
            listing_failed += 1
            continue
        print(f"{db_name}: {', '.join(schemas) or '(no BU schema)'}")
        targets[db_name] = schemas

    if dry_run:
        n_schemas = sum(len(s) for s in targets.values())
        print(f"Dry run: {len(targets)} database(s), {n_schemas} schema(s) would run; nothing changed.")
        return 1 if listing_failed else 0

    results: list[bool] = []
    for db_name, schemas in targets.items():
        results.append(await run_access_right(db_name))
        results.extend([await run_on_schema(db_name, s) for s in schemas])
    failed = results.count(False) + listing_failed
    print(f"Done: {results.count(True)} ran, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="list the targets and change nothing")
    sys.exit(asyncio.run(main(parser.parse_args().dry_run)))
