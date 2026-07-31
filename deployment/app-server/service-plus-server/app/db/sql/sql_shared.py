"""SQL constants for the shared domain.

Split from app/db/sql_store.py — see plans/plan.md Step 3.
"""


class SharedSql:
    """SQL constants for the shared domain."""

    # ── App Settings ──────────────────────────────────────────────────────────

    GET_APP_SETTINGS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, setting_key, setting_value, description, is_editable,
               created_at, updated_at
        FROM app_setting
        ORDER BY setting_key
    """

    GET_APP_SETTING_BY_KEY = """
        with "p_key" as (values(%(setting_key)s::text))
        SELECT id, setting_key, setting_value
        FROM app_setting
        WHERE setting_key = (table "p_key")
    """

    CHECK_APP_SETTING_KEY_EXISTS = """
        with "p_key" as (values(%(setting_key)s::text))
        -- with "p_key" as (values('default_gst_rate'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM app_setting
            WHERE LOWER(setting_key) = LOWER((table "p_key"))
        ) AS exists
    """

    CHECK_APP_SETTING_KEY_EXISTS_EXCLUDE_ID = """
        with
            "p_key" as (values(%(setting_key)s::text)),
            "p_id"  as (values(%(id)s::smallint))
        -- with
        --     "p_key" as (values('default_gst_rate'::text)), -- Test line
        --     "p_id"  as (values(1::smallint))               -- Test line
        SELECT EXISTS(
            SELECT 1 FROM app_setting
            WHERE LOWER(setting_key) = LOWER((table "p_key"))
              AND id <> (table "p_id")
        ) AS exists
    """

    # ── Scheduler ─────────────────────────────────────────────────────────────

    GET_ACTIVE_CLIENTS = """
        SELECT db_name FROM public.client WHERE is_active = true AND db_name IS NOT NULL
    """

    GET_ACTIVE_SCHEMAS = """
        SELECT code FROM security.bu WHERE is_active = true
    """
