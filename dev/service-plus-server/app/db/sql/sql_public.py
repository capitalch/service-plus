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
            js.code AS status_code,
            js.description AS status_description,
            TRIM(CONCAT_WS(' ', bn.name, p.name, pbm.model_name)) AS device_details,
            j.serial_no
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            bn  ON bn.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE LOWER(j.job_no) = LOWER((table "p_job_no"))
          AND cc.mobile = (table "p_mobile")
    """

    GET_PUBLIC_OPEN_JOBS_BY_MOBILE = """
        with
            "p_mobile" as (values(%(mobile)s::text))
        SELECT
            cc.full_name AS customer_name,
            j.job_no,
            j.job_date,
            j.delivery_date,
            j.is_closed,
            js.name AS job_status_name,
            js.code AS status_code,
            js.description AS status_description,
            TRIM(CONCAT_WS(' ', bn.name, p.name, pbm.model_name)) AS device_details,
            j.serial_no
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            bn  ON bn.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE cc.mobile = (table "p_mobile")
          AND j.is_closed = false
        ORDER BY j.job_date DESC NULLS LAST
    """

    # ── Spare Parts – Web Catalogue (public, §5) ────────────────────────────────
    # `price` is shown deliberately — it's the catalogue price being browsed —
    # but no internal ids: no branch_id, no part_id (spare_part_master FK), no
    # hsn_code. `id` below is spare_part_web's own id, the public-facing
    # catalogue identifier the frontend needs for cart/order lines, not an
    # internal FK the "no internal ids" rule is guarding against. `part_code`
    # (via a LEFT JOIN on part_id — the FK itself is still never selected) is a
    # human-facing catalogue code, not an internal id, so it's fine to expose;
    # it's LEFT JOIN, not JOIN, since part_id is nullable.
    #
    # The list query also ships the full `images` gallery, not just the cover —
    # the catalogue grid lets shoppers flip through a part's photos inline
    # without opening the detail dialog, so every card needs its full set. Same
    # reasoning for `brand_name` (LEFT JOIN via spm.brand_id, the FK itself never
    # selected): the card shows it beside the part code, so list and detail now
    # select the identical column set.

    GET_ACTIVE_BRANCHES = """
        with "dummy" as (values(1::int))
        SELECT id, code, name, phone, email, address_line1, address_line2, city, pincode,
               is_head_office
        FROM branch
        WHERE is_active = true
        ORDER BY is_head_office DESC, code
    """

    # Company-level catalogue size for the /companies dropdown. Counts only what a
    # shopper could actually reach — active parts in active branches — so it stays
    # consistent with what GET_SPARE_PART_WEB_PUBLIC_LIST would return across every
    # branch of the company. Run once per BU on each (cached) directory refresh.
    COUNT_ACTIVE_SPARE_PARTS_WEB = """
        with "dummy" as (values(1::int))
        SELECT COUNT(*) AS total
        FROM spare_part_web sp
        JOIN branch b ON b.id = sp.branch_id
        WHERE sp.is_active = true AND b.is_active = true
    """

    GET_SPARE_PART_WEB_PUBLIC_LIST = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sp.id, sp.part_name, sp.part_description, sp.price, sp.model,
            sp.image_urls[1] AS image_url, sp.image_urls AS images, spm.part_code,
            b.name AS brand_name
        FROM spare_part_web sp
        LEFT JOIN spare_part_master spm ON spm.id = sp.part_id
        LEFT JOIN brand b ON b.id = spm.brand_id
        WHERE sp.branch_id = (table "p_branch_id")
          AND sp.is_active = true
          AND (
                (table "p_search") = ''
             OR LOWER(sp.part_name)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
             OR LOWER(COALESCE(sp.part_description, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
             OR LOWER(COALESCE(sp.model, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
          )
        ORDER BY sp.part_name
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SPARE_PART_WEB_PUBLIC_LIST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM spare_part_web
        WHERE branch_id = (table "p_branch_id")
          AND is_active = true
          AND (
                (table "p_search") = ''
             OR LOWER(part_name)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
             OR LOWER(COALESCE(part_description, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
             OR LOWER(COALESCE(model, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
          )
    """

    GET_SPARE_PART_WEB_PUBLIC_DETAIL = """
        with
            "p_id"        as (values(%(id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            sp.id, sp.part_name, sp.part_description, sp.price, sp.model,
            sp.image_urls[1] AS image_url, sp.image_urls AS images, spm.part_code,
            b.name AS brand_name
        FROM spare_part_web sp
        LEFT JOIN spare_part_master spm ON spm.id = sp.part_id
        LEFT JOIN brand b ON b.id = spm.brand_id
        WHERE sp.id = (table "p_id")
          AND sp.branch_id = (table "p_branch_id")
          AND sp.is_active = true
    """

    # Order submission (§5's POST /api/public/part-orders). Deliberately NOT
    # filtered by branch_id/is_active here — the route re-fetches every requested
    # id unconditionally and checks branch/active in Python so it can return a
    # specific per-line reason (not found vs. inactive vs. wrong branch) instead
    # of a single opaque "some lines are invalid".
    GET_SPARE_PART_WEB_FOR_ORDER = """
        SELECT id, price, is_active, branch_id
        FROM spare_part_web
        WHERE id = ANY(%(ids)s::bigint[])
    """

    INSERT_SPARE_PART_WEB_ORDER = """
        INSERT INTO spare_part_web_order
            (branch_id, customer_name, mobile, email, remarks, total_amount)
        VALUES
            (%(branch_id)s, %(customer_name)s, %(mobile)s, %(email)s, %(remarks)s, %(total_amount)s)
        RETURNING id
    """

    INSERT_SPARE_PART_WEB_ORDER_LINE = """
        INSERT INTO spare_part_web_order_line
            (spare_part_web_order_id, spare_part_web_id, qty, unit_price, line_total)
        VALUES
            (%(order_id)s, %(spare_part_web_id)s, %(qty)s, %(unit_price)s, %(line_total)s)
    """
