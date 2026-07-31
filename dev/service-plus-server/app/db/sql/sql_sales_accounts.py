"""SQL constants for the sales accounts domain.

Split from app/db/sql_store.py — see plans/plan.md Step 3.
"""


class SalesAccountsSql:
    """SQL constants for the sales accounts domain."""

    # ── Customer Types ────────────────────────────────────────────────────────

    CHECK_CUSTOMER_TYPE_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('IND'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM customer_type
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_CUSTOMER_TYPE_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('IND'::text)),  -- Test line
        --     "p_id"   as (values(1::smallint))   -- Test line
        SELECT EXISTS(
            SELECT 1 FROM customer_type
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_CUSTOMER_TYPE_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM customer_contact WHERE customer_type_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_CUSTOMER_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name
        FROM customer_type
        WHERE is_active = true
        ORDER BY display_order NULLS LAST, name
    """

    GET_CUSTOMER_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM customer_type
        ORDER BY display_order NULLS LAST, name
    """

    # ── Customers ─────────────────────────────────────────────────────────────

    CHECK_CUSTOMER_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job           WHERE customer_contact_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM sales_invoice WHERE customer_contact_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_CUSTOMERS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            cc.id, cc.customer_type_id, cc.full_name, cc.gstin,
            cc.mobile, cc.alternate_mobile, cc.email,
            cc.address_line1, cc.address_line2, cc.landmark,
            cc.state_id, cc.city, cc.postal_code, cc.remarks, cc.is_active,
            ct.name AS customer_type_name,
            s.name  AS state_name
        FROM customer_contact cc
        JOIN  customer_type ct ON ct.id = cc.customer_type_id
        LEFT JOIN state s      ON s.id  = cc.state_id
        ORDER BY cc.full_name NULLS LAST, cc.mobile
    """

    # ── Sales Entry ───────────────────────────────────────────────────────────

    GET_CUSTOMERS_BY_KEYWORD = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        SELECT
            cc.id, cc.full_name, cc.mobile, cc.gstin,
            cc.state_id, COALESCE(s.gst_state_code, s.code) AS state_code, s.name AS state_name,
            cc.address_line1, cc.address_line2, cc.city, cc.postal_code,
            ct.name AS customer_type_name
        FROM customer_contact cc
        JOIN customer_type ct ON ct.id = cc.customer_type_id
        LEFT JOIN state s     ON s.id  = cc.state_id
        WHERE cc.is_active = true
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(cc.full_name, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR cc.mobile                         LIKE '%%' || (table "p_search")         || '%%')
        ORDER BY cc.full_name NULLS LAST, cc.mobile
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_CUSTOMERS_BY_KEYWORD_COUNT = """
        with
            "p_search" as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM customer_contact cc
        WHERE cc.is_active = true
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(cc.full_name, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR cc.mobile                         LIKE '%%' || (table "p_search")         || '%%')
    """

    GET_SALES_INVOICES_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR si.division_id = (table "p_division_id"))
          AND si.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_TOTALS = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text))
        SELECT
            COALESCE(SUM(si.aggregate),    0) AS aggregate_amount,
            COALESCE(SUM(si.cgst_amount),  0) AS cgst_amount,
            COALESCE(SUM(si.sgst_amount),  0) AS sgst_amount,
            COALESCE(SUM(si.igst_amount),  0) AS igst_amount,
            COALESCE(SUM(si.amount),       0) AS total_amount
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR si.division_id = (table "p_division_id"))
          AND si.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        SELECT
            si.id,
            si.division_id,
            d.name                                                   AS division_name,
            si.brand_id,
            si.customer_contact_id,
            si.customer_name,
            si.customer_gstin,
            si.customer_state_code,
            si.invoice_no,
            si.invoice_date,
            si.aggregate                                             AS aggregate_amount,
            si.cgst_amount,
            si.sgst_amount,
            si.igst_amount,
            (si.cgst_amount + si.sgst_amount + si.igst_amount)      AS total_tax,
            si.amount                                                AS total_amount,
            si.remarks,
            si.is_return,
            si.is_posted
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR si.division_id = (table "p_division_id"))
          AND si.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY si.invoice_date DESC, si.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SALES_INVOICES_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND si.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            si.id,
            si.division_id,
            d.name        AS division_name,
            si.invoice_no,
            si.invoice_date,
            si.customer_name,
            si.aggregate      AS aggregate_amount,
            si.cgst_amount,
            si.sgst_amount,
            si.igst_amount,
            si.amount         AS total_amount,
            si.is_return,
            si.is_posted
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND si.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY si.invoice_date DESC, si.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SALES_INVOICE_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            si.id, si.division_id, si.brand_id, si.customer_contact_id, si.customer_name,
            si.customer_gstin, si.customer_state_code,
            si.invoice_no, si.invoice_date,
            si.aggregate                                        AS aggregate_amount,
            si.cgst_amount, si.sgst_amount, si.igst_amount,
            (si.cgst_amount + si.sgst_amount + si.igst_amount) AS total_tax,
            si.amount                                           AS total_amount,
            si.remarks, si.is_return,
            json_agg(
                json_build_object(
                    'id',               sil.id,
                    'part_id',          sil.part_id,
                    'part_code',        sp.part_code,
                    'part_name',        sp.part_name,
                    'part_description', sp.part_description,
                    'item_description', sil.item_description,
                    'hsn_code',         sil.hsn_code,
                    'qty',              sil.qty,
                    'unit_price',       sil.price,
                    'aggregate_amount', ROUND(sil.qty * sil.price, 2),
                    'gst_rate',         sil.gst_rate,
                    'cgst_amount',      sil.cgst_amount,
                    'sgst_amount',      sil.sgst_amount,
                    'igst_amount',      sil.igst_amount,
                    'total_amount',     sil.amount,
                    'remarks',          sil.remarks,
                    'cost_price',       sil.cost_price
                ) ORDER BY sil.id
            ) AS lines
        FROM sales_invoice si
        JOIN sales_invoice_line sil ON sil.sales_invoice_id = si.id
        JOIN spare_part_master sp   ON sp.id = sil.part_id
        WHERE si.id = (table "p_id")
        GROUP BY si.id
    """

    # ── Post / Unpost — all records, no is_posted filter, with division + gst_type ──

    GET_JOB_PAYMENTS_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE jp.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE jp.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)            LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no,'')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)            LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no,'')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            jp.id,
            jp.job_id,
            j.job_no,
            cc.full_name    AS customer_name,
            cc.mobile,
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            d.name          AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            jp.is_posted
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN division d ON d.id = j.division_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)            LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no,'')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jp.payment_date DESC, jp.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PURCHASE_INVOICES_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE pi.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE pi.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            pi.id,
            pi.branch_id,
            pi.invoice_no,
            pi.invoice_date,
            s.name           AS supplier_name,
            s.gstin          AS supplier_gstin,
            pi.total_amount,
            d.name           AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            pi.is_posted
        FROM purchase_invoice pi
        JOIN supplier  s ON s.id = pi.supplier_id
        JOIN division  d ON d.id = pi.division_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY pi.invoice_date DESC, pi.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SALES_INVOICES_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE si.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE si.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            si.id,
            si.division_id,
            si.invoice_no,
            si.invoice_date,
            si.customer_name,
            si.customer_gstin,
            si.amount         AS total_amount,
            si.is_return,
            d.name            AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            si.is_posted
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY si.invoice_date DESC, si.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_INVOICES_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE ji.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE ji.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text       ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_INVOICES_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text       ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(ji.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_INVOICES_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            ji.id,
            ji.job_id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            cc.full_name  AS customer_name,
            cc.gstin      AS customer_gstin,
            cc.mobile,
            ji.invoice_no,
            ji.invoice_date,
            ji.amount,
            d.name        AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            ji.is_posted
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        JOIN division d ON d.id = j.division_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text       ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(ji.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY ji.invoice_date DESC, ji.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PAYMENTS_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id  = (table "p_branch_id")
          AND jp.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            jp.id,
            jp.job_id,
            j.job_no,
            cc.full_name  AS customer_name,
            cc.mobile,
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.is_posted
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id  = (table "p_branch_id")
          AND jp.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jp.payment_date DESC, jp.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PAYMENTS_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT jp.id, jp.job_id, jp.receipt_no, jp.payment_date, jp.payment_mode, jp.amount,
               jp.reference_no, jp.remarks, jp.created_at, jp.updated_at
        FROM job_payment jp
        WHERE jp.job_id = (table "p_job_id")
        ORDER BY jp.payment_date DESC, jp.id DESC
    """

    GET_JOB_TRANSACTIONS_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT
            jt.id,
            jt.job_id,
            jt.status_id,
            js.name                             AS status_name,
            jt.technician_id,
            t.name                              AS technician_name,
            jt.amount,
            jt.remarks,
            jt.performed_by_user_id,
            COALESCE(su.full_name, su.username) AS performed_by_name,
            jt.performed_at,
            jt.previous_transaction_id,
            jt.transaction_date,
            j.is_opening_job
        FROM job_transaction jt
        JOIN job                  j  ON j.id   = jt.job_id
        LEFT JOIN job_status      js ON js.id  = jt.status_id
        LEFT JOIN technician      t  ON t.id   = jt.technician_id
        LEFT JOIN security."user" su ON su.id  = jt.performed_by_user_id
        WHERE jt.job_id = (table "p_job_id")

        UNION ALL

        SELECT
            0                                   AS id,
            j.id                                AS job_id,
            js.id                               AS status_id,
            js.name                             AS status_name,
            NULL::bigint                        AS technician_id,
            NULL::text                          AS technician_name,
            NULL::numeric                       AS amount,
            NULL::text                          AS remarks,
            NULL::bigint                        AS performed_by_user_id,
            NULL::text                          AS performed_by_name,
            j.created_at                        AS performed_at,
            NULL::bigint                        AS previous_transaction_id,
            j.created_at::date                  AS transaction_date,
            j.is_opening_job
        FROM job j
        JOIN job_status js ON js.id = CASE WHEN j.is_opening_job THEN j.job_status_id ELSE 1 END
        WHERE j.id = (table "p_job_id")
          AND (
                (j.is_opening_job IS NOT TRUE AND NOT EXISTS (
                    SELECT 1 FROM job_transaction jt2
                    WHERE jt2.job_id = j.id AND jt2.status_id = 1
                ))
             OR (j.is_opening_job IS TRUE AND NOT EXISTS (
                    SELECT 1 FROM job_transaction jt2
                    WHERE jt2.job_id = j.id
                ))
              )

        ORDER BY performed_at ASC, id ASC
    """

    GET_JOB_TRANSACTION_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            jt.id,
            jt.job_id,
            jt.status_id,
            js.name                             AS status_name,
            jt.technician_id,
            t.name                              AS technician_name,
            jt.amount,
            jt.remarks,
            jt.performed_by_user_id,
            COALESCE(su.full_name, su.username) AS performed_by_name,
            jt.performed_at,
            jt.previous_transaction_id
        FROM job_transaction jt
        LEFT JOIN job_status     js ON js.id = jt.status_id
        LEFT JOIN technician     t  ON t.id  = jt.technician_id
        LEFT JOIN security."user" su ON su.id = jt.performed_by_user_id
        WHERE jt.id = (table "p_id")
    """

    GET_JOBS_FOR_RECEIPT_LOOKUP = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int))
        SELECT j.id, j.job_no, j.alternate_job_no, j.job_date, j.amount, j.is_closed,
               j.is_final, js.code AS job_status_code, js.name AS job_status_name, jt.code AS job_type_code,
               cc.full_name AS customer_name, cc.mobile, cc.address_line1,
               COALESCE(
                   (SELECT SUM(jp2.amount) FROM job_payment jp2 WHERE jp2.job_id = j.id),
                   0
               ) AS total_paid
        FROM job j
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN  job_status js ON js.id = j.job_status_id
        JOIN  job_type   jt ON jt.id = j.job_type_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_active = true
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT (table "p_limit")
    """

    GET_UNPOSTED_MONEY_RECEIPTS = """
        WITH "p_division_code" AS (VALUES(%(division_code)s::text))
        SELECT
            jp.id,
            jp.job_id,
            j.job_no,
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.remarks,
            cc.full_name AS customer_name,
            cc.mobile AS customer_mobile,
            cc.gstin AS customer_gstin,
            cc.postal_code AS customer_pin,
            CONCAT_WS(', ',
                NULLIF(cc.address_line1, ''),
                NULLIF(cc.address_line2, ''),
                NULLIF(cc.city, '')
            ) AS customer_address
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN division d ON d.id = j.division_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE LOWER(d.code) = LOWER((TABLE "p_division_code"))
          AND jp.is_posted = false
        ORDER BY jp.payment_date ASC, jp.id ASC
    """

    MARK_MONEY_RECEIPT_POSTED = """
        UPDATE job_payment SET is_posted = true WHERE id = %(id)s
    """

    GET_UNPOSTED_PURCHASE_INVOICES = """
        WITH
            "p_division_code" AS (VALUES(%(division_code)s::text)),
            "p_division_id" AS (
                SELECT id FROM division
                WHERE LOWER(code) = LOWER((TABLE "p_division_code"))
                LIMIT 1
            )
        SELECT
            pi.id,
            pi.invoice_no,
            pi.invoice_date,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_amount,
            pi.remarks,
            s.gstin          AS supplier_gstin,
            s.address_line1  AS supplier_address_line1,
            s.address_line2  AS supplier_address_line2,
            s.city           AS supplier_city,
            st.name          AS supplier_state,
            s.pincode        AS supplier_pincode,
            json_agg(
                json_build_object(
                    'hsn_code',         pil.hsn_code,
                    'qty',              pil.qty,
                    'unit_price',       pil.unit_price,
                    'aggregate_amount', pil.aggregate_amount,
                    'gst_rate',         pil.gst_rate,
                    'cgst_amount',      pil.cgst_amount,
                    'sgst_amount',      pil.sgst_amount,
                    'igst_amount',      pil.igst_amount,
                    'total_amount',     pil.total_amount,
                    'part_code',        spm.part_code
                ) ORDER BY pil.id
            ) AS lines
        FROM purchase_invoice pi
        JOIN supplier              s   ON s.id   = pi.supplier_id
        LEFT JOIN state            st  ON st.id  = s.state_id
        JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
        LEFT JOIN spare_part_master spm ON spm.id = pil.part_id
        WHERE pi.division_id = (TABLE "p_division_id")
          AND pi.is_posted = false
        GROUP BY pi.id, s.gstin, s.address_line1, s.address_line2, s.city, st.name, s.pincode
        ORDER BY pi.invoice_date ASC, pi.id ASC
    """

    MARK_PURCHASE_INVOICE_POSTED = """
        UPDATE purchase_invoice SET is_posted = true WHERE id = %(id)s
    """

    GET_UNPOSTED_SALES_INVOICES = """
        WITH
            "p_division_code" AS (VALUES(%(division_code)s::text)),
            "p_division_id" AS (
                SELECT id FROM division
                WHERE LOWER(code) = LOWER((TABLE "p_division_code"))
                LIMIT 1
            )
        SELECT
            si.id,
            si.invoice_no,
            si.invoice_date,
            si.aggregate        AS aggregate_amount,
            si.cgst_amount,
            si.sgst_amount,
            si.igst_amount,
            si.amount           AS total_amount,
            si.is_return,
            si.customer_name,
            si.customer_gstin,
            cc.mobile,
            cc.postal_code      AS customer_pin,
            CONCAT_WS(', ',
                NULLIF(cc.address_line1, ''),
                NULLIF(cc.address_line2, ''),
                NULLIF(cc.city, '')
            )                   AS customer_address,
            json_agg(
                json_build_object(
                    'hsn_code',         sil.hsn_code,
                    'qty',              sil.qty,
                    'unit_price',       sil.price,
                    'total_amount',     sil.amount,
                    'gst_rate',         sil.gst_rate,
                    'cgst_amount',      sil.cgst_amount,
                    'sgst_amount',      sil.sgst_amount,
                    'igst_amount',      sil.igst_amount,
                    'part_code',        sp.part_code,
                    'part_name',        sp.part_name,
                    'item_description', sil.item_description
                ) ORDER BY sil.id
            ) AS lines
        FROM sales_invoice si
        LEFT JOIN customer_contact cc  ON cc.id = si.customer_contact_id
        JOIN sales_invoice_line    sil ON sil.sales_invoice_id = si.id
        LEFT JOIN spare_part_master sp ON sp.id = sil.part_id
        WHERE si.division_id = (TABLE "p_division_id")
          AND si.is_posted = false
        GROUP BY si.id, cc.mobile, cc.postal_code,
                 cc.address_line1, cc.address_line2, cc.city
        ORDER BY si.invoice_date ASC, si.id ASC
    """

    MARK_SALES_INVOICE_POSTED = """
        UPDATE sales_invoice SET is_posted = true WHERE id = %(id)s
    """

    GET_UNPOSTED_JOB_INVOICES = """
        WITH
            "p_division_code" AS (VALUES(%(division_code)s::text)),
            "p_division_id" AS (
                SELECT id FROM division
                WHERE LOWER(code) = LOWER((TABLE "p_division_code"))
                LIMIT 1
            )
        SELECT
            ji.id,
            ji.job_id,
            j.job_no,
            j.is_igst,
            cc.full_name      AS customer_name,
            cc.mobile,
            cc.gstin          AS customer_gstin,
            cc.postal_code    AS customer_pin,
            CONCAT_WS(', ',
                NULLIF(cc.address_line1, ''),
                NULLIF(cc.address_line2, ''),
                NULLIF(cc.city, '')
            )                 AS customer_address,
            ji.invoice_no,
            ji.invoice_date,
            ji.supply_state_code,
            ji.aggregate,
            ji.cgst_amount,
            ji.sgst_amount,
            ji.igst_amount,
            ji.amount,
            COALESCE(
                json_agg(
                    json_build_object(
                        'description', jil.description,
                        'part_code',   jil.part_code,
                        'hsn_code',    jil.hsn_code,
                        'qty',         jil.qty,
                        'price',       jil.price,
                        'aggregate',   jil.aggregate,
                        'gst_rate',    jil.gst_rate,
                        'cgst_amount', jil.cgst_amount,
                        'sgst_amount', jil.sgst_amount,
                        'igst_amount', jil.igst_amount,
                        'amount',      jil.amount
                    ) ORDER BY jil.id
                ) FILTER (WHERE jil.id IS NOT NULL),
                '[]'::json
            ) AS lines
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN job_invoice_line jil ON jil.job_invoice_id = ji.id
        WHERE j.division_id = (TABLE "p_division_id")
          AND ji.is_posted = false
        GROUP BY ji.id, j.job_no, j.is_igst,
                 cc.full_name, cc.mobile, cc.gstin, cc.postal_code,
                 cc.address_line1, cc.address_line2, cc.city
        ORDER BY ji.invoice_date ASC, ji.id ASC
    """

    MARK_JOB_INVOICE_POSTED = """
        UPDATE job_invoice SET is_posted = true WHERE id = %(id)s
    """

    # Per-division unposted counts for all four document types, for a branch.
    GET_UNPOSTED_COUNTS_BY_DIVISION = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            d.id   AS division_id,
            d.code AS division_code,
            d.name AS division_name,
            (SELECT COUNT(*) FROM job_payment jp
                JOIN job j ON j.id = jp.job_id
                WHERE j.division_id = d.id AND jp.is_posted = false) AS money_receipts,
            (SELECT COUNT(*) FROM purchase_invoice pi
                WHERE pi.division_id = d.id AND pi.is_posted = false) AS purchase_invoices,
            (SELECT COUNT(*) FROM sales_invoice si
                WHERE si.division_id = d.id AND si.is_posted = false) AS sales_invoices,
            (SELECT COUNT(*) FROM job_invoice ji
                JOIN job j ON j.id = ji.job_id
                WHERE j.division_id = d.id AND ji.is_posted = false) AS job_invoices
        FROM division d
        WHERE d.branch_id = (table "p_branch_id")
          AND d.is_active = true
        ORDER BY d.name
    """
