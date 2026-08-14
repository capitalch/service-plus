"""Connection, schema listing, and per-schema SQL execution.

One function (`connect`) reaches both the control database and every tenant
database — they differ only in `dbname` (DESIGN.md §2). `run_sql_in_schema`
is the one place the per-schema transaction guarantee lives; everything else
just calls it and reads the MigrationResult back (DESIGN.md §8).
"""

import time

import psycopg
from psycopg import sql

from config import DbConnectionSettings
from models import ClientDb, MigrationResult, SchemaTarget

# Never a BU schema — always excluded from the schema picker. `pg_%` covers the
# whole Postgres-internal family in one go: pg_catalog, pg_toast,
# pg_toast_temp_N, pg_temp_N — not just the ones that happen to exist on
# whichever connection this was tested against.
_SYSTEM_SCHEMAS = {"security", "information_schema", "public"}

_GET_ACTIVE_CLIENT_DBS_SQL = """
    SELECT id, name, db_name
    FROM public.client
    WHERE is_active = true AND db_name IS NOT NULL
    ORDER BY name
"""

_LIST_SCHEMAS_SQL = """
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name != ALL(%(exclude)s)
      AND schema_name NOT LIKE 'pg\\_%%' ESCAPE '\\'
    ORDER BY schema_name
"""


def connect(settings: DbConnectionSettings, db_name: str) -> psycopg.Connection:
    """Open one connection to `db_name` on the shared host. Caller owns closing it —
    use as a context manager (`with connect(...) as conn:`)."""
    return psycopg.connect(
        host=settings.host,
        port=settings.port,
        user=settings.user,
        password=settings.password,
        dbname=db_name,
        connect_timeout=10,
    )


def test_connection(settings: DbConnectionSettings, control_db_name: str) -> None:
    """Raises with the real driver error message on failure; returns None on success."""
    with connect(settings, control_db_name) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")


def list_client_dbs(settings: DbConnectionSettings, control_db_name: str) -> list[ClientDb]:
    with connect(settings, control_db_name) as conn:
        with conn.cursor() as cur:
            cur.execute(_GET_ACTIVE_CLIENT_DBS_SQL)
            rows = cur.fetchall()
    return [ClientDb(id=row[0], name=row[1], db_name=row[2]) for row in rows]


def list_schemas(settings: DbConnectionSettings, db_name: str) -> list[str]:
    """Every schema in `db_name` except the fixed system/security schemas —
    i.e. exactly the BU schemas (DESIGN.md §2)."""
    with connect(settings, db_name) as conn:
        with conn.cursor() as cur:
            cur.execute(_LIST_SCHEMAS_SQL, {"exclude": list(_SYSTEM_SCHEMAS)})
            rows = cur.fetchall()
    return [row[0] for row in rows]


def _execute_in_schema(
    settings: DbConnectionSettings, target: SchemaTarget, sql_text: str, *, commit: bool
) -> MigrationResult:
    """Runs `sql_text` against `target` inside one transaction, then COMMITs
    (real run) or always ROLLBACKs (check — never writes anything) depending
    on `commit`. Never raises — the outcome is always the returned
    MigrationResult, so a caller looping over many targets never needs its
    own try/except (DESIGN.md §8)."""
    started = time.monotonic()
    try:
        with connect(settings, target.client.db_name) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL("SET search_path TO {}").format(sql.Identifier(target.schema_name))
                )
                cur.execute(sql_text)
            if commit:
                conn.commit()
            else:
                conn.rollback()
        return MigrationResult(
            target=target,
            success=True,
            error_message=None,
            duration_seconds=time.monotonic() - started,
        )
    except Exception as e:  # noqa: BLE001 - deliberately broad: any failure must be
        # captured and reported per-schema, never crash the batch (DESIGN.md §8).
        return MigrationResult(
            target=target,
            success=False,
            error_message=str(e),
            duration_seconds=time.monotonic() - started,
        )


def run_sql_in_schema(
    settings: DbConnectionSettings, target: SchemaTarget, sql_text: str
) -> MigrationResult:
    """Real run — COMMITs on success. See `_execute_in_schema`."""
    return _execute_in_schema(settings, target, sql_text, commit=True)


def check_sql_in_schema(
    settings: DbConnectionSettings, target: SchemaTarget, sql_text: str
) -> MigrationResult:
    """Dry-run — always ROLLBACKs, even on success, so a Check never writes
    anything. Used by the UI's Check step to validate the SQL against every
    selected target before Continue runs (and commits) for real."""
    return _execute_in_schema(settings, target, sql_text, commit=False)
