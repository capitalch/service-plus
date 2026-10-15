"""plans/plan.md Your Part A — per-BU features switched on by the Super Admin.

For every client database listed in public.client, plus service_plus_service (the
template the schema dump and generated client types come from) when that database
exists on this server, it:
  1. adds security.bu.features (text[], NOT NULL, default empty — every feature off),
  2. prints each BU with its features.

Each database runs in its own transaction, so one failure leaves the others done. Safe to
run again. The dry run does all of it and then rolls back, so the report is real.

Back up every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from the env file):
    python scripts/run_bu_features_ddl.py --dry-run                       # report, change nothing
    python scripts/run_bu_features_ddl.py                                 # run
    python scripts/run_bu_features_ddl.py --db service_plus_service       # one database only

Exit code 0 = every database ran.
"""

import argparse
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

TEMPLATE_DB = "service_plus_service"

DDL = """
ALTER TABLE security.bu ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}'::text[] NOT NULL;
"""

LIST_BUS = """
    SELECT code, is_active, features FROM security.bu ORDER BY code
"""

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

TEMPLATE_DB_EXISTS = """
    SELECT 1 FROM pg_database WHERE datname = %(db_name)s
"""


def connect(dbname: str, is_client: bool) -> psycopg.Connection:
    prod = settings.app_env == "production"
    if is_client:
        host = settings.client_db_ip_address if prod else settings.client_db_host
        port = settings.client_db_internal_port if prod else settings.client_db_port
        user, password = settings.client_db_user, settings.client_db_password
    else:
        host = settings.service_db_ip_address if prod else settings.service_db_host
        port = settings.service_db_internal_port if prod else settings.service_db_port
        user, password = settings.service_db_user, settings.service_db_password
    return psycopg.connect(host=host, port=port, user=user, password=password, dbname=dbname)


def list_target_dbs() -> list[str]:
    with connect(settings.client_db_name, is_client=True) as conn, conn.cursor() as cur:
        cur.execute(LIST_CLIENT_DBS)
        dbs = [row[0] for row in cur.fetchall()]
        cur.execute(TEMPLATE_DB_EXISTS, {"db_name": TEMPLATE_DB})
        if cur.fetchone() is None:
            print(f"note: template {TEMPLATE_DB} is not on this server; skipped")
        elif TEMPLATE_DB not in dbs:
            dbs.append(TEMPLATE_DB)
    return dbs


def run_on_db(dbname: str, dry_run: bool) -> bool:
    print(f"\n=== {dbname} ===")
    try:
        with connect(dbname, is_client=False) as conn, conn.cursor() as cur:
            cur.execute("SELECT to_regclass('security.bu') IS NOT NULL")
            if not cur.fetchone()[0]:
                print("  no security.bu — skipped")
                return True
            cur.execute(DDL)
            cur.execute(LIST_BUS)
            for code, is_active, features in cur.fetchall():
                state = "" if is_active else " (inactive)"
                print(f"  {code:<14} features={', '.join(features) or '-'}{state}")
            if dry_run:
                conn.rollback()
                print("  dry run — rolled back")
            else:
                conn.commit()
                print("  committed")
        return True
    except psycopg.Error as e:
        print(f"  FAILED: {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", action="append", help="only this database (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="report, then roll back")
    args = parser.parse_args()

    dbs = args.db or list_target_dbs()
    print(f"Databases: {', '.join(dbs)}  ({'dry run' if args.dry_run else 'RUN'})")
    results = [run_on_db(dbname, args.dry_run) for dbname in dbs]
    print(f"\n{sum(results)} of {len(results)} database(s) ok.")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
