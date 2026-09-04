"""SQL constants for the reports audit domain.

Split from app/db/sql_store.py — see plans/plan.md Step 3.
"""


class ReportsAuditSql:
    """SQL constants for the reports audit domain."""

    # ── Reports — Dashboard ───────────────────────────────────────────────────

    GET_DASHBOARD_KPIS = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
            ) AS jobs_received,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
                  AND j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS jobs_received_warranty,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
                  AND j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS jobs_received_oow,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                  AND j.is_closed = true
            ) AS jobs_delivered,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = false
                  AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN')
            ) AS jobs_open,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = false
                  AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN')
                  AND j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS jobs_open_warranty,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = false
                  AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN')
                  AND j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS jobs_open_oow,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = false
                  AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN')
                  AND j.job_date < (CURRENT_DATE - INTERVAL '7 days')
            ) AS jobs_overdue,
            COALESCE(SUM(ji.amount) FILTER (
                WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
            ), 0) AS revenue
        FROM job j
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN job_status  js ON js.id     = j.job_status_id
    """

    GET_DASHBOARD_OPEN_JOBS_BY_PRODUCT = """
        SELECT
            COALESCE(p.name, 'Unknown') AS product_name,
            COUNT(*) FILTER (
                WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS warranty_count,
            COUNT(*) FILTER (
                WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS oow_count,
            COUNT(*) AS total_count
        FROM job j
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        LEFT JOIN job_status           js ON js.id   = j.job_status_id
        WHERE j.is_closed = false
          AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN')
        GROUP BY p.name
        ORDER BY total_count DESC
    """

    GET_DASHBOARD_MONTHLY_INTAKE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            to_char(date_trunc('month', j.job_date), 'YYYY-MM') AS month,
            COUNT(*) FILTER (
                WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS warranty_count,
            COUNT(*) FILTER (
                WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS oow_count,
            COUNT(*) AS total_count
        FROM job j
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY date_trunc('month', j.job_date)
        ORDER BY date_trunc('month', j.job_date)
    """

    GET_DASHBOARD_RECENT_JOBS = """
        with "p_limit" as (values(%(limit)s::int))
        SELECT
            j.id, j.job_no, j.job_date,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS is_warranty
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT (table "p_limit")
    """

    GET_DASHBOARD_OVERDUE_JOBS = """
        with
            "p_limit"      as (values(%(limit)s::int)),
            "p_overdue_days" as (values(%(overdue_days)s::int))
        SELECT
            j.id, j.job_no, j.job_date,
            cc.full_name              AS customer_name,
            (CURRENT_DATE - j.job_date) AS days_old,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        WHERE j.is_closed = false
          AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN')
          AND j.job_date < (CURRENT_DATE - (table "p_overdue_days") * INTERVAL '1 day')
        ORDER BY j.job_date ASC, j.id ASC
        LIMIT (table "p_limit")
    """

    GET_DASHBOARD_JOBS_RECEIVED_LIST = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            j.id, j.job_no, j.job_date,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS is_warranty
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
          AND (
              %(is_warranty)s::boolean IS NULL
              OR (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) = %(is_warranty)s::boolean
          )
        ORDER BY j.job_date DESC, j.id DESC
    """

    GET_DASHBOARD_JOBS_DELIVERED_LIST = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            j.id, j.job_no, j.job_date,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS is_warranty
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
          AND j.is_closed = true
        ORDER BY j.delivery_date DESC, j.id DESC
    """

    GET_DASHBOARD_REVENUE_DETAIL = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            ji.id AS invoice_id,
            j.job_no,
            ji.invoice_date,
            ji.amount,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS is_warranty
        FROM job_invoice ji
        JOIN job                      j   ON j.id   = ji.job_id
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY ji.invoice_date DESC, j.id DESC
    """

    GET_DASHBOARD_STATUS_MIX = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            js.code AS status_code,
            js.name AS status_name,
            COUNT(*) AS jobs_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY js.code, js.name, js.display_order
        ORDER BY js.display_order, js.code
    """

    GET_DASHBOARD_TOP_TECHNICIANS = """
        with
            "p_from"  as (values(%(from)s::date)),
            "p_to"    as (values(%(to)s::date)),
            "p_limit" as (values(%(limit)s::int))
        SELECT
            t.id                AS technician_id,
            t.name              AS technician_name,
            COUNT(DISTINCT j.id) AS jobs_count,
            COALESCE(SUM(ji.aggregate), 0) AS revenue,
            COALESCE(SUM(ji.aggregate), 0)
              - COALESCE((
                  SELECT SUM(jpu.cost_price * jpu.qty)
                  FROM job_part_used jpu
                  WHERE jpu.job_id = j.id
                ), 0) AS profit
        FROM job j
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        JOIN technician t ON t.id = j.technician_id
        WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
          AND j.is_closed = true
        GROUP BY t.id, t.name, j.id
        ORDER BY profit DESC NULLS LAST
        LIMIT (table "p_limit")
    """

    # ── Reports — Warranty (Special) ──────────────────────────────────────────

    GET_WARRANTY_JOBS_SUMMARY_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(DISTINCT j.id) AS warranty_jobs_count,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_final = true
            ) AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = true AND j.delivery_date IS NOT NULL
            ) AS delivered_count,
            COALESCE(SUM(jpu.qty), 0)                         AS parts_qty,
            COALESCE(SUM(jpu.cost_price * jpu.qty), 0)        AS parts_value,
            COUNT(DISTINCT jpu.part_id)                        AS distinct_parts_count
        FROM job j
        LEFT JOIN job_part_used jpu ON jpu.job_id = j.id
        WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
          AND COALESCE(j.delivery_date, j.job_date) BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_WARRANTY_JOBS_LIST_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            j.id,
            j.job_no,
            j.job_date,
            j.delivery_date,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            t.name                    AS technician_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            j.warranty_card_no,
            COALESCE(SUM(jpu.qty), 0)                  AS parts_qty,
            COALESCE(SUM(jpu.cost_price * jpu.qty), 0) AS parts_value
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        LEFT JOIN job_part_used       jpu ON jpu.job_id = j.id
        WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
          AND COALESCE(j.delivery_date, j.job_date) BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY j.id, j.job_no, j.job_date, j.delivery_date, j.warranty_card_no,
                 cc.full_name, p.name, b.name, pbm.model_name, t.name,
                 js.code, js.name
        ORDER BY COALESCE(j.delivery_date, j.job_date) DESC, j.id DESC
    """

    GET_WARRANTY_PARTS_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            jpu.id                                       AS line_id,
            jpu.created_at::date                         AS consumed_date,
            j.id                                         AS job_id,
            j.job_no,
            j.warranty_card_no,
            spm.part_code,
            spm.part_name,
            b.name                                       AS brand_name,
            jpu.qty,
            jpu.cost_price,
            (jpu.cost_price * jpu.qty)                   AS line_value,
            t.name                                       AS technician_name
        FROM job_part_used jpu
        JOIN job              j   ON j.id   = jpu.job_id
        JOIN spare_part_master spm ON spm.id = jpu.part_id
        LEFT JOIN brand        b   ON b.id   = spm.brand_id
        LEFT JOIN technician   t   ON t.id   = j.technician_id
        WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
          AND jpu.created_at::date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY jpu.created_at DESC, jpu.id DESC
    """

    GET_WARRANTY_PARTS_BY_PART_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            spm.id                                       AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                                       AS brand_name,
            SUM(jpu.qty)                                 AS total_qty,
            SUM(jpu.cost_price * jpu.qty)                AS total_value,
            COUNT(DISTINCT j.id)                         AS jobs_count
        FROM job_part_used jpu
        JOIN job              j   ON j.id   = jpu.job_id
        JOIN spare_part_master spm ON spm.id = jpu.part_id
        LEFT JOIN brand        b   ON b.id   = spm.brand_id
        WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
          AND jpu.created_at::date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY spm.id, spm.part_code, spm.part_name, b.name
        ORDER BY total_value DESC NULLS LAST
    """

    GET_WARRANTY_TREND_MONTHLY = """
        with
            "p_months_back" as (values(%(months_back)s::int))
        SELECT
            to_char(m.month_start, 'YYYY-MM') AS month,
            COUNT(DISTINCT j.id)                          AS warranty_jobs,
            COALESCE(SUM(jpu.qty), 0)                     AS parts_qty,
            COALESCE(SUM(jpu.cost_price * jpu.qty), 0)    AS parts_value
        FROM (
            SELECT generate_series(
                date_trunc('month', CURRENT_DATE) - ((table "p_months_back") - 1) * INTERVAL '1 month',
                date_trunc('month', CURRENT_DATE),
                INTERVAL '1 month'
            )::date AS month_start
        ) m
        LEFT JOIN job j
               ON j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
              AND date_trunc('month', COALESCE(j.delivery_date, j.job_date)) = m.month_start
        LEFT JOIN job_part_used jpu ON jpu.job_id = j.id
        GROUP BY m.month_start
        ORDER BY m.month_start
    """

    GET_WARRANTY_JOB_PARTS_DETAIL = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT
            jpu.id                       AS line_id,
            spm.part_code,
            spm.part_name,
            b.name                       AS brand_name,
            jpu.qty,
            jpu.cost_price,
            (jpu.cost_price * jpu.qty)   AS line_value,
            jpu.remarks,
            jpu.created_at
        FROM job_part_used jpu
        JOIN spare_part_master spm ON spm.id = jpu.part_id
        LEFT JOIN brand        b   ON b.id   = spm.brand_id
        WHERE jpu.job_id = (table "p_job_id")
        ORDER BY jpu.id
    """

    # ── Reports — Job Reports ─────────────────────────────────────────────────

    GET_JOBS_RECEIVED_BY_CATEGORY_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            p.name AS category_name,
            COUNT(*) FILTER (WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
            COUNT(*) FILTER (WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
            COUNT(*)                                                                            AS total_count
        FROM job j
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY p.name
    """

    # Drill-down for one Jobs Received cell (category × date bucket) — same filter
    # as GET_JOBS_RECEIVED_BY_CATEGORY_RANGE_SPLIT above, row-level instead of counted.
    GET_JOBS_RECEIVED_DETAIL = """
        with
            "p_from"     as (values(%(from)s::date)),
            "p_to"       as (values(%(to)s::date)),
            "p_category" as (values(%(category_name)s::text))
        SELECT
            'j-' || j.id as row_key, j.id, j.job_no, j.job_date as event_date, j.created_at as event_time,
            cc.full_name as customer_name, b.name as brand_name, pbm.model_name as model_name, p.name as product_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) as is_warranty
        FROM job j
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand b ON b.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
          AND p.name = (table "p_category")
        ORDER BY j.job_date DESC, j.job_no
    """

    GET_EVENT_TRACKING_COUNTS = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date)),
            categorized as (
                select
                    case js.code
                        when 'COMPLETED_OK'     then 'Finalize'
                        when 'DELIVERED_OK'     then 'Deliver'
                        when 'DELIVERED_NOT_OK' then 'Deliver'
                        else 'Status Change'
                    end as event_name
                from job_transaction jt
                join job_status js on js.id = jt.status_id
                where jt.transaction_date between (table "p_from") and (table "p_to")
                  -- Received is counted from job.job_date below, one row per job —
                  -- matches the Dashboard / Jobs Summary "received" count instead of
                  -- job_transaction's per-status-change row (which double-counts a
                  -- job that is later corrected back to Received).
                  -- Return / Cancel / Disposed are not tracked as events at all —
                  -- excluded here rather than folded into "Status Change".
                  and js.code not in ('RECEIVED', 'RETURN', 'CANCELLED', 'DISPOSED')
            ),
            received as (
                select count(distinct j.id) as cnt
                from job j
                where j.job_date between (table "p_from") and (table "p_to")
            )
        select event_name, count(*) as count
        from categorized
        group by event_name
        union all
        select 'Received' as event_name, cnt as count
        from received
        where cnt > 0
    """

    # Drill-down for one Event Tracking cell (event × date bucket) — same event
    # split as GET_EVENT_TRACKING_COUNTS above, just returning the underlying rows
    # instead of a count. 'Received' reads job.job_date (job-level, one row per
    # job); the other three read job_transaction.transaction_date (event-level).
    # Status is always the job's *current* status (job.job_status_id) for
    # 'Received' — the event itself is already known to be the receipt.
    # event_time is a separate timestamptz column (job.created_at /
    # job_transaction.performed_at) alongside the date-only event_date —
    # the bucket/filter grouping stays on the plain date, but the drill-down
    # can still show the actual time of day beneath it.
    GET_EVENT_TRACKING_JOBS = """
        with
            "p_from"       as (values(%(from)s::date)),
            "p_to"         as (values(%(to)s::date)),
            "p_event_name" as (values(%(event_name)s::text)),
            -- Cost/Sale/Profit come from the job's own finalized lines, never from
            -- job_invoice: a Finalize event happens before the job is invoiced, so
            -- an invoice-based figure would report every just-finalized job at a
            -- loss of its full cost. Sale is the pre-GST selling total (what
            -- job_invoice.aggregate later becomes), so these match the Job Final
            -- Info panel this drill-down opens on row click.
            parts as (
                select job_id,
                       SUM(cost_price * qty)    as parts_cost,
                       SUM(selling_price * qty) as parts_sale
                from job_part_used group by job_id
            ),
            charges as (
                select job_id,
                       SUM(cost_price * qty)    as charges_cost,
                       SUM(selling_price * qty) as charges_sale
                from job_additional_charge group by job_id
            )
        (
            select
                'j-' || j.id as row_key, j.id, j.job_no, j.job_date as event_date, j.created_at as event_time, cur_js.name as status_label,
                cc.full_name as customer_name, b.name as brand_name, pbm.model_name as model_name, p.name as product_name,
                (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) as is_warranty,
                d.code as division_code,
                COALESCE(parts.parts_cost, 0) + COALESCE(charges.charges_cost, 0) as total_cost,
                COALESCE(parts.parts_sale, 0) + COALESCE(charges.charges_sale, 0) as total_charges,
                COALESCE(parts.parts_sale, 0) + COALESCE(charges.charges_sale, 0)
                  - COALESCE(parts.parts_cost, 0) - COALESCE(charges.charges_cost, 0) as profit
            from job j
            left join job_status cur_js on cur_js.id = j.job_status_id
            left join customer_contact cc on cc.id = j.customer_contact_id
            left join product_brand_model pbm on pbm.id = j.product_brand_model_id
            left join brand b on b.id = pbm.brand_id
            left join product p on p.id = pbm.product_id
            left join division d on d.id = j.division_id
            left join parts   on parts.job_id   = j.id
            left join charges on charges.job_id = j.id
            where (table "p_event_name") = 'Received'
              and j.job_date between (table "p_from") and (table "p_to")
        )
        union all
        (
            select
                't-' || jt.id as row_key, j.id, j.job_no, jt.transaction_date as event_date, jt.performed_at as event_time, js.name as status_label,
                cc.full_name as customer_name, b.name as brand_name, pbm.model_name as model_name, p.name as product_name,
                (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) as is_warranty,
                d.code as division_code,
                COALESCE(parts.parts_cost, 0) + COALESCE(charges.charges_cost, 0) as total_cost,
                COALESCE(parts.parts_sale, 0) + COALESCE(charges.charges_sale, 0) as total_charges,
                COALESCE(parts.parts_sale, 0) + COALESCE(charges.charges_sale, 0)
                  - COALESCE(parts.parts_cost, 0) - COALESCE(charges.charges_cost, 0) as profit
            from job_transaction jt
            join job j on j.id = jt.job_id
            join job_status js on js.id = jt.status_id
            left join customer_contact cc on cc.id = j.customer_contact_id
            left join product_brand_model pbm on pbm.id = j.product_brand_model_id
            left join brand b on b.id = pbm.brand_id
            left join product p on p.id = pbm.product_id
            left join division d on d.id = j.division_id
            left join parts   on parts.job_id   = j.id
            left join charges on charges.job_id = j.id
            where (table "p_event_name") <> 'Received'
              and jt.transaction_date between (table "p_from") and (table "p_to")
              and (
                    ((table "p_event_name") = 'Finalize' and js.code = 'COMPLETED_OK')
                 or ((table "p_event_name") = 'Deliver' and js.code in ('DELIVERED_OK', 'DELIVERED_NOT_OK'))
                 or ((table "p_event_name") = 'Status Change'
                     and js.code not in ('RECEIVED', 'COMPLETED_OK', 'DELIVERED_OK', 'DELIVERED_NOT_OK', 'RETURN', 'CANCELLED', 'DISPOSED'))
              )
        )
        order by event_date desc, job_no
    """

    GET_JOBS_REPAIRED_OK_BY_CATEGORY_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            p.name AS category_name,
            COUNT(*) FILTER (WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
            COUNT(*) FILTER (WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
            COUNT(*)                                                                            AS total_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE j.is_final = true
          AND js.code IN ('COMPLETED_OK', 'DELIVERED_OK')
          AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY p.name
    """

    # Drill-down for one Jobs Repaired (OK) cell — same filter as
    # GET_JOBS_REPAIRED_OK_BY_CATEGORY_RANGE_SPLIT above, row-level instead of counted.
    GET_JOBS_REPAIRED_OK_DETAIL = """
        with
            "p_from"     as (values(%(from)s::date)),
            "p_to"       as (values(%(to)s::date)),
            "p_category" as (values(%(category_name)s::text))
        SELECT
            'j-' || j.id as row_key, j.id, j.job_no, j.updated_at::date as event_date, j.updated_at as event_time,
            cc.full_name as customer_name, b.name as brand_name, pbm.model_name as model_name, p.name as product_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) as is_warranty
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand b ON b.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE j.is_final = true
          AND js.code IN ('COMPLETED_OK', 'DELIVERED_OK')
          AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
          AND p.name = (table "p_category")
        ORDER BY j.updated_at DESC, j.job_no
    """

    GET_JOBS_DELIVERED_OK_BY_CATEGORY_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date)),
            parts as (
                SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
            ),
            charges as (
                SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
            )
        SELECT
            p.name AS category_name,
            COUNT(*) FILTER (WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
            COUNT(*) FILTER (WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
            COUNT(*)                                                                            AS total_count,
            COALESCE(SUM(ji.aggregate), 0)                                                      AS revenue_amount,
            COALESCE(SUM(ji.aggregate), 0) - COALESCE(SUM(parts.parts_cost), 0) - COALESCE(SUM(charges.charges_cost), 0) AS profit_amount
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN product p ON p.id = pbm.product_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN parts   ON parts.job_id   = j.id
        LEFT JOIN charges ON charges.job_id = j.id
        WHERE js.code = 'DELIVERED_OK'
          AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY p.name
    """

    # Drill-down for one Jobs Delivered (OK) cell — same filter as
    # GET_JOBS_DELIVERED_OK_BY_CATEGORY_RANGE_SPLIT above, row-level instead of counted,
    # plus per-job cost/sale/profit (meaningful once a job is delivered and invoiced).
    GET_JOBS_DELIVERED_OK_DETAIL = """
        with
            "p_from"     as (values(%(from)s::date)),
            "p_to"       as (values(%(to)s::date)),
            "p_category" as (values(%(category_name)s::text)),
            parts as (
                SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
            ),
            charges as (
                SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
            )
        SELECT
            'j-' || j.id as row_key, j.id, j.job_no, j.delivery_date as event_date, dt.performed_at as event_time,
            cc.full_name as customer_name, b.name as brand_name, pbm.model_name as model_name, p.name as product_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) as is_warranty,
            COALESCE(parts.parts_cost, 0) + COALESCE(charges.charges_cost, 0) as total_cost,
            COALESCE(ji.aggregate, 0) as total_charges,
            COALESCE(ji.aggregate, 0) - COALESCE(parts.parts_cost, 0) - COALESCE(charges.charges_cost, 0) as profit
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand b ON b.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN parts   ON parts.job_id   = j.id
        LEFT JOIN charges ON charges.job_id = j.id
        -- job.delivery_date has no time of its own — the actual delivery
        -- timestamp lives on the job_transaction row that moved this job into
        -- its current (DELIVERED_OK) status, same source Event Tracking's own
        -- 'Deliver' branch reads (jt.performed_at). Latest such row wins, same
        -- as GET_JOB_TRANSACTIONS_DETAIL's own precedent for one-row-per-event.
        LEFT JOIN LATERAL (
            SELECT jt.performed_at
            FROM job_transaction jt
            WHERE jt.job_id = j.id AND jt.status_id = j.job_status_id
            ORDER BY jt.performed_at DESC
            LIMIT 1
        ) dt ON true
        WHERE js.code = 'DELIVERED_OK'
          AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
          AND p.name = (table "p_category")
        ORDER BY j.delivery_date DESC, j.job_no
    """

    GET_JOB_TRANSACTIONS_BY_STATUS_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            js.name AS category_name,
            COUNT(*) FILTER (WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
            COUNT(*) FILTER (WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
            COUNT(*)                                                                            AS total_count
        FROM job_transaction jt
        JOIN job_status js ON js.id = jt.status_id
        JOIN job j ON j.id = jt.job_id
        WHERE jt.transaction_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY js.name
    """

    # Drill-down for one Job Transactions cell (status × date bucket) — same filter
    # as GET_JOB_TRANSACTIONS_BY_STATUS_RANGE_SPLIT above, row-level instead of counted.
    # Uses jt.id (not j.id) for row_key since one job can have multiple transactions
    # of the same status within a range (e.g. a status corrected back-and-forth).
    GET_JOB_TRANSACTIONS_DETAIL = """
        with
            "p_from"     as (values(%(from)s::date)),
            "p_to"       as (values(%(to)s::date)),
            "p_category" as (values(%(category_name)s::text))
        SELECT
            't-' || jt.id as row_key, j.id, j.job_no, jt.transaction_date as event_date, jt.performed_at as event_time,
            cc.full_name as customer_name, b.name as brand_name, pbm.model_name as model_name, p.name as product_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) as is_warranty
        FROM job_transaction jt
        JOIN job_status js ON js.id = jt.status_id
        JOIN job j ON j.id = jt.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand b ON b.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE jt.transaction_date BETWEEN (table "p_from") AND (table "p_to")
          AND js.name = (table "p_category")
        ORDER BY jt.transaction_date DESC, j.job_no
    """

    GET_DELIVERED_JOBS_DETAILED_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            j.id, j.job_no, j.delivery_date,
            cc.full_name                        AS customer_name,
            b.name                              AS brand_name,
            pbm.model_name                      AS model_name,
            p.name                              AS product_name,
            t.name                              AS technician_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS is_warranty,
            COALESCE(parts.parts_cost, 0)       AS parts_cost,
            COALESCE(charges.charges_cost, 0)   AS charges_cost,
            COALESCE(ji.amount, 0)              AS selling_total,
            COALESCE(ji.aggregate, 0)
              - COALESCE(parts.parts_cost, 0)
              - COALESCE(charges.charges_cost, 0) AS profit,
            COALESCE(ji.cgst_amount, 0)
              + COALESCE(ji.sgst_amount, 0)
              + COALESCE(ji.igst_amount, 0)     AS gst
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN technician  t  ON t.id  = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand       b  ON b.id  = pbm.brand_id
        LEFT JOIN product     p  ON p.id  = pbm.product_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE js.code = 'DELIVERED_OK'
          AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY j.delivery_date DESC, j.id DESC
    """

    GET_JOB_TRANSACTION_LEDGER_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            jt.id,
            jt.transaction_date,
            j.job_no,
            js.code                AS status_code,
            js.name                AS status_name,
            t.name                 AS technician_name,
            jt.remarks
        FROM job_transaction jt
        JOIN job              j  ON j.id  = jt.job_id
        LEFT JOIN job_status  js ON js.id = jt.status_id
        LEFT JOIN technician  t  ON t.id  = jt.technician_id
        WHERE jt.transaction_date::date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY jt.transaction_date DESC, jt.id DESC
    """

    GET_JOB_PIPELINE_BY_STATUS_AGE = """
        SELECT
            js.code AS status_code,
            js.name AS status_name,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) <  1) AS bucket_0,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 1  AND 3 ) AS bucket_1_3,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 4  AND 7 ) AS bucket_4_7,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 8  AND 15) AS bucket_8_15,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 16 AND 30) AS bucket_16_30,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) > 30) AS bucket_over_30,
            COUNT(*) AS total_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.is_closed = false
        GROUP BY js.code, js.name, js.display_order
        ORDER BY js.display_order, js.code
    """

    GET_JOB_PIPELINE_CELL_JOBS = """
        with
            "p_status_code" as (values(%(status_code)s::text)),
            "p_age_min"     as (values(%(age_min)s::int)),
            "p_age_max"     as (values(%(age_max)s::int))
        SELECT
            j.id, j.job_no, j.job_date,
            (CURRENT_DATE - j.job_date) AS days_old,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name,
            (j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS is_warranty
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        WHERE j.is_closed = false
          AND js.code = (table "p_status_code")
          AND (CURRENT_DATE - j.job_date) BETWEEN (table "p_age_min") AND (table "p_age_max")
        ORDER BY j.job_date ASC, j.id ASC
    """

    GET_JOB_STATUS_TREND_MONTHLY = """
        with
            "p_months_back" as (values(%(months_back)s::int))
        SELECT
            to_char(date_trunc('month', j.job_date), 'YYYY-MM') AS month,
            js.code                                            AS status_code,
            js.name                                            AS status_name,
            COUNT(*) AS jobs_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.job_date >= (date_trunc('month', CURRENT_DATE) - ((table "p_months_back") - 1) * INTERVAL '1 month')::date
        GROUP BY date_trunc('month', j.job_date), js.code, js.name, js.display_order
        ORDER BY date_trunc('month', j.job_date), js.display_order, js.code
    """

    # ── Reports — Financial ───────────────────────────────────────────────────

    GET_PROFIT_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COALESCE(SUM(ji.aggregate), 0)                        AS total_revenue,
            COALESCE(SUM(parts.parts_cost), 0)
              + COALESCE(SUM(charges.charges_cost), 0)         AS total_cost,
            COALESCE(SUM(ji.aggregate), 0)
              - COALESCE(SUM(parts.parts_cost), 0)
              - COALESCE(SUM(charges.charges_cost), 0)         AS total_profit,
            COALESCE(SUM(ji.aggregate) FILTER (
                WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ), 0)                                              AS warranty_revenue,
            COALESCE(SUM(ji.aggregate) FILTER (
                WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ), 0)                                              AS oow_revenue,
            COALESCE(SUM(ji.aggregate) FILTER (
                WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ), 0)
              - COALESCE(SUM(parts.parts_cost) FILTER (
                  WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
                ), 0)
              - COALESCE(SUM(charges.charges_cost) FILTER (
                  WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
                ), 0)                                          AS warranty_profit,
            COALESCE(SUM(ji.aggregate) FILTER (
                WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ), 0)
              - COALESCE(SUM(parts.parts_cost) FILTER (
                  WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
                ), 0)
              - COALESCE(SUM(charges.charges_cost) FILTER (
                  WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
                ), 0)                                          AS oow_profit
        FROM job j
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_REVENUE_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COALESCE((SELECT SUM(amount) FROM job_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")), 0) AS job_invoice_total,
            COALESCE((SELECT SUM(amount) FROM sales_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                        AND is_return = false), 0)                                         AS sales_invoice_total,
            COALESCE((SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM job_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")), 0)
              + COALESCE((SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM sales_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                        AND is_return = false), 0)                                         AS gst_total,
            COALESCE((SELECT COUNT(*) FROM job_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")), 0) AS job_invoice_count,
            COALESCE((SELECT COUNT(*) FROM sales_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                        AND is_return = false), 0)                                         AS sales_invoice_count
    """

    GET_REVENUE_BY_MONTH_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month,
            COALESCE(SUM(amount), 0)                              AS revenue
        FROM (
            SELECT invoice_date, amount FROM job_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
            UNION ALL
            SELECT invoice_date, amount FROM sales_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                AND is_return = false
        ) x
        GROUP BY date_trunc('month', invoice_date)
        ORDER BY date_trunc('month', invoice_date)
    """

    GET_CASH_REGISTER_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            jp.payment_date,
            jp.receipt_no,
            j.job_no,
            cc.full_name              AS customer_name,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.remarks
        FROM job_payment jp
        JOIN job              j  ON j.id  = jp.job_id
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE jp.payment_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY jp.payment_date DESC, jp.id DESC
    """

    GET_SALES_REPORT_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            si.invoice_date,
            si.invoice_no,
            si.customer_name,
            sil.part_id,
            spm.part_code,
            spm.part_name,
            b.name           AS brand_name,
            sil.qty,
            sil.price,
            sil.amount,
            sil.gst_rate,
            (sil.cgst_amount + sil.sgst_amount + sil.igst_amount) AS gst_amount
        FROM sales_invoice si
        JOIN sales_invoice_line sil ON sil.sales_invoice_id = si.id
        JOIN spare_part_master  spm ON spm.id = sil.part_id
        LEFT JOIN brand         b   ON b.id   = spm.brand_id
        WHERE si.invoice_date BETWEEN (table "p_from") AND (table "p_to")
          AND si.is_return = false
        ORDER BY si.invoice_date DESC, si.id DESC, sil.id ASC
    """

    GET_GST_SUMMARY_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month,
            COALESCE(SUM(cgst_amount), 0) AS cgst,
            COALESCE(SUM(sgst_amount), 0) AS sgst,
            COALESCE(SUM(igst_amount), 0) AS igst,
            COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total_gst,
            COALESCE(SUM(aggregate), 0) AS aggregate
        FROM (
            SELECT invoice_date, cgst_amount, sgst_amount, igst_amount, aggregate
              FROM job_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
            UNION ALL
            SELECT invoice_date, cgst_amount, sgst_amount, igst_amount, aggregate
              FROM sales_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                AND is_return = false
        ) x
        GROUP BY date_trunc('month', invoice_date)
        ORDER BY date_trunc('month', invoice_date)
    """

    # ── Reports — Performance ─────────────────────────────────────────────────

    GET_TECHNICIAN_SCORECARD_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
            )                                     AS received_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.is_final = true
                AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
            )                                     AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                AND j.is_closed = true
            )                                     AS delivered_count,
            COALESCE(SUM(ji.aggregate) FILTER (
              WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
            ), 0)                                 AS revenue,
            COALESCE(SUM(ji.aggregate) FILTER (
              WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
            ), 0)
              - COALESCE(SUM(parts.parts_cost) FILTER (
                  WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
                ), 0)
              - COALESCE(SUM(charges.charges_cost) FILTER (
                  WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
                ), 0)                             AS profit,
            COALESCE(AVG(EXTRACT(EPOCH FROM (j.delivery_date::timestamp - j.job_date::timestamp))/86400)
                     FILTER (WHERE j.delivery_date IS NOT NULL
                       AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")), 0)
                                                  AS avg_turnaround_days
        FROM technician t
        LEFT JOIN job         j  ON j.technician_id = t.id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY profit DESC NULLS LAST, t.name
    """

    GET_TECH_REPAIRED_DELIVERED_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.is_final = true
                AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
            )                                     AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                AND j.is_closed = true
            )                                     AS delivered_count
        FROM technician t
        LEFT JOIN job j ON j.technician_id = t.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY delivered_count DESC, repaired_count DESC, t.name
    """

    GET_PROFIT_BY_TECHNICIAN_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            COALESCE(SUM(ji.aggregate), 0)         AS revenue,
            COALESCE(SUM(parts.parts_cost), 0)
              + COALESCE(SUM(charges.charges_cost), 0) AS cost,
            COALESCE(SUM(ji.aggregate), 0)
              - COALESCE(SUM(parts.parts_cost), 0)
              - COALESCE(SUM(charges.charges_cost), 0) AS profit
        FROM technician t
        LEFT JOIN job         j  ON j.technician_id = t.id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
            AND ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY profit DESC NULLS LAST
    """

    GET_TECH_PRODUCTIVITY_HEATMAP_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            jt.transaction_date::date             AS day,
            COUNT(DISTINCT jt.job_id)             AS jobs_touched
        FROM job_transaction jt
        JOIN technician t ON t.id = jt.technician_id
        WHERE jt.transaction_date::date BETWEEN (table "p_from") AND (table "p_to")
          AND t.is_active = true
        GROUP BY t.id, t.name, jt.transaction_date::date
        ORDER BY t.name, day
    """

    # ── Reports — Profit ──────────────────────────────────────────────────────

    GET_TECHNICIAN_PROFIT_MONTHLY_FY = """
        with
            "p_from" as (values(%(from)s::date))
        SELECT
            t.id                                AS technician_id,
            t.name                              AS technician_name,
            m.month_idx                         AS month_idx,
            COUNT(DISTINCT jc.job_id)           AS delivered_count,
            COALESCE(SUM(jc.profit), 0)         AS profit,
            COALESCE(SUM(jc.total_charges), 0)  AS total_charges
        FROM technician t
        CROSS JOIN (SELECT generate_series(0, 11) AS month_idx) m
        LEFT JOIN (
            SELECT
                j.id                                                     AS job_id,
                j.technician_id                                          AS technician_id,
                (
                  (EXTRACT(YEAR  FROM AGE(date_trunc('month', j.delivery_date), date_trunc('month', (table "p_from")))) * 12
                 +  EXTRACT(MONTH FROM AGE(date_trunc('month', j.delivery_date), date_trunc('month', (table "p_from")))))
                )::int                                                   AS month_idx,
                COALESCE(ji.aggregate, 0)
                  - COALESCE(parts.parts_cost, 0)
                  - COALESCE(charges.charges_cost, 0)                    AS profit,
                COALESCE(ji.aggregate, 0)                                AS total_charges
            FROM job j
            JOIN job_status js ON js.id = j.job_status_id AND js.code = 'DELIVERED_OK'
            LEFT JOIN job_invoice ji ON ji.job_id = j.id
            LEFT JOIN (
                SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
            ) parts ON parts.job_id = j.id
            LEFT JOIN (
                SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
            ) charges ON charges.job_id = j.id
            WHERE j.delivery_date >= (table "p_from")
              AND j.delivery_date <  (table "p_from") + INTERVAL '12 months'
              AND COALESCE(ji.amount, 0) > 0
        ) jc ON jc.technician_id = t.id AND jc.month_idx = m.month_idx
        WHERE t.is_active = true
        GROUP BY t.id, t.name, m.month_idx
        ORDER BY t.name, m.month_idx
    """

    GET_TECHNICIAN_PROFIT_MONTH_JOBS = """
        with
            "p_technician_id" as (values(%(technician_id)s::bigint)),
            "p_from"          as (values(%(from)s::date)),
            "p_to"            as (values(%(to)s::date))
        SELECT
            j.id                                                   AS id,
            j.job_no                                               AS job_no,
            d.code                                                 AS division_code,
            j.delivery_date                                        AS delivery_date,
            cc.full_name                                           AS customer_name,
            b.name                                                 AS brand_name,
            pbm.model_name                                         AS model_name,
            p.name                                                 AS product_name,
            COALESCE(parts.parts_cost, 0)                          AS parts_cost,
            COALESCE(charges.charges_cost, 0)                      AS charges_cost,
            COALESCE(parts.parts_cost, 0)
              + COALESCE(charges.charges_cost, 0)                  AS total_cost,
            COALESCE(ji.aggregate, 0)
              - COALESCE(parts.parts_cost, 0)
              - COALESCE(charges.charges_cost, 0)                  AS profit,
            COALESCE(ji.aggregate, 0)                              AS total_charges
        FROM job j
        JOIN job_status js       ON js.id = j.job_status_id AND js.code = 'DELIVERED_OK'
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand       b  ON b.id  = pbm.brand_id
        LEFT JOIN product     p  ON p.id  = pbm.product_id
        LEFT JOIN division    d  ON d.id  = j.division_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE j.technician_id = (table "p_technician_id")
          AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
          AND COALESCE(ji.amount, 0) > 0
        ORDER BY j.delivery_date, j.job_no
    """

    # ── Reports — Inventory ───────────────────────────────────────────────────

    GET_PARTS_LEDGER_FY = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            spm.id                       AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                       AS brand_name,
            COALESCE(opening.opening_qty, 0)   AS opening_qty,
            COALESCE(opening.opening_qty, 0) * COALESCE(spm.cost_price, 0) AS opening_value,
            COALESCE(tx.dr_qty, 0)             AS dr_qty,
            COALESCE(tx.dr_qty, 0) * COALESCE(spm.cost_price, 0)           AS dr_value,
            COALESCE(tx.cr_qty, 0)             AS cr_qty,
            COALESCE(tx.cr_qty, 0) * COALESCE(spm.cost_price, 0)           AS cr_value,
            (COALESCE(opening.opening_qty, 0) + COALESCE(tx.dr_qty, 0) - COALESCE(tx.cr_qty, 0)) AS closing_qty,
            (COALESCE(opening.opening_qty, 0) + COALESCE(tx.dr_qty, 0) - COALESCE(tx.cr_qty, 0))
              * COALESCE(spm.cost_price, 0)                                 AS closing_value
        FROM spare_part_master spm
        LEFT JOIN brand b ON b.id = spm.brand_id
        LEFT JOIN (
            SELECT st.part_id,
                   SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE -st.qty END) AS opening_qty
            FROM stock_transaction st
            WHERE st.transaction_date < (table "p_from")
            GROUP BY st.part_id
        ) opening ON opening.part_id = spm.id
        LEFT JOIN (
            SELECT st.part_id,
                   SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE 0 END) AS dr_qty,
                   SUM(CASE WHEN st.dr_cr = 'C' THEN st.qty ELSE 0 END) AS cr_qty
            FROM stock_transaction st
            WHERE st.transaction_date BETWEEN (table "p_from") AND (table "p_to")
            GROUP BY st.part_id
        ) tx ON tx.part_id = spm.id
        WHERE spm.is_active = true
        ORDER BY spm.part_code
    """

    GET_PARTS_AGING = """
        SELECT
            spm.id            AS part_id,
            spm.part_code,
            spm.part_name,
            b.name            AS brand_name,
            COALESCE(sb.qty, 0) AS stock_qty,
            COALESCE(spm.cost_price, 0) AS cost_price,
            COALESCE(sb.qty, 0) * COALESCE(spm.cost_price, 0) AS stock_value,
            COALESCE(latest.last_dr_date, NULL) AS last_in_date,
            COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - latest.last_dr_date)), 999) AS age_days
        FROM spare_part_master spm
        LEFT JOIN brand b ON b.id = spm.brand_id
        LEFT JOIN (
            SELECT part_id, SUM(qty) AS qty FROM stock_balance GROUP BY part_id
        ) sb ON sb.part_id = spm.id
        LEFT JOIN (
            SELECT part_id, MAX(transaction_date) AS last_dr_date
            FROM stock_transaction
            WHERE dr_cr = 'D'
            GROUP BY part_id
        ) latest ON latest.part_id = spm.id
        WHERE spm.is_active = true
          AND COALESCE(sb.qty, 0) > 0
        ORDER BY age_days DESC NULLS LAST, spm.part_code
    """

    GET_PARTS_CONSUMPTION_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            x.consumed_date,
            x.part_code,
            x.part_name,
            x.brand_name,
            x.qty,
            x.source,
            x.ref_no,
            x.remarks
        FROM (
            SELECT
                jpu.created_at::date  AS consumed_date,
                spm.part_code,
                spm.part_name,
                b.name                AS brand_name,
                jpu.qty,
                'Job'                 AS source,
                j.job_no              AS ref_no,
                jpu.remarks           AS remarks
            FROM job_part_used jpu
            JOIN spare_part_master spm ON spm.id = jpu.part_id
            JOIN job              j   ON j.id   = jpu.job_id
            LEFT JOIN brand        b  ON b.id   = spm.brand_id
            WHERE jpu.created_at::date BETWEEN (table "p_from") AND (table "p_to")
            UNION ALL
            SELECT
                si.invoice_date       AS consumed_date,
                spm.part_code,
                spm.part_name,
                b.name                AS brand_name,
                sil.qty,
                'Sales'               AS source,
                si.invoice_no         AS ref_no,
                sil.remarks           AS remarks
            FROM sales_invoice_line sil
            JOIN sales_invoice  si  ON si.id  = sil.sales_invoice_id
            JOIN spare_part_master spm ON spm.id = sil.part_id
            LEFT JOIN brand     b   ON b.id   = spm.brand_id
            WHERE si.invoice_date BETWEEN (table "p_from") AND (table "p_to")
              AND si.is_return = false
        ) x
        ORDER BY x.consumed_date DESC
    """

    GET_STOCK_LEDGER_RANGE = """
        with
            "p_from"    as (values(%(from)s::date)),
            "p_to"      as (values(%(to)s::date)),
            "p_part_id" as (values(%(part_id)s::bigint))
        SELECT
            st.id,
            st.transaction_date,
            stt.code                  AS txn_type_code,
            stt.name                  AS txn_type_name,
            st.dr_cr,
            CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE 0 END AS dr_qty,
            CASE WHEN st.dr_cr = 'C' THEN st.qty ELSE 0 END AS cr_qty,
            st.qty,
            st.unit_cost,
            st.remarks
        FROM stock_transaction st
        JOIN stock_transaction_type stt ON stt.id = st.stock_transaction_type_id
        WHERE st.part_id = (table "p_part_id")
          AND st.transaction_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY st.transaction_date, st.id
    """

    GET_STOCK_MOVEMENT_SUMMARY_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            stt.code                  AS txn_type_code,
            stt.name                  AS txn_type_name,
            stt.dr_cr,
            COALESCE(SUM(st.qty), 0)  AS total_qty,
            COUNT(*)                  AS total_lines
        FROM stock_transaction st
        JOIN stock_transaction_type stt ON stt.id = st.stock_transaction_type_id
        WHERE st.transaction_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY stt.code, stt.name, stt.dr_cr
        ORDER BY total_qty DESC
    """

    GET_PARTS_CONSUMPTION_MONTHLY_LAST_6 = """
        SELECT
            spm.id                                          AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                                          AS brand_name,
            EXTRACT(YEAR FROM age(date_trunc('month', CURRENT_DATE), date_trunc('month', x.consumed_date))) * 12
              + EXTRACT(MONTH FROM age(date_trunc('month', CURRENT_DATE), date_trunc('month', x.consumed_date))) AS month_offset,
            SUM(x.qty)                                      AS qty
        FROM spare_part_master spm
        LEFT JOIN brand        b   ON b.id = spm.brand_id
        LEFT JOIN (
            SELECT jpu.part_id, jpu.created_at::date AS consumed_date, jpu.qty
              FROM job_part_used jpu
            UNION ALL
            SELECT sil.part_id, si.invoice_date AS consumed_date, sil.qty
              FROM sales_invoice_line sil
              JOIN sales_invoice si ON si.id = sil.sales_invoice_id
              WHERE si.is_return = false
        ) x ON x.part_id = spm.id
        WHERE spm.is_active = true
          AND x.consumed_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '6 months')::date
          AND x.consumed_date <  date_trunc('month', CURRENT_DATE)::date
        GROUP BY spm.id, spm.part_code, spm.part_name, b.name,
                 date_trunc('month', x.consumed_date)
        ORDER BY spm.part_code, month_offset
    """

    GET_PARTS_CURRENT_STOCK = """
        SELECT
            spm.id                       AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                       AS brand_name,
            COALESCE(SUM(sb.qty), 0)     AS stock_qty
        FROM spare_part_master spm
        LEFT JOIN brand         b  ON b.id  = spm.brand_id
        LEFT JOIN stock_balance sb ON sb.part_id = spm.id
        WHERE spm.is_active = true
        GROUP BY spm.id, spm.part_code, spm.part_name, b.name
        ORDER BY spm.part_code
    """

    # ── Reports — Trends ──────────────────────────────────────────────────────

    GET_JOBS_RECEIVED_BY_MONTH = GET_DASHBOARD_MONTHLY_INTAKE

    GET_JOBS_RECEIVED_BY_YEAR = """
        with
            "p_years_back" as (values(%(years_back)s::int)),
            "p_fy_start"   as (values(%(fy_start_month)s::int))
        SELECT
            CASE WHEN EXTRACT(MONTH FROM j.job_date) >= (table "p_fy_start")
                 THEN EXTRACT(YEAR FROM j.job_date)::int
                 ELSE (EXTRACT(YEAR FROM j.job_date) - 1)::int
            END AS fy_year,
            COUNT(*) FILTER (
              WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS warranty_count,
            COUNT(*) FILTER (
              WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')
            ) AS oow_count,
            COUNT(*) AS total_count
        FROM job j
        WHERE j.job_date >= (
            make_date(
                (EXTRACT(YEAR FROM CURRENT_DATE)::int - (table "p_years_back")),
                (table "p_fy_start"),
                1
            )
        )
        GROUP BY 1
        ORDER BY 1
    """

    GET_REPAIR_DELIVER_FUNNEL_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
            ) AS received_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.is_final = true
                AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
            ) AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                AND j.is_closed = true
            ) AS delivered_count
        FROM job j
    """

    GET_PROFIT_TREND_YOY = """
        with
            "p_months_back" as (values(%(months_back)s::int))
        SELECT
            to_char(date_trunc('month', ji.invoice_date), 'YYYY-MM') AS month,
            COALESCE(SUM(ji.aggregate), 0)
              - COALESCE(SUM(parts.parts_cost), 0)
              - COALESCE(SUM(charges.charges_cost), 0) AS profit
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE ji.invoice_date >= (date_trunc('month', CURRENT_DATE) - ((table "p_months_back") - 1) * INTERVAL '1 month')::date
        GROUP BY date_trunc('month', ji.invoice_date)
        ORDER BY date_trunc('month', ji.invoice_date)
    """
