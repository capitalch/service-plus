"""plans/plan.md Your Part B — monthly job and WhatsApp limits per plan.

For every client database listed in public.client, plus service_plus_service (the
template the schema dump and generated client types come from) when that database
exists on this server, it:
  1. adds security.bu.job_limit_monthly and security.bu.whatsapp_limit_monthly (nullable, >= 0),
  2. creates security.bu_usage (one row per BU per IST month),
  3. stamps the limits of Lite, Basic and Standard BUs from get_plan_limits() (Enterprise is left as is),
  4. prints each BU's plan, limits and the jobs it has created so far this month.

Each database runs in its own transaction, so one failure leaves the others done. Safe to
run again. The dry run does all of it and then rolls back, so the report is real.

Back up every tenant database first.

Usage (from service-plus-server/, inside the venv; the DB settings come from the env file):
    python scripts/run_plan_limits_ddl.py --dry-run                       # report, change nothing
    python scripts/run_plan_limits_ddl.py                                 # run
    python scripts/run_plan_limits_ddl.py --db service_plus_service       # one database only

Exit code 0 = every database ran.
"""

import argparse
import sys
from pathlib import Path

import psycopg
from psycopg import sql as pgsql

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.core.billing import today_ist  # noqa: E402
from app.core.plan_prices import get_plan_limits  # noqa: E402

METERED_PLANS = ("basic", "lite", "standard")

TEMPLATE_DB = "service_plus_service"

DDL = """
ALTER TABLE security.bu
    ADD COLUMN IF NOT EXISTS job_limit_monthly integer,
    ADD COLUMN IF NOT EXISTS whatsapp_limit_monthly integer;

ALTER TABLE security.bu DROP CONSTRAINT IF EXISTS bu_job_limit_check;
ALTER TABLE security.bu ADD CONSTRAINT bu_job_limit_check
    CHECK (job_limit_monthly IS NULL OR job_limit_monthly >= 0);

ALTER TABLE security.bu DROP CONSTRAINT IF EXISTS bu_whatsapp_limit_check;
ALTER TABLE security.bu ADD CONSTRAINT bu_whatsapp_limit_check
    CHECK (whatsapp_limit_monthly IS NULL OR whatsapp_limit_monthly >= 0);

CREATE TABLE IF NOT EXISTS security.bu_usage (
    bu_id bigint NOT NULL REFERENCES security.bu(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    jobs_used integer NOT NULL DEFAULT 0 CHECK (jobs_used >= 0),
    whatsapp_used integer NOT NULL DEFAULT 0 CHECK (whatsapp_used >= 0),
    PRIMARY KEY (bu_id, period_start)
);
"""

LIST_BUS = """
    SELECT code, plan_code, job_limit_monthly, whatsapp_limit_monthly FROM security.bu ORDER BY code
"""

LIST_CLIENT_DBS = """
    SELECT DISTINCT db_name FROM public.client WHERE db_name IS NOT NULL AND db_name <> '' ORDER BY db_name
"""

STAMP = """
    UPDATE security.bu
    SET job_limit_monthly = %(job_limit)s, whatsapp_limit_monthly = %(whatsapp_limit)s
    WHERE plan_code = %(plan_code)s
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


def jobs_this_month(cur: psycopg.Cursor, schema: str) -> int | None:
    """Jobs created this IST month in one BU schema, opening jobs excluded. None when the schema has no job table."""
    cur.execute("SELECT to_regclass(%s) IS NOT NULL", (f'"{schema}".job',))
    if not cur.fetchone()[0]:
        return None
    cur.execute(
        pgsql.SQL(
            "SELECT count(*) FROM {}.job WHERE NOT is_opening_job "
            "AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= %s"
        ).format(pgsql.Identifier(schema)),
        (today_ist().replace(day=1),),
    )
    return cur.fetchone()[0]


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
            for plan_code in METERED_PLANS:
                limits = get_plan_limits(plan_code)
                cur.execute(
                    STAMP,
                    {"job_limit": limits.jobs, "plan_code": plan_code, "whatsapp_limit": limits.whatsapp},
                )
                print(f"  stamped {cur.rowcount} {plan_code} BU(s): jobs={limits.jobs} whatsapp={limits.whatsapp}")
            cur.execute(LIST_BUS)
            for code, plan_code, job_limit, whatsapp_limit in cur.fetchall():
                used = jobs_this_month(cur, code.lower())
                over = " OVER JOB LIMIT" if job_limit is not None and used is not None and used >= job_limit else ""
                print(
                    f"  {code:<14} plan={plan_code or '-':<10} jobs={job_limit} "
                    f"whatsapp={whatsapp_limit} jobs_this_month={used}{over}"
                )
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
