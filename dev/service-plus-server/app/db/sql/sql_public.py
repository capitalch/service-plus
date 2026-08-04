"""SQL constants for the public, read-only website API (`/api/public/*`).

Deliberately kept separate from SqlStore (app/db/sql/sql_base.py): these are
minimal, whitelisted-column variants for an anonymous public caller and must
never be conflated with the internal admin/GraphQL queries they're modeled on
(GET_CLIENT_DB_NAMES / GET_ALL_BUS in sql_bu_admin.py, GET_JOB_DETAIL in
sql_jobs.py) — no amounts, no internal ids, no SELECT *.
"""


class PublicSql:
    """SQL constants for the public website's read-only endpoints."""

    GET_ACTIVE_CLIENT_DBS = """
        with "dummy" as (values(1::int))
        SELECT id, name, db_name
        FROM public.client
        WHERE is_active = true AND db_name IS NOT NULL
        ORDER BY name
    """

    LIST_ACTIVE_BUS = """
        with "dummy" as (values(1::int))
        SELECT id, code, name
        FROM security.bu
        WHERE is_active = true
        ORDER BY name
    """

    GET_PUBLIC_JOB_STATUS = """
        with
            "p_job_no" as (values(%(job_no)s::text)),
            "p_mobile" as (values(%(mobile)s::text))
        SELECT
            j.job_no,
            j.job_date,
            j.delivery_date,
            j.is_closed,
            js.name AS job_status_name,
            TRIM(CONCAT_WS(' ', bn.name, p.name, pbm.model_name)) AS device_details,
            br.name AS branch_name
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            bn  ON bn.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        LEFT JOIN branch           br  ON br.id  = j.branch_id
        WHERE LOWER(j.job_no) = LOWER((table "p_job_no"))
          AND cc.mobile = (table "p_mobile")
    """
