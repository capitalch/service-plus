"""plans/plan.md Step 1 / Your Part B — email is a login's only identity; mobile may repeat.

For every client database listed in public.client, plus service_plus_service (the
template the schema dump and generated client types come from) when that database
exists on this server, it:
  1. lists users whose emails differ only in letter case, and skips that database when
     there are any (merge them by hand, then run again),
  2. drops the unique index user_mobile_unique_idx and creates the plain index
     user_mobile_idx on security."user"(mobile), so two users may share a mobile,
  3. creates the unique index user_email_lower_key on security."user"(lower(email)),
  4. prints the user count and how many mobiles are now shared.

user_email_key UNIQUE (email) is left in place; it is harmless next to the lower-case index.

Each database runs in its own transaction, so one failure leaves the others done. Safe to
run again. The dry run does all of it and then rolls back, so the report is real.

Back up every tenant database first. New tenants already get the same indexes:
app/db/schema_dumps/service_plus_service.sql carries them and sql_bu_admin_ddl.py was
regenerated from it with `python -m app.db.tools.extract_schema`.

Usage (from service-plus-server/, inside the venv; the DB settings come from the env file):
    python scripts/run_user_identity_ddl.py --dry-run                     # report, change nothing
    python scripts/run_user_identity_ddl.py                               # run
    python scripts/run_user_identity_ddl.py --db service_plus_service     # one database only

Exit code 0 = every database ran.
"""

import argparse
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

TEMPLATE_DB = "service_plus_service"

CASE_DUPLICATE_EMAILS = """
    SELECT lower(email) AS email, string_agg(username || ' (id ' || id || ')', ', ' ORDER BY id) AS users
    FROM security."user"
    GROUP BY lower(email)
    HAVING count(*) > 1
    ORDER BY 1
"""

DDL = """
DROP INDEX IF EXISTS security.user_mobile_unique_idx;

CREATE INDEX IF NOT EXISTS user_mobile_idx
    ON security."user" USING btree (mobile) WHERE (mobile IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS user_email_lower_key
    ON security."user" USING btree (lower(email));
"""

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

REPORT = """
    SELECT
        (SELECT count(*) FROM security."user") AS users,
        (SELECT count(*) FROM (
            SELECT mobile FROM security."user" WHERE mobile IS NOT NULL GROUP BY mobile HAVING count(*) > 1
        ) AS m) AS shared_mobiles
"""

TEMPLATE_DB_EXISTS = """
    SELECT 1 FROM pg_database WHERE datname = %(db_name)s
"""

USER_INDEXES = """
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'security' AND tablename = 'user'
      AND indexname IN ('user_email_lower_key', 'user_mobile_idx', 'user_mobile_unique_idx')
    ORDER BY indexname
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


def user_indexes(cur: psycopg.Cursor) -> str:
    cur.execute(USER_INDEXES)
    return ", ".join(row[0] for row in cur.fetchall()) or "-"


def run_on_db(dbname: str, dry_run: bool) -> bool:
    print(f"\n=== {dbname} ===")
    try:
        with connect(dbname, is_client=False) as conn, conn.cursor() as cur:
            cur.execute("""SELECT to_regclass('security."user"') IS NOT NULL""")
            if not cur.fetchone()[0]:
                print('  no security."user" — skipped')
                return True
            cur.execute(CASE_DUPLICATE_EMAILS)
            duplicates = cur.fetchall()
            if duplicates:
                print("  emails that differ only in letter case — merge these users, then run again:")
                for email, users in duplicates:
                    print(f"    {email}: {users}")
                print("  SKIPPED")
                return False
            print(f"  indexes before: {user_indexes(cur)}")
            cur.execute(DDL)
            print(f"  indexes after:  {user_indexes(cur)}")
            cur.execute(REPORT)
            users, shared_mobiles = cur.fetchone()
            print(f"  users={users} shared_mobiles={shared_mobiles}")
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
