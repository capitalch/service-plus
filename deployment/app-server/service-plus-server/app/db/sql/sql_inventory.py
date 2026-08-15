"""SQL constants for the inventory domain.

Split from app/db/sql_store.py — see plans/plan.md Step 3.
"""


class InventorySql:
    """SQL constants for the inventory domain."""

    # ── Brands ────────────────────────────────────────────────────────────────

    CHECK_BRAND_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('SAMSUNG'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM brand
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_BRAND_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_code" as (values('SAMSUNG'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))        -- Test line
        SELECT EXISTS(
            SELECT 1 FROM brand
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_BRAND_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM spare_part_master   WHERE brand_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM product_brand_model WHERE brand_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_ADDITIONAL_CHARGES = """
        with "dummy" as (values(1::int))
        SELECT id, name, hsn_code
        FROM additional_charge
        ORDER BY name
    """

    GET_ALL_BRANDS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, is_active,
               false       AS is_system,
               NULL::text  AS description,
               NULL::int   AS display_order,
               NULL::text  AS prefix
        FROM brand
        ORDER BY name
    """

    # ── Models (product_brand_model) ──────────────────────────────────────────

    CHECK_MODEL_EXISTS = """
        with
            "p_product_id" as (values(%(product_id)s::bigint)),
            "p_brand_id"   as (values(%(brand_id)s::bigint)),
            "p_model_name" as (values(%(model_name)s::text))
        SELECT EXISTS(
            SELECT 1 FROM product_brand_model
            WHERE product_id            = (table "p_product_id")
              AND brand_id              = (table "p_brand_id")
              AND UPPER(model_name)     = UPPER((table "p_model_name"))
        ) AS exists
    """

    CHECK_MODEL_EXISTS_EXCLUDE_ID = """
        with
            "p_product_id" as (values(%(product_id)s::bigint)),
            "p_brand_id"   as (values(%(brand_id)s::bigint)),
            "p_model_name" as (values(%(model_name)s::text)),
            "p_id"         as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM product_brand_model
            WHERE product_id            = (table "p_product_id")
              AND brand_id              = (table "p_brand_id")
              AND UPPER(model_name)     = UPPER((table "p_model_name"))
              AND id                   <> (table "p_id")
        ) AS exists
    """

    CHECK_MODEL_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE product_brand_model_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_MODELS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            m.id, m.product_id, m.brand_id, m.model_name,
            m.launch_year, m.remarks, m.is_active,
            p.name AS product_name,
            b.name AS brand_name
        FROM product_brand_model m
        JOIN product p ON p.id = m.product_id
        JOIN brand   b ON b.id = m.brand_id
        ORDER BY p.name, b.name, m.model_name
    """

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

    GET_PARTS_USAGE_STATS_BY_BRAND = """
        with "p_brand_id" as (values(%(brand_id)s::bigint))
        -- with "p_brand_id" as (values(1::bigint)) -- Test line
        SELECT
            COUNT(*)                                                          AS total,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM job_part_used         WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM purchase_invoice_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM sales_invoice_line    WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_adjustment_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_transaction     WHERE part_id = p.id
            ))                                                                AS in_use_count,
            COUNT(*) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM job_part_used         WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM purchase_invoice_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM sales_invoice_line    WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_adjustment_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_transaction     WHERE part_id = p.id
            ))                                                                AS deletable_count
        FROM spare_part_master p
        WHERE p.brand_id = (table "p_brand_id")
    """

    DELETE_UNUSED_PARTS_BY_BRAND = """
        with "p_brand_id" as (values(%(brand_id)s::bigint))
        -- with "p_brand_id" as (values(1::bigint)) -- Test line
        DELETE FROM spare_part_master
        WHERE brand_id = (table "p_brand_id")
          AND NOT EXISTS (
              SELECT 1 FROM job_part_used         WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM purchase_invoice_line WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM sales_invoice_line    WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM stock_adjustment_line WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM stock_transaction     WHERE part_id = spare_part_master.id
          )
        RETURNING id
    """

    # ── Spare Parts – Web Catalogue (spare_part_web) ──────────────────────────

    GET_SPARE_PART_WEB_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            w.id, w.branch_id, w.part_id, w.part_name, w.part_description,
            w.price, w.model, w.hsn_code, w.is_active,
            w.image_urls[1] AS thumbnail_url,
            m.part_code, br.name AS brand_name
        FROM spare_part_web w
        LEFT JOIN spare_part_master m ON m.id = w.part_id
        LEFT JOIN brand br ON br.id = m.brand_id
        WHERE w.branch_id = (table "p_branch_id")
        ORDER BY w.part_name
    """

    # image_urls context for the image-management routes (§4/§12 Step 6): branch_code
    # is what the file-server folder hierarchy needs, image_urls is what reorder/clear
    # validate against — one query serves both call sites instead of two.
    GET_SPARE_PART_WEB_IMAGE_CONTEXT = """
        SELECT w.id, w.branch_id, w.image_urls, b.code AS branch_code
        FROM spare_part_web w
        JOIN branch b ON b.id = w.branch_id
        WHERE w.id = %(id)s
    """

    # Read-modify-write done in SQL, not Python, so concurrent uploads never lose a
    # write (§3c). Append-only; never read image_urls into Python and write it back.
    APPEND_SPARE_PART_WEB_IMAGES = """
        UPDATE spare_part_web
        SET image_urls = image_urls || %(urls)s::text[], updated_at = now()
        WHERE id = %(id)s
        RETURNING image_urls
    """

    REMOVE_SPARE_PART_WEB_IMAGE = """
        UPDATE spare_part_web
        SET image_urls = array_remove(image_urls, %(url)s), updated_at = now()
        WHERE id = %(id)s
        RETURNING image_urls
    """

    # Full-array write — used for both reorder (validated permutation) and clearing
    # all images (called with an empty list), per §3c/§4.
    SET_SPARE_PART_WEB_IMAGES = """
        UPDATE spare_part_web
        SET image_urls = %(urls)s::text[], updated_at = now()
        WHERE id = %(id)s
        RETURNING image_urls
    """

    # ── Part Location Master ──────────────────────────────────────────────────

    CHECK_PART_LOCATION_EXISTS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_location"  as (values(%(location)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)),          -- Test line
        --     "p_location"  as (values('Shelf A'::text))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM stock_location_master
            WHERE branch_id       = (table "p_branch_id")
              AND LOWER(name)     = LOWER((table "p_location"))
        ) AS exists
    """

    CHECK_PART_LOCATION_EXISTS_EXCLUDE_ID = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_location"  as (values(%(location)s::text)),
            "p_id"        as (values(%(id)s::bigint))
        -- with
        --     "p_branch_id" as (values(1::bigint)),          -- Test line
        --     "p_location"  as (values('Shelf A'::text)),    -- Test line
        --     "p_id"        as (values(1::bigint))           -- Test line
        SELECT EXISTS(
            SELECT 1 FROM stock_location_master
            WHERE branch_id       = (table "p_branch_id")
              AND LOWER(name)     = LOWER((table "p_location"))
              AND id             <> (table "p_id")
        ) AS exists
    """

    CHECK_PART_LOCATION_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM stock_balance        WHERE location_id    = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_location_change WHERE to_location_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_PART_LOCATIONS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            pl.id, pl.branch_id, pl.name AS location, pl.is_active,
            b.name AS branch_name
        FROM stock_location_master pl
        JOIN branch b ON b.id = pl.branch_id
        ORDER BY b.name, pl.name
    """

    # ── Set Part Location ─────────────────────────────────────────────────────

    GET_STOCK_BALANCE_WITH_LOCATION = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            sb.part_id,
            p.part_code,
            p.part_name,
            p.part_description,
            p.category,
            p.model,
            p.uom,
            sb.qty,
            sb.location_id,
            lm.name AS location_name
        FROM stock_balance sb
        JOIN spare_part_master p           ON p.id  = sb.part_id
        LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE sb.branch_id = (table "p_branch_id")
        ORDER BY p.part_code
    """

    GET_ACTIVE_LOCATIONS_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT id, name AS location
        FROM stock_location_master
        WHERE branch_id = (table "p_branch_id")
          AND is_active = true
        ORDER BY name
    """

    GET_PART_IN_STOCK_BY_CODE = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_part_code" as (values(%(part_code)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)),        -- Test line
        --     "p_part_code" as (values('ABC-001'::text))   -- Test line
        SELECT
            p.id        AS part_id,
            p.part_code,
            p.part_name,
            p.uom,
            sb.qty,
            sb.location_id,
            lm.name     AS location_name
        FROM spare_part_master p
        JOIN stock_balance sb              ON sb.part_id   = p.id
                                          AND sb.branch_id = (table "p_branch_id")
        LEFT JOIN stock_location_master lm ON lm.id        = sb.location_id
        WHERE LOWER(p.part_code) = LOWER((table "p_part_code"))
    """

    GET_PART_LOCATION_HISTORY = """
        with
            "p_part_id"   as (values(%(part_id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_part_id" as (values(1::bigint)), "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            slc.id,
            slc.transaction_date,
            slc.ref_no,
            slc.remarks,
            lm.name AS location_name
        FROM stock_location_change slc
        JOIN stock_location_master lm ON lm.id = slc.to_location_id
        WHERE slc.part_id   = (table "p_part_id")
          AND slc.branch_id = (table "p_branch_id")
        ORDER BY slc.transaction_date DESC, slc.created_at DESC
        LIMIT 20
    """

    # ── Part Finder ───────────────────────────────────────────────────────────

    PART_FINDER_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_brand"     as (values(%(brand)s::text)),
            "p_location"  as (values(%(location)s::text)),
            "p_status"    as (values(%(stock_status)s::text))
        -- with "p_branch_id" as (values(1::bigint)), "p_search" as (values(''::text)),
        --      "p_brand" as (values(''::text)), "p_location" as (values(''::text)),
        --      "p_status" as (values('all'::text)) -- Test line
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        LEFT JOIN brand b                  ON b.id  = p.brand_id
        LEFT JOIN stock_balance sb         ON sb.part_id  = p.id
                                         AND sb.branch_id = (table "p_branch_id")
        LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE p.is_active = true
          AND ((table "p_search") = ''
               OR LOWER(p.part_code)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(p.part_name)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.category, ''))         LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
          AND ((table "p_brand")    = '' OR LOWER(COALESCE(b.name, ''))   = LOWER((table "p_brand")))
          AND ((table "p_location") = '' OR LOWER(COALESCE(lm.name, '')) = LOWER((table "p_location")))
          AND (
              (table "p_status") = 'all'
              OR ((table "p_status") = 'out_of_stock' AND COALESCE(sb.qty, 0) = 0)
              OR ((table "p_status") = 'low_stock'    AND COALESCE(sb.qty, 0) > 0
                                                      AND COALESCE(sb.qty, 0) <= 5)
              OR ((table "p_status") = 'in_stock'     AND COALESCE(sb.qty, 0) > 5)
          )
    """

    PART_FINDER_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_brand"     as (values(%(brand)s::text)),
            "p_location"  as (values(%(location)s::text)),
            "p_status"    as (values(%(stock_status)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        -- with "p_branch_id" as (values(1::bigint)), "p_search" as (values(''::text)),
        --      "p_brand" as (values(''::text)), "p_location" as (values(''::text)),
        --      "p_status" as (values('all'::text)),
        --      "p_limit" as (values(50::int)), "p_offset" as (values(0::int)) -- Test line
        SELECT
            p.id,
            p.part_code,
            p.part_name,
            p.part_description,
            p.category,
            p.model,
            b.name                                          AS brand_name,
            p.uom,
            p.cost_price,
            p.mrp,
            p.hsn_code,
            p.gst_rate,
            COALESCE(sb.qty, 0)                             AS qty,
            CASE WHEN sb.location_id IS NOT NULL THEN 1
                 ELSE 0 END                                 AS location_count,
            lm.name                                         AS primary_location,
            lm.id                                           AS primary_location_id,
            COUNT(*) OVER()                                 AS total
        FROM spare_part_master p
        LEFT JOIN brand b                  ON b.id  = p.brand_id
        LEFT JOIN stock_balance sb         ON sb.part_id  = p.id
                                         AND sb.branch_id = (table "p_branch_id")
        LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE p.is_active = true
          AND ((table "p_search") = ''
               OR LOWER(p.part_code)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(p.part_name)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.category, ''))         LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
          AND ((table "p_brand")    = '' OR LOWER(COALESCE(b.name, ''))   = LOWER((table "p_brand")))
          AND ((table "p_location") = '' OR LOWER(COALESCE(lm.name, '')) = LOWER((table "p_location")))
          AND (
              (table "p_status") = 'all'
              OR ((table "p_status") = 'out_of_stock' AND COALESCE(sb.qty, 0) = 0)
              OR ((table "p_status") = 'low_stock'    AND COALESCE(sb.qty, 0) > 0
                                                      AND COALESCE(sb.qty, 0) <= 5)
              OR ((table "p_status") = 'in_stock'     AND COALESCE(sb.qty, 0) > 5)
          )
        ORDER BY p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    PART_FINDER_DISTINCT_CATEGORIES = """
        SELECT DISTINCT category AS value
        FROM spare_part_master
        WHERE is_active = true
          AND category IS NOT NULL
          AND category <> ''
        ORDER BY category
    """

    PART_FINDER_DISTINCT_MODELS = """
        SELECT DISTINCT model AS value
        FROM spare_part_master
        WHERE is_active = true
          AND model IS NOT NULL
          AND model <> ''
        ORDER BY model
    """

    PART_FINDER_STOCK_BY_LOCATION = """
        with
            "p_part_id"   as (values(%(part_id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_part_id" as (values(1::bigint)), "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            lm.id   AS location_id,
            lm.name AS location_name,
            sb.qty
        FROM stock_balance sb
        JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE sb.part_id   = (table "p_part_id")
          AND sb.branch_id = (table "p_branch_id")
        ORDER BY lm.name
    """

    SET_PART_LOCATIONS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_date"      as (values(%(transaction_date)s::date)),
            "p_ref_no"    as (values(%(ref_no)s::text)),
            "p_remarks"   as (values(%(remarks)s::text)),
        -- with
        --     "p_branch_id" as (values(1::bigint)),             -- Test line
        --     "p_date"      as (values('2026-04-17'::date)),    -- Test line
        --     "p_ref_no"    as (values(''::text)),              -- Test line
        --     "p_remarks"   as (values(''::text)),              -- Test line
            "p_pairs" AS (
                SELECT
                    UNNEST(%(part_ids)s::bigint[])     AS part_id,
                    UNNEST(%(location_ids)s::bigint[]) AS location_id
            ),
            insert_history AS (
                INSERT INTO stock_location_change
                    (part_id, branch_id, to_location_id, transaction_date, ref_no, remarks)
                SELECT
                    p.part_id,
                    (table "p_branch_id"),
                    p.location_id,
                    (table "p_date"),
                    NULLIF((table "p_ref_no"),  ''),
                    NULLIF((table "p_remarks"), '')
                FROM "p_pairs" p
                RETURNING id
            )
        UPDATE stock_balance sb
        SET    location_id = pairs.location_id,
               updated_at  = now()
        FROM   "p_pairs" pairs
        WHERE  sb.part_id   = pairs.part_id
          AND  sb.branch_id = (table "p_branch_id")
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
           OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PART_BY_CODE = """
        with
            "p_code"     as (values(%(code)s::text)),
            "p_brand_id" as (values(%(brand_id)s::bigint))
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.selling_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE LOWER(p.part_code) = LOWER((table "p_code"))
          AND ((table "p_brand_id") IS NULL OR p.brand_id = (table "p_brand_id"))
    """

    GET_PARTS_BY_CODE_PREFIX = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.selling_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code) LIKE LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PARTS_BY_KEYWORD = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.selling_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_name)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, ''))           LIKE '%%' || LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PARTS_BY_CODE_PREFIX_COUNT = """
        with "p_search" as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code) LIKE LOWER((table "p_search")) || '%%'
    """

    GET_PARTS_BY_KEYWORD_COUNT = """
        with "p_search" as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        WHERE (table "p_search") = ''
           OR LOWER(p.part_name)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, ''))           LIKE '%%' || LOWER((table "p_search")) || '%%'
    """

    # ── Products ──────────────────────────────────────────────────────────────

    CHECK_PRODUCT_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM product_brand_model WHERE product_id = (table "p_id")
        ) AS in_use
    """

    CHECK_PRODUCT_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('LAPTOP'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM product
            WHERE UPPER(name) = UPPER((table "p_name"))
        ) AS exists
    """

    CHECK_PRODUCT_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_name" as (values('LAPTOP'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))       -- Test line
        SELECT EXISTS(
            SELECT 1 FROM product
            WHERE UPPER(name) = UPPER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_ALL_PRODUCTS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, name, is_active
        FROM product
        ORDER BY name
    """

    # ── Stock (Inventory Overview) ────────────────────────────────────────────

    GET_STOCK_OVERVIEW_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT count(distinct sp.id) as total
        FROM spare_part_master sp
        JOIN stock_transaction st ON st.part_id = sp.id AND ((table "p_branch_id") = 0 OR st.branch_id = (table "p_branch_id"))
        WHERE (
            ((table "p_brand_id") = 0 OR sp.brand_id = (table "p_brand_id")) AND
            ((table "p_search") = '' OR
             LOWER(sp.part_code)        ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.part_name)        ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.part_description) ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.category)         ILIKE '%%' || LOWER((table "p_search")) || '%%')
        )
    """

    GET_STOCK_OVERVIEW_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sp.id AS part_id,
            sp.part_code,
            sp.part_name,
            sp.part_description,
            b.name AS brand_name,
            sp.category,
            sp.uom,
            sp.cost_price,
            COALESCE(SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE -st.qty END), 0) AS current_stock
        FROM spare_part_master sp
        JOIN stock_transaction st ON st.part_id = sp.id AND ((table "p_branch_id") = 0 OR st.branch_id = (table "p_branch_id"))
        LEFT JOIN brand b ON b.id = sp.brand_id
        WHERE (
            ((table "p_brand_id") = 0 OR sp.brand_id = (table "p_brand_id")) AND
            ((table "p_search") = '' OR
             LOWER(sp.part_code)        ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.part_name)        ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.part_description) ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.category)         ILIKE '%%' || LOWER((table "p_search")) || '%%')
        )
        GROUP BY sp.id, sp.part_code, sp.part_name, sp.part_description, b.name, sp.category, sp.uom, sp.cost_price
        ORDER BY sp.part_name
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    # ── Consumption (Parts Usage) ─────────────────────────────────────────────

    GET_PARTS_CONSUMPTION_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)), -- Test line
        --     "p_search"    as (values(''::text))   -- Test line
        SELECT COUNT(*) AS total
        FROM job_part_used jpu
        JOIN job             j  ON j.id  = jpu.job_id
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_code) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PARTS_CONSUMPTION = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        -- with
        --     "p_branch_id" as (values(1::bigint)), -- Test line
        --     "p_search"    as (values(''::text)),  -- Test line
        --     "p_limit"     as (values(50::int)),   -- Test line
        --     "p_offset"    as (values(0::int))     -- Test line
        SELECT
            jpu.id,
            jpu.created_at,
            j.id       AS job_id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.is_closed,
            j.is_final,
            js.name AS job_status_name,
            js.code AS job_status_code,
            jt.name AS job_type_name,
            jt.code AS job_type_code,
            jpu.part_id,
            sp.brand_id,
            sp.part_code,
            sp.part_name,
            sp.uom,
            jpu.qty,
            jpu.cost_price,
            jpu.selling_price,
            jpu.gst_rate,
            COALESCE(jpu.hsn_code, sp.hsn_code) AS hsn_code,
            jpu.remarks,
            b.name AS branch_name,
            st.id  AS stock_transaction_id
        FROM job_part_used jpu
        JOIN job             j  ON j.id  = jpu.job_id
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        JOIN branch          b  ON b.id  = j.branch_id
        JOIN job_status      js ON js.id = j.job_status_id
        JOIN job_type        jt ON jt.id = j.job_type_id
        LEFT JOIN stock_transaction st ON st.job_part_used_id = jpu.id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_code) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jpu.created_at DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    # ── Purchase Entry ────────────────────────────────────────────────────────

    GET_STOCK_TRANSACTION_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, dr_cr
        FROM stock_transaction_type
        ORDER BY id
    """

    GET_PURCHASE_INVOICES_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR pi.division_id = (table "p_division_id"))
          AND pi.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)         LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_TOTALS = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text))
        SELECT
            COALESCE(SUM(pi.aggregate_amount), 0) AS aggregate_amount,
            COALESCE(SUM(pi.cgst_amount),      0) AS cgst_amount,
            COALESCE(SUM(pi.sgst_amount),      0) AS sgst_amount,
            COALESCE(SUM(pi.igst_amount),      0) AS igst_amount,
            COALESCE(SUM(pi.total_amount),     0) AS total_amount
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR pi.division_id = (table "p_division_id"))
          AND pi.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)         LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        -- with
        --     "p_branch_id" as (values(1::bigint)),           -- Test line
        --     "p_from_date" as (values('2024-01-01'::date)),   -- Test line
        --     "p_to_date"   as (values('2024-12-31'::date)),   -- Test line
        --     "p_search"    as (values(''::text)),             -- Test line
        --     "p_limit"     as (values(50::int)),              -- Test line
        --     "p_offset"    as (values(0::int))               -- Test line
        SELECT
            pi.id,
            pi.branch_id,
            pi.division_id,
            d.name        AS division_name,
            pi.brand_id,
            pi.supplier_id,
            s.name        AS supplier_name,
            pi.invoice_no,
            pi.invoice_date,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_tax,
            pi.total_amount,
            pi.remarks,
            pi.is_return,
            pi.is_posted
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        JOIN division d ON d.id = pi.division_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR pi.division_id = (table "p_division_id"))
          AND pi.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)         LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY pi.invoice_date DESC, pi.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PURCHASE_INVOICES_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND pi.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            pi.id,
            pi.branch_id,
            pi.invoice_no,
            pi.invoice_date,
            s.name           AS supplier_name,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_amount,
            pi.is_posted
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND pi.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY pi.invoice_date DESC, pi.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PURCHASE_INVOICE_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT
            pi.id,
            pi.branch_id,
            pi.supplier_id,
            s.name              AS supplier_name,
            pi.invoice_no,
            pi.invoice_date,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_tax,
            pi.total_amount,
            pi.remarks,
            pi.is_return,
            json_agg(
                json_build_object(
                    'id',               pil.id,
                    'part_id',          pil.part_id,
                    'part_code',        sp.part_code,
                    'part_name',        sp.part_name,
                    'part_description', sp.part_description,
                    'hsn_code',         pil.hsn_code,
                    'qty',         pil.qty,
                    'unit_price',       pil.unit_price,
                    'aggregate_amount', pil.aggregate_amount,
                    'gst_rate',         pil.gst_rate,
                    'cgst_amount',      pil.cgst_amount,
                    'sgst_amount',      pil.sgst_amount,
                    'igst_amount',      pil.igst_amount,
                    'total_amount',     pil.total_amount,
                    'under_warranty',   pil.under_warranty,
                    'remarks',          pil.remarks
                ) ORDER BY pil.id
            ) AS lines
        FROM purchase_invoice pi
        JOIN supplier              s   ON s.id   = pi.supplier_id
        JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
        JOIN spare_part_master     sp  ON sp.id  = pil.part_id
        WHERE pi.id = (table "p_id")
        GROUP BY pi.id, s.name
    """

    CHECK_SUPPLIER_INVOICE_EXISTS = """
        with
            "p_supplier_id" as (values(%(supplier_id)s::bigint)),
            "p_invoice_no"  as (values(%(invoice_no)s::text))
        -- with
        --     "p_supplier_id" as (values(1::bigint)), -- Test line
        --     "p_invoice_no"  as (values('INV-001'::text)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM purchase_invoice
            WHERE supplier_id = (table "p_supplier_id")
              AND UPPER(invoice_no) = UPPER((table "p_invoice_no"))
        ) AS exists
    """

    CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID = """
        with
            "p_supplier_id" as (values(%(supplier_id)s::bigint)),
            "p_invoice_no"  as (values(%(invoice_no)s::text)),
            "p_id"          as (values(%(id)s::bigint))
        SELECT EXISTS (
            SELECT 1 FROM purchase_invoice
            WHERE supplier_id = (table "p_supplier_id")
              AND UPPER(invoice_no) = UPPER((table "p_invoice_no"))
              AND id <> (table "p_id")
        ) AS exists
    """

    DELETE_PURCHASE_INVOICE = """
        with
            "p_id" as (values(%(id)s::bigint)),
            deleted_txns AS (
                DELETE FROM stock_transaction
                WHERE purchase_line_id IN (
                    SELECT id FROM purchase_invoice_line
                    WHERE purchase_invoice_id = (table "p_id")
                )
            )
        DELETE FROM purchase_invoice WHERE id = (table "p_id")
    """

    # ── Stock Adjustment ──────────────────────────────────────────────────────

    GET_STOCK_ADJUSTMENTS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM stock_adjustment sa
        WHERE sa.branch_id = (table "p_branch_id")
          AND sa.adjustment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(sa.adjustment_reason) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(sa.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_STOCK_ADJUSTMENTS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sa.id,
            sa.branch_id,
            sa.brand_id,
            sa.adjustment_date,
            sa.adjustment_reason,
            sa.ref_no,
            sa.remarks,
            sa.created_by,
            sa.created_at,
            sa.updated_at
        FROM stock_adjustment sa
        WHERE sa.branch_id = (table "p_branch_id")
          AND sa.adjustment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(sa.adjustment_reason) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(sa.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY sa.adjustment_date DESC, sa.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_STOCK_ADJUSTMENT_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sa.id,
            sa.branch_id,
            sa.brand_id,
            sa.adjustment_date,
            sa.adjustment_reason,
            sa.ref_no,
            sa.remarks,
            sa.created_by,
            sa.created_at,
            sa.updated_at,
            json_agg(
                json_build_object(
                    'id',        sal.id,
                    'part_id',   sal.part_id,
                    'part_code', sp.part_code,
                    'part_name', sp.part_name,
                    'dr_cr',     sal.dr_cr,
                    'qty',       sal.qty,
                    'remarks',   sal.remarks
                ) ORDER BY sal.id
            ) AS lines
        FROM stock_adjustment sa
        JOIN stock_adjustment_line sal ON sal.stock_adjustment_id = sa.id
        JOIN spare_part_master      sp  ON sp.id = sal.part_id
        WHERE sa.id = (table "p_id")
        GROUP BY sa.id
    """

    # ── Stock Branch Transfer ──────────────────────────────────────────────────

    GET_STOCK_BRANCH_TRANSFERS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM stock_branch_transfer sbt
        WHERE (sbt.from_branch_id = (table "p_branch_id") OR sbt.to_branch_id = (table "p_branch_id"))
          AND sbt.transfer_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(sbt.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_STOCK_BRANCH_TRANSFERS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sbt.id,
            sbt.transfer_date,
            sbt.from_branch_id,
            sbt.to_branch_id,
            sbt.brand_id,
            sbt.ref_no,
            sbt.remarks,
            sbt.created_by,
            sbt.created_at,
            sbt.updated_at,
            fb.name AS from_branch_name,
            tb.name AS to_branch_name
        FROM stock_branch_transfer sbt
        JOIN branch fb ON fb.id = sbt.from_branch_id
        JOIN branch tb ON tb.id = sbt.to_branch_id
        WHERE (sbt.from_branch_id = (table "p_branch_id") OR sbt.to_branch_id = (table "p_branch_id"))
          AND sbt.transfer_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(sbt.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY sbt.transfer_date DESC, sbt.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_STOCK_BRANCH_TRANSFER_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sbt.id,
            sbt.transfer_date,
            sbt.from_branch_id,
            sbt.to_branch_id,
            sbt.brand_id,
            sbt.ref_no,
            sbt.remarks,
            sbt.created_by,
            sbt.created_at,
            sbt.updated_at,
            fb.name AS from_branch_name,
            tb.name AS to_branch_name,
            json_agg(
                json_build_object(
                    'id',        sbtl.id,
                    'part_id',   sbtl.part_id,
                    'part_code', sp.part_code,
                    'part_name', sp.part_name,
                    'qty',       sbtl.qty,
                    'remarks',   sbtl.remarks
                ) ORDER BY sbtl.id
            ) AS lines
        FROM stock_branch_transfer sbt
        JOIN branch fb ON fb.id = sbt.from_branch_id
        JOIN branch tb ON tb.id = sbt.to_branch_id
        JOIN stock_branch_transfer_line sbtl ON sbtl.stock_branch_transfer_id = sbt.id
        JOIN spare_part_master      sp   ON sp.id = sbtl.part_id
        WHERE sbt.id = (table "p_id")
        GROUP BY sbt.id, fb.name, tb.name
    """

    GET_STOCK_LOANS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from"      as (values(%(from_date)s::date)),
            "p_to"        as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT count(*) as total
        FROM stock_loan sl
        WHERE sl.branch_id = (table "p_branch_id")
          AND sl.loan_date >= (table "p_from")
          AND sl.loan_date <= (table "p_to")
          AND (
            (table "p_search") = '' OR
            sl.ref_no ILIKE '%%' || (table "p_search") || '%%' OR
            EXISTS (
                SELECT 1 FROM stock_loan_line sll
                WHERE sll.stock_loan_id = sl.id
                  AND sll.loan_to ILIKE '%%' || (table "p_search") || '%%'
            )
          )
    """

    GET_STOCK_LOANS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from"      as (values(%(from_date)s::date)),
            "p_to"        as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sl.id, sl.loan_date, sl.branch_id, sl.brand_id, sl.ref_no, sl.remarks,
            sl.created_at, sl.updated_at
        FROM stock_loan sl
        WHERE sl.branch_id = (table "p_branch_id")
          AND sl.loan_date >= (table "p_from")
          AND sl.loan_date <= (table "p_to")
          AND (
            (table "p_search") = '' OR
            sl.ref_no ILIKE '%%' || (table "p_search") || '%%' OR
            EXISTS (
                SELECT 1 FROM stock_loan_line sll
                WHERE sll.stock_loan_id = sl.id
                  AND sll.loan_to ILIKE '%%' || (table "p_search") || '%%'
            )
          )
        ORDER BY sl.loan_date DESC, sl.id DESC
        LIMIT (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_STOCK_LOAN_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sl.id,
            sl.loan_date,
            sl.branch_id,
            sl.brand_id,
            sl.ref_no,
            sl.remarks,
            sl.created_at,
            sl.updated_at,
            json_agg(
                json_build_object(
                    'id',        sll.id,
                    'part_id',   sll.part_id,
                    'part_code', sp.part_code,
                    'part_name', sp.part_name,
                    'loan_to',   sll.loan_to,
                    'dr_cr',     sll.dr_cr,
                    'qty',       sll.qty,
                    'remarks',   sll.remarks
                ) ORDER BY sll.id
            ) AS lines
        FROM stock_loan sl
        JOIN stock_loan_line sll ON sll.stock_loan_id = sl.id
        JOIN spare_part_master sp ON sp.id = sll.part_id
        WHERE sl.id = (table "p_id")
        GROUP BY sl.id
    """

    # ── Opening Stock ─────────────────────────────────────────────────────────

    GET_OPENING_BALANCE_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            sob.id,
            sob.entry_date,
            sob.ref_no,
            sob.branch_id,
            sob.remarks,
            sob.created_by,
            sob.created_at,
            sob.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',        sobl.id,
                        'part_id',   sobl.part_id,
                        'part_code', sp.part_code,
                        'part_name', sp.part_name,
                        'qty',       sobl.qty,
                        'unit_cost', sobl.unit_cost,
                        'remarks',   sobl.remarks
                    ) ORDER BY sobl.id
                ) FILTER (WHERE sobl.id IS NOT NULL),
                '[]'::json
            ) AS lines
        FROM stock_opening_balance sob
        LEFT JOIN stock_opening_balance_line sobl ON sobl.stock_opening_balance_id = sob.id
        LEFT JOIN spare_part_master sp ON sp.id = sobl.part_id
        WHERE sob.branch_id = (table "p_branch_id")
        GROUP BY sob.id
    """

    GET_OPENING_STOCK_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT count(*) as total
        FROM stock_opening_balance
        WHERE branch_id  = (table "p_branch_id")
          AND (
            (table "p_search") = '' OR
            ref_no  ILIKE '%%' || (table "p_search") || '%%' OR
            remarks ILIKE '%%' || (table "p_search") || '%%'
          )
    """

    GET_OPENING_STOCK_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sob.id,
            sob.entry_date,
            sob.branch_id,
            sob.brand_id,
            sob.ref_no,
            sob.remarks,
            COUNT(sobl.id)                                     AS line_count,
            COALESCE(SUM(sobl.qty), 0)                         AS total_qty,
            COALESCE(SUM(sobl.qty * sobl.unit_cost), 0)        AS total_value
        FROM stock_opening_balance sob
        LEFT JOIN stock_opening_balance_line sobl
               ON sobl.stock_opening_balance_id = sob.id
        WHERE sob.branch_id  = (table "p_branch_id")
          AND (
            (table "p_search") = '' OR
            sob.ref_no  ILIKE '%%' || (table "p_search") || '%%' OR
            sob.remarks ILIKE '%%' || (table "p_search") || '%%'
          )
        GROUP BY sob.id
        ORDER BY sob.entry_date DESC, sob.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_OPENING_STOCK_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sob.id,
            sob.entry_date,
            sob.branch_id,
            sob.brand_id,
            sob.ref_no,
            sob.remarks,
            sob.created_at,
            sob.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',        sobl.id,
                        'part_id',   sobl.part_id,
                        'part_code', sp.part_code,
                        'part_name', sp.part_name,
                        'qty',       sobl.qty,
                        'unit_cost', sobl.unit_cost,
                        'remarks',   sobl.remarks
                    ) ORDER BY sobl.id
                ) FILTER (WHERE sobl.id IS NOT NULL),
                '[]'::json
            ) AS lines
        FROM stock_opening_balance sob
        LEFT JOIN stock_opening_balance_line sobl
               ON sobl.stock_opening_balance_id = sob.id
        LEFT JOIN spare_part_master sp ON sp.id = sobl.part_id
        WHERE sob.id = (table "p_id")
        GROUP BY sob.id
    """

    # ── Vendors ───────────────────────────────────────────────────────────────

    CHECK_VENDOR_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM purchase_invoice WHERE supplier_id = (table "p_id")
        ) AS in_use
    """

    CHECK_VENDOR_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('Acme Corp'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM supplier
            WHERE LOWER(name) = LOWER((table "p_name"))
        ) AS exists
    """

    CHECK_VENDOR_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_name" as (values('Acme Corp'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))          -- Test line
        SELECT EXISTS(
            SELECT 1 FROM supplier
            WHERE LOWER(name) = LOWER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_ALL_VENDORS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            v.id, v.name, v.gstin, v.pan, v.phone, v.email,
            v.address_line1, v.address_line2, v.city, v.state_id,
            v.pincode, v.is_active, v.remarks,
            s.name AS state_name, s.gst_state_code
        FROM supplier v
        LEFT JOIN state s ON s.id = v.state_id
        ORDER BY v.name
    """

    # ── Stock Snapshot ────────────────────────────────────────────────────────

    SQL_GENERATE_STOCK_SNAPSHOT = """
        with
            "p_year"  as (values(%(year)s::int)),
            "p_month" as (values(%(month)s::int)),
        -- with
        --     "p_year"  as (values(2026::int)), -- Test line
        --     "p_month" as (values(3::int)),    -- Test line
        period as (
            select
                date_trunc('month', make_date((table "p_year"), (table "p_month"), 1))::date                                as period_start,
                (date_trunc('month', make_date((table "p_year"), (table "p_month"), 1)) + interval '1 month - 1 day')::date as period_end,
                (date_trunc('month', make_date((table "p_year"), (table "p_month"), 1)) + interval '1 month - 1 day')::date as snapshot_date
        ),
        prev_snapshot as (
            select ss.part_id, ss.branch_id, ss.closing
            from stock_snapshot ss
            inner join (
                select part_id, branch_id, max(snapshot_date) as max_date
                from stock_snapshot
                where snapshot_date < (select period_start from period)
                group by part_id, branch_id
            ) latest on latest.part_id    = ss.part_id
                    and latest.branch_id  = ss.branch_id
                    and ss.snapshot_date      = latest.max_date
        ),
        tran_summary as (
            select
                st.part_id,
                st.branch_id,
                sum(case when stt.dr_cr = 'D' then st.qty else -st.qty end)           as net_qty,
                sum(case when stt.code = 'PURCHASE'            then st.qty else 0 end) as purchase_in,
                sum(case when stt.code = 'PURCHASE_RETURN'     then st.qty else 0 end) as purchase_out,
                sum(case when stt.code = 'SALES_RETURN'        then st.qty else 0 end) as sales_in,
                sum(case when stt.code = 'SALES'               then st.qty else 0 end) as sales_out,
                sum(case when stt.code = 'ADJUSTMENT_IN'       then st.qty else 0 end) as adjust_in,
                sum(case when stt.code = 'ADJUSTMENT_OUT'      then st.qty else 0 end) as adjust_out,
                sum(case when stt.code = 'LOAN_IN'             then st.qty else 0 end) as loan_in,
                sum(case when stt.code = 'LOAN_OUT'            then st.qty else 0 end) as loan_out,
                sum(case when stt.code = 'BRANCH_TRANSFER_IN'  then st.qty else 0 end) as branch_transfer_in,
                sum(case when stt.code = 'BRANCH_TRANSFER_OUT' then st.qty else 0 end) as branch_transfer_out
            from stock_transaction st
            join stock_transaction_type stt on stt.id = st.stock_transaction_type_id
            where st.transaction_date between (select period_start from period)
                                          and (select period_end   from period)
            group by st.part_id, st.branch_id
        )
        insert into stock_snapshot (
            snapshot_date, part_id, branch_id,
            opening, closing,
            purchase_in, purchase_out, sales_in, sales_out,
            adjust_in, adjust_out, loan_in, loan_out,
            branch_transfer_in, branch_transfer_out
        )
        select
            (select snapshot_date from period),
            ts.part_id, ts.branch_id,
            coalesce(ps.closing, 0)                  as opening,
            coalesce(ps.closing, 0) + ts.net_qty     as closing,
            ts.purchase_in,  ts.purchase_out,
            ts.sales_in,     ts.sales_out,
            ts.adjust_in,    ts.adjust_out,
            ts.loan_in,      ts.loan_out,
            ts.branch_transfer_in, ts.branch_transfer_out
        from tran_summary ts
        left join prev_snapshot ps on ps.part_id = ts.part_id and ps.branch_id = ts.branch_id
        on conflict (snapshot_date, part_id, branch_id) do update set
            opening             = excluded.opening,
            closing             = excluded.closing,
            purchase_in         = excluded.purchase_in,
            purchase_out        = excluded.purchase_out,
            sales_in            = excluded.sales_in,
            sales_out           = excluded.sales_out,
            adjust_in           = excluded.adjust_in,
            adjust_out          = excluded.adjust_out,
            loan_in             = excluded.loan_in,
            loan_out            = excluded.loan_out,
            branch_transfer_in  = excluded.branch_transfer_in,
            branch_transfer_out = excluded.branch_transfer_out
        returning part_id
    """

    SQL_PART_FINDER_STOCK_SUMMARY = """
        with
            "p_part_id"   as (values(%(part_id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint)),
        -- with
        --     "p_part_id"   as (values(1::bigint)), -- Test line
        --     "p_branch_id" as (values(1::bigint)), -- Test line
        last_snap as (
            select snapshot_date, closing,
                   purchase_in, purchase_out, sales_in, sales_out,
                   adjust_in, adjust_out, loan_in, loan_out,
                   branch_transfer_in, branch_transfer_out
            from stock_snapshot
            where part_id   = (table "p_part_id")
              and branch_id = (table "p_branch_id")
            order by snapshot_date desc
            limit 1
        ),
        tran_since as (
            select
                sum(case when stt.dr_cr = 'D' then st.qty else -st.qty end)           as net_qty,
                sum(case when stt.code = 'PURCHASE'            then st.qty else 0 end) as purchase_in,
                sum(case when stt.code = 'PURCHASE_RETURN'     then st.qty else 0 end) as purchase_out,
                sum(case when stt.code = 'SALES_RETURN'        then st.qty else 0 end) as sales_in,
                sum(case when stt.code = 'SALES'               then st.qty else 0 end) as sales_out,
                sum(case when stt.code = 'ADJUSTMENT_IN'       then st.qty else 0 end) as adjust_in,
                sum(case when stt.code = 'ADJUSTMENT_OUT'      then st.qty else 0 end) as adjust_out
            from stock_transaction st
            join stock_transaction_type stt on stt.id = st.stock_transaction_type_id
            where st.part_id   = (table "p_part_id")
              and st.branch_id = (table "p_branch_id")
              and st.transaction_date > coalesce(
                    (select snapshot_date from last_snap), '1900-01-01'::date
                  )
        )
        select
            ls.snapshot_date                                    as last_snapshot_date,
            coalesce(ls.closing, 0)                             as snapshot_closing,
            coalesce(ts.net_qty, 0)                             as net_since_snapshot,
            coalesce(ls.closing, 0) + coalesce(ts.net_qty, 0)  as current_stock,
            coalesce(ts.purchase_in,  0)                        as purchase_in_since,
            coalesce(ts.purchase_out, 0)                        as purchase_out_since,
            coalesce(ts.sales_in,     0)                        as sales_in_since,
            coalesce(ts.sales_out,    0)                        as sales_out_since,
            coalesce(ts.adjust_in,    0)                        as adjust_in_since,
            coalesce(ts.adjust_out,   0)                        as adjust_out_since
        from last_snap ls
        full outer join tran_since ts on true
    """
