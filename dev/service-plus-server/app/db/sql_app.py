class SqlApp:
    # ── Parts (spare_part_master) ─────────────────────────────────────────────

    CHECK_PART_CODE_EXISTS = """
        with
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_part_code" as (values(%(part_code)s::text))
        SELECT EXISTS(
            SELECT 1 FROM spare_part_master
            WHERE brand_id              = (table "p_brand_id")
              AND UPPER(part_code)      = UPPER((table "p_part_code"))
        ) AS exists
    """

    CHECK_PART_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_part_code" as (values(%(part_code)s::text)),
            "p_id"        as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM spare_part_master
            WHERE brand_id              = (table "p_brand_id")
              AND UPPER(part_code)      = UPPER((table "p_part_code"))
              AND id                   <> (table "p_id")
        ) AS exists
    """

    CHECK_PART_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job_part_used         WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM purchase_invoice_line WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM sales_invoice_line    WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_adjustment_line WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_transaction     WHERE part_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_PARTS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        ORDER BY b.name, p.part_code
    """

    GET_EXISTING_PART_CODES = """
        with "p_brand_id" as (values(%(brand_id)s::bigint))
        -- with "p_brand_id" as (values(1::bigint)) -- Test line
        SELECT UPPER(part_code) AS part_code
        FROM spare_part_master
        WHERE brand_id = (table "p_brand_id")
    """

    GET_PARTS_BY_BRAND_COUNT = """
        with
            "p_brand_id" as (values(%(brand_id)s::bigint)),
            "p_search"   as (values(%(search)s::text))
        -- with "p_brand_id" as (values(1::bigint)), "p_search" as (values(''::text)) -- Test line
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        WHERE p.brand_id = (table "p_brand_id")
          AND ((table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PARTS_BY_BRAND_PAGED = """
        with
            "p_brand_id" as (values(%(brand_id)s::bigint)),
            "p_search"   as (values(%(search)s::text)),
            "p_limit"    as (values(%(limit)s::int)),
            "p_offset"   as (values(%(offset)s::int))
        -- with "p_brand_id" as (values(1::bigint)), "p_search" as (values(''::text)), "p_limit" as (values(50::int)), "p_offset" as (values(0::int)) -- Test line
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.model, p.uom,
            p.cost_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active
        FROM spare_part_master p
        WHERE p.brand_id = (table "p_brand_id")
          AND ((table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PARTS_COUNT = """
        with "p_search" as (values(%(search)s::text))
        -- with "p_search" as (values(''::text)) -- Test line
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
    """

    GET_PARTS_PAGED = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        -- with "p_search" as (values(''::text)), "p_limit" as (values(50::int)), "p_offset" as (values(0::int)) -- Test line
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """
