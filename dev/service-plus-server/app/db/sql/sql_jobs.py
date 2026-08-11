"""SQL constants for the jobs domain.

Split from app/db/sql_store.py — see plans/plan.md Step 3.
"""


class JobsSql:
    """SQL constants for the jobs domain."""

    # ── Job Delivery Manners ──────────────────────────────────────────────────

    CHECK_JOB_DELIVERY_MANNER_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('PICKUP'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_delivery_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_DELIVERY_MANNER_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('PICKUP'::text)), -- Test line
        --     "p_id"   as (values(1::smallint))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_delivery_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_DELIVERY_MANNER_IN_USE = """
        with "dummy" as (values(1::int))
        SELECT false AS in_use
    """

    GET_JOB_DELIVERY_MANNERS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, display_order, is_active, is_system
        FROM job_delivery_manner
        ORDER BY display_order NULLS LAST, name
    """

    # ── Job Receive Conditions ────────────────────────────────────────────────

    CHECK_JOB_RECEIVE_CONDITION_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('GOOD'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_condition
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_RECEIVE_CONDITION_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('GOOD'::text)),  -- Test line
        --     "p_id"   as (values(1::smallint))    -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_condition
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_RECEIVE_CONDITION_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE job_receive_condition_id = (table "p_id")
        ) AS in_use
    """

    GET_JOB_RECEIVE_CONDITIONS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM job_receive_condition
        ORDER BY (display_order = 0), display_order, name
    """

    # ── Job Receive Manners ───────────────────────────────────────────────────

    CHECK_JOB_RECEIVE_MANNER_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('WALKIN'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_RECEIVE_MANNER_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('WALKIN'::text)), -- Test line
        --     "p_id"   as (values(1::smallint))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_RECEIVE_MANNER_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE job_receive_manner_id = (table "p_id")
        ) AS in_use
    """

    GET_JOB_RECEIVE_MANNERS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, display_order, is_active, is_system
        FROM job_receive_manner ORDER BY (display_order = 0), display_order, code
    """

    # ── Job Statuses ──────────────────────────────────────────────────────────

    GET_JOB_STATUSES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM job_status
        ORDER BY display_order NULLS LAST, name
    """

    # ── Job Types ─────────────────────────────────────────────────────────────

    CHECK_JOB_TYPE_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('REPAIR'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_type
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_TYPE_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('REPAIR'::text)), -- Test line
        --     "p_id"   as (values(1::smallint))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_type
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_TYPE_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE job_type_id = (table "p_id")
        ) AS in_use
    """

    GET_JOB_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM job_type
        ORDER BY (display_order = 0), display_order, code;
    """

    # ── Technicians ───────────────────────────────────────────────────────────

    CHECK_TECHNICIAN_CODE_EXISTS = """
        with
            "p_code"      as (values(%(code)s::text)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with
        --     "p_code"      as (values('TECH01'::text)),  -- Test line
        --     "p_branch_id" as (values(1::bigint))        -- Test line
        SELECT EXISTS(
            SELECT 1 FROM technician
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND branch_id   = (table "p_branch_id")
        ) AS exists
    """

    CHECK_TECHNICIAN_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code"      as (values(%(code)s::text)),
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_id"        as (values(%(id)s::bigint))
        -- with
        --     "p_code"      as (values('TECH01'::text)), -- Test line
        --     "p_branch_id" as (values(1::bigint)),      -- Test line
        --     "p_id"        as (values(1::bigint))       -- Test line
        SELECT EXISTS(
            SELECT 1 FROM technician
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND branch_id   = (table "p_branch_id")
              AND id         <> (table "p_id")
        ) AS exists
    """

    CHECK_TECHNICIAN_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job              WHERE technician_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM job_transaction  WHERE technician_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_TECHNICIANS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            t.id, t.branch_id, t.code, t.name, t.phone, t.email,
            t.specialization, t.leaving_date, t.is_active,
            b.name AS branch_name
        FROM technician t
        JOIN branch b ON b.id = t.branch_id
        ORDER BY t.name
    """

    # ── Job Pipeline ──────────────────────────────────────────────────────────

    # NOTE: "Completed OK" (job_status.id = 11) is split into two synthetic
    # pipeline stages by the job.is_final flag: 1001 = "Completed OK"
    # (is_final = false), 1002 = "Completed OK Final" (is_final = true).
    # These ids only ever exist in this query and GET_JOB_PIPELINE_COUNT /
    # GET_JOB_PIPELINE_PAGED below — they are never written to the DB.
    GET_JOB_PIPELINE_STATUS_COUNTS = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT status_id, status_name, status_code, count, warranty_count, oow_count
        FROM (
            SELECT
                js.id   AS status_id,
                js.name AS status_name,
                js.code AS status_code,
                COUNT(j.id) AS count,
                COUNT(j.id) FILTER (WHERE j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
                COUNT(j.id) FILTER (WHERE j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
                js.display_order AS sort_order
            FROM job_status js
            LEFT JOIN job j
                ON j.job_status_id = js.id
               AND j.branch_id = (table "p_branch_id")
            WHERE js.code <> 'COMPLETED_OK'
            GROUP BY js.id, js.name, js.code, js.display_order

            UNION ALL

            SELECT
                1001                AS status_id,
                'Completed OK'      AS status_name,
                'COMPLETED_OK'      AS status_code,
                COUNT(j.id) FILTER (WHERE NOT j.is_final)                                                                                          AS count,
                COUNT(j.id) FILTER (WHERE NOT j.is_final AND j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
                COUNT(j.id) FILTER (WHERE NOT j.is_final AND j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
                js.display_order AS sort_order
            FROM job_status js
            LEFT JOIN job j
                ON j.job_status_id = js.id
               AND j.branch_id = (table "p_branch_id")
            WHERE js.code = 'COMPLETED_OK'
            GROUP BY js.display_order

            UNION ALL

            SELECT
                1002                    AS status_id,
                'Completed OK Final'    AS status_name,
                'COMPLETED_OK_FINAL'    AS status_code,
                COUNT(j.id) FILTER (WHERE j.is_final)                                                                                          AS count,
                COUNT(j.id) FILTER (WHERE j.is_final AND j.job_type_id = (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY'))              AS warranty_count,
                COUNT(j.id) FILTER (WHERE j.is_final AND j.job_type_id IS DISTINCT FROM (SELECT id FROM job_type WHERE code = 'UNDER_WARRANTY')) AS oow_count,
                js.display_order AS sort_order
            FROM job_status js
            LEFT JOIN job j
                ON j.job_status_id = js.id
               AND j.branch_id = (table "p_branch_id")
            WHERE js.code = 'COMPLETED_OK'
            GROUP BY js.display_order
        ) x
        ORDER BY sort_order NULLS LAST, status_id
    """

    GET_JOB_PIPELINE_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_status_id" as (values(%(status_id)s::smallint)),
            "p_job_status_id" as (
                values( (CASE WHEN %(status_id)s::smallint IN (1001, 1002) THEN 11 ELSE %(status_id)s::smallint END)::smallint )
            ),
            "p_is_final_filter" as (
                values( (CASE WHEN %(status_id)s::smallint = 1001 THEN false
                              WHEN %(status_id)s::smallint = 1002 THEN true
                              ELSE NULL END)::boolean )
            ),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand      b ON b.id  = pbm.brand_id
        LEFT JOIN product    p ON p.id  = pbm.product_id
        LEFT JOIN technician t ON t.id  = j.technician_id
        WHERE j.branch_id     = (table "p_branch_id")
          AND j.job_status_id = (table "p_job_status_id")
          AND ((table "p_is_final_filter") IS NULL OR j.is_final = (table "p_is_final_filter"))
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_PIPELINE_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_status_id" as (values(%(status_id)s::smallint)),
            "p_job_status_id" as (
                values( (CASE WHEN %(status_id)s::smallint IN (1001, 1002) THEN 11 ELSE %(status_id)s::smallint END)::smallint )
            ),
            "p_is_final_filter" as (
                values( (CASE WHEN %(status_id)s::smallint = 1001 THEN false
                              WHEN %(status_id)s::smallint = 1002 THEN true
                              ELSE NULL END)::boolean )
            ),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.is_opening_job,
            j.job_date,
            j.purchase_date,
            j.job_status_id,
            j.is_closed,
            j.is_final,
            j.amount,
            j.estimate_amount,
            j.diagnosis,
            j.last_transaction_id,
            j.batch_no,
            cc.full_name   AS customer_name,
            cc.gstin       AS customer_gstin,
            cc.mobile,
            jt.name        AS job_type_name,
            jt.code        AS job_type_code,
            js.name        AS job_status_name,
            js.code        AS job_status_code,
            j.technician_id,
            t.name         AS technician_name,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id)  AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id)  AS transaction_count,
            jrm.name       AS job_receive_manner_name,
            jrc.name       AS job_receive_condition_name,
            j.division_id,
            ji.is_posted   AS invoice_is_posted
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        LEFT JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        WHERE j.branch_id     = (table "p_branch_id")
          AND j.job_status_id = (table "p_job_status_id")
          AND ((table "p_is_final_filter") IS NULL OR j.is_final = (table "p_is_final_filter"))
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PIPELINE_ALL_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand      b ON b.id  = pbm.brand_id
        LEFT JOIN product    p ON p.id  = pbm.product_id
        LEFT JOIN technician t ON t.id  = j.technician_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_PIPELINE_ALL_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.is_opening_job,
            j.job_date,
            j.purchase_date,
            j.job_status_id,
            j.is_closed,
            j.is_final,
            j.amount,
            j.estimate_amount,
            j.diagnosis,
            j.last_transaction_id,
            j.batch_no,
            cc.full_name   AS customer_name,
            cc.gstin       AS customer_gstin,
            cc.mobile,
            jt.name        AS job_type_name,
            jt.code        AS job_type_code,
            js.name        AS job_status_name,
            js.code        AS job_status_code,
            j.technician_id,
            t.name         AS technician_name,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id)  AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id)  AS transaction_count,
            jrm.name       AS job_receive_manner_name,
            jrc.name       AS job_receive_condition_name,
            j.division_id,
            ji.is_posted   AS invoice_is_posted
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        LEFT JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_TRANSACTION_FOR_UNDO = """
        SELECT t.id, t.previous_transaction_id
        FROM   job_transaction t
        JOIN   job j ON j.id = t.job_id
        WHERE  t.job_id = %(job_id)s
          AND  t.id     = %(last_txn_id)s
          AND  j.last_transaction_id = %(last_txn_id)s
    """

    GET_PREV_JOB_TRANSACTION_FALLBACK = """
        SELECT id FROM job_transaction
        WHERE  job_id = %(job_id)s AND id < %(last_txn_id)s
        ORDER  BY id DESC
        LIMIT  1
    """

    GET_JOB_TRANSACTION_STATE = """
        SELECT status_id, technician_id, amount
        FROM   job_transaction
        WHERE  id = %(prev_txn_id)s
    """

    DELETE_JOB_TRANSACTION = """
        DELETE FROM job_transaction WHERE id = %(last_txn_id)s
    """

    RESTORE_JOB_FROM_TRANSACTION = """
        UPDATE job
        SET    job_status_id       = %(job_status_id)s,
               technician_id       = %(technician_id)s,
               amount              = COALESCE(%(amount)s, amount, 0),
               estimate_amount     = COALESCE(%(estimate_amount)s, estimate_amount, 0),
               is_final            = %(is_final)s,
               is_closed           = %(is_closed)s,
               last_transaction_id = %(last_transaction_id)s
        WHERE  id = %(job_id)s
    """

    # ── Undeliver Job ─────────────────────────────────────────────────────────
    # Most recent transaction whose status is NOT a delivered status — i.e. the
    # state the job was in just before it was delivered.
    GET_LAST_NON_DELIVERED_TRANSACTION = """
        SELECT t.id, t.status_id, t.technician_id
        FROM   job_transaction t
        JOIN   job_status js ON js.id = t.status_id
        WHERE  t.job_id = %(job_id)s
          AND  js.code NOT IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
        ORDER  BY t.id DESC
        LIMIT  1
    """

    # Remove every delivery transaction on the job (handles re-deliveries too).
    DELETE_DELIVERY_TRANSACTIONS = """
        DELETE FROM job_transaction t
        USING  job_status js
        WHERE  t.status_id = js.id
          AND  t.job_id = %(job_id)s
          AND  js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
    """

    UNDELIVER_JOB = """
        UPDATE job
        SET    job_status_id       = %(job_status_id)s,
               technician_id       = %(technician_id)s,
               is_final            = %(is_final)s,
               is_closed           = false,
               delivery_date       = NULL,
               last_transaction_id = %(last_transaction_id)s
        WHERE  id = %(job_id)s
    """

    GET_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_opening_job IS NOT TRUE
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)      LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.purchase_date,
            j.is_closed,
            j.is_final,
            j.amount,
            cc.full_name  AS customer_name,
            cc.gstin      AS customer_gstin,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            js.name       AS job_status_name,
            js.code       AS job_status_code,
            jrc.name      AS receive_condition_name,
            t.name        AS technician_name,
            j.batch_no    AS batch_no,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_opening_job IS NOT TRUE
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)      LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_OPENING_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_opening_job = true
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)      LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_OPENING_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.purchase_date,
            j.is_closed,
            j.is_final,
            j.amount,
            cc.full_name  AS customer_name,
            cc.gstin      AS customer_gstin,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            js.name       AS job_status_name,
            js.code       AS job_status_code,
            jrc.name      AS receive_condition_name,
            t.name        AS technician_name,
            j.batch_no    AS batch_no,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_opening_job = true
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)      LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_SEARCH_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_search"      as (values(%(search)s::text)),
            "p_show_closed" as (values(%(show_closed)s::boolean)),
            "p_status_id"   as (values(%(status_id)s::bigint))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_show_closed") IS NULL
               OR (CASE WHEN js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK', 'DISPOSED')
                        THEN true ELSE j.is_closed END) = (table "p_show_closed"))
          AND ((table "p_status_id")   IS NULL OR j.job_status_id = (table "p_status_id"))
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
     """

    GET_JOB_SEARCH_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_search"      as (values(%(search)s::text)),
            "p_show_closed" as (values(%(show_closed)s::boolean)),
            "p_status_id"   as (values(%(status_id)s::bigint)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.is_opening_job,
            j.job_date,
            j.purchase_date,
            j.delivery_date,
            j.is_closed,
            j.is_final,
            j.amount,
            j.estimate_amount,
            j.batch_no,
            j.last_transaction_id,
            j.technician_id,
            j.job_status_id,
            js.code      AS job_status_code,
            jt.code      AS job_type_code,
            cc.full_name AS customer_name,
            cc.gstin     AS customer_gstin,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name      AS job_type_name,
            js.name      AS job_status_name,
            t.name       AS technician_name,
            j.division_id,
            ji.is_posted AS invoice_is_posted,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction  jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN job_invoice  ji ON ji.job_id = j.id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_show_closed") IS NULL
               OR (CASE WHEN js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK', 'DISPOSED')
                        THEN true ELSE j.is_closed END) = (table "p_show_closed"))
          AND ((table "p_status_id")   IS NULL OR j.job_status_id = (table "p_status_id"))
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
         ORDER BY CASE WHEN (table "p_show_closed") IS TRUE THEN j.delivery_date ELSE j.job_date END DESC,
                  j.id DESC
         LIMIT  (table "p_limit")
         OFFSET (table "p_offset")
     """

    GET_JOB_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            j.*,
            cc.full_name     AS customer_name,
            cc.mobile,
            cc.gstin         AS customer_gstin,
            cc.address_line1 AS customer_address_line1,
            cc.address_line2 AS customer_address_line2,
            cc.landmark      AS customer_landmark,
            cc.city          AS customer_city,
            cc.postal_code   AS customer_postal_code,
            s.name           AS customer_state,
            CONCAT_WS(', ', NULLIF(cc.address_line1, ''), NULLIF(cc.address_line2, ''), NULLIF(cc.city, ''), NULLIF(cc.postal_code, '')) AS address_snapshot,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            js.name       AS job_status_name,
            jrm.name      AS job_receive_manner_name,
            jrc.name      AS job_receive_condition_name,
            t.name        AS technician_name,
            pbm.model_name,
            bn.name        AS brand_name,
            p.name        AS product_name,
            (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN state            s   ON s.id   = cc.state_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            bn  ON bn.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.id = (table "p_id")
    """

    # Batch Warranty Transactions — Job Control: warranty jobs for one customer,
    # not closed, with zero parts used (the only jobs this batch flow can act on).
    GET_WARRANTY_JOBS_BY_CUSTOMER = """
        with
            "p_customer_contact_id" as (values(%(customer_contact_id)s::bigint)),
            "p_branch_id"           as (values(%(branch_id)s::bigint))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.job_status_id,
            js.code      AS job_status_code,
            js.name      AS job_status_name,
            j.job_type_id,
            jt.code      AS job_type_code,
            jt.name      AS job_type_name,
            j.technician_id,
            t.name       AS technician_name,
            j.division_id,
            j.amount,
            j.estimate_amount,
            j.last_transaction_id,
            j.is_final,
            j.is_closed,
            j.customer_contact_id,
            cc.full_name      AS customer_name,
            cc.gstin          AS customer_gstin,
            cc.mobile,
            cc.address_line1  AS customer_address_line1,
            cc.address_line2  AS customer_address_line2,
            cc.landmark       AS customer_landmark,
            cc.city           AS customer_city,
            cc.postal_code    AS customer_postal_code,
            s.name            AS customer_state,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)) AS device_details,
            j.serial_no,
            (SELECT COUNT(*) FROM job_part_used jpu WHERE jpu.job_id = j.id) AS parts_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN state        s  ON s.id  = cc.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.customer_contact_id = (table "p_customer_contact_id")
          AND j.branch_id = (table "p_branch_id")
          AND jt.code = 'UNDER_WARRANTY'
          AND j.is_closed = false
          AND js.code NOT IN ('DELIVERED_OK', 'DELIVERED_NOT_OK', 'DISPOSED')
          AND (SELECT COUNT(*) FROM job_part_used jpu2 WHERE jpu2.job_id = j.id) = 0
        ORDER BY j.job_date DESC, j.id DESC
    """

    GET_WARRANTY_CUSTOMERS_BY_BRANCH = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            cc.id        AS id,
            cc.full_name AS full_name,
            cc.mobile    AS mobile,
            COUNT(*)     AS job_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type         jt ON jt.id = j.job_type_id
        JOIN job_status       js ON js.id = j.job_status_id
        WHERE j.branch_id = (table "p_branch_id")
          AND jt.code = 'UNDER_WARRANTY'
          AND j.is_closed = false
          AND js.code NOT IN ('DELIVERED_OK', 'DELIVERED_NOT_OK', 'DISPOSED')
          AND (SELECT COUNT(*) FROM job_part_used jpu WHERE jpu.job_id = j.id) = 0
        GROUP BY cc.id, cc.full_name, cc.mobile
        ORDER BY full_name
    """

    GET_DELIVERED_WARRANTY_JOBS_BY_CUSTOMER = """
        with
            "p_customer_contact_id" as (values(%(customer_contact_id)s::bigint)),
            "p_branch_id"           as (values(%(branch_id)s::bigint)),
            "p_delivery_date"       as (values(%(delivery_date)s::date))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.delivery_date,
            j.division_id,
            j.amount,
            j.job_status_id,
            js.code      AS job_status_code,
            js.name      AS job_status_name,
            j.technician_id,
            t.name       AS technician_name,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)) AS device_details,
            j.serial_no
        FROM job j
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.customer_contact_id = (table "p_customer_contact_id")
          AND j.branch_id = (table "p_branch_id")
          AND jt.code = 'UNDER_WARRANTY'
          AND j.is_closed = true
          AND js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
          AND j.delivery_date = (table "p_delivery_date")
        ORDER BY j.job_no
    """

    GET_DELIVERED_WARRANTY_JOB_GROUPS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total FROM (
            SELECT j.customer_contact_id, j.delivery_date
            FROM job j
            JOIN customer_contact cc ON cc.id = j.customer_contact_id
            JOIN job_type         jt ON jt.id = j.job_type_id
            JOIN job_status       js ON js.id = j.job_status_id
            LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
            LEFT JOIN brand            b   ON b.id   = pbm.brand_id
            LEFT JOIN product          p   ON p.id   = pbm.product_id
            WHERE j.branch_id = (table "p_branch_id")
              AND jt.code = 'UNDER_WARRANTY'
              AND j.is_closed = true
              AND js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
              AND j.delivery_date IS NOT NULL
            GROUP BY j.customer_contact_id, j.delivery_date, cc.full_name, cc.mobile
            HAVING (table "p_search") = ''
               OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR bool_or(LOWER(j.job_no::text) LIKE '%%' || LOWER((table "p_search")) || '%%')
               OR bool_or(LOWER(COALESCE(TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)), '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ) grp
    """

    GET_DELIVERED_WARRANTY_JOB_GROUPS_BY_BRANCH = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.customer_contact_id,
            cc.full_name      AS customer_name,
            cc.mobile,
            cc.address_line1  AS customer_address_line1,
            cc.address_line2  AS customer_address_line2,
            cc.landmark       AS customer_landmark,
            cc.city           AS customer_city,
            cc.postal_code    AS customer_postal_code,
            s.name            AS customer_state,
            j.delivery_date,
            COUNT(*)       AS job_count,
            STRING_AGG(DISTINCT j.job_no::text, ', ') AS job_nos,
            STRING_AGG(DISTINCT NULLIF(TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)), ''), ', ') AS device_summary
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type         jt ON jt.id = j.job_type_id
        JOIN job_status       js ON js.id = j.job_status_id
        LEFT JOIN state       s  ON s.id  = cc.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND jt.code = 'UNDER_WARRANTY'
          AND j.is_closed = true
          AND js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
          AND j.delivery_date IS NOT NULL
        GROUP BY j.customer_contact_id, cc.full_name, cc.mobile,
                 cc.address_line1, cc.address_line2, cc.landmark, cc.city, cc.postal_code, s.name,
                 j.delivery_date
        HAVING (table "p_search") = ''
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR bool_or(LOWER(j.job_no::text) LIKE '%%' || LOWER((table "p_search")) || '%%')
           OR bool_or(LOWER(COALESCE(TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)), '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.delivery_date DESC, cc.full_name
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_IMAGE_DOCS = """
        SELECT id, url, about, created_at
        FROM job_image_doc
        WHERE job_id = %(job_id)s
        ORDER BY created_at
    """

    DELETE_JOB_IMAGE_DOC = """
        DELETE FROM job_image_doc
        WHERE id = %(id)s
        RETURNING url
    """

    GET_JOB_IMAGE_DOCS_BY_JOB = """
        SELECT jid.id, jid.url, j.job_no
        FROM job_image_doc jid
        JOIN job j ON j.id = jid.job_id
        WHERE jid.job_id = %(job_id)s
        LIMIT 1
    """

    COUNT_JOB_IMAGE_DOCS_BY_JOB = """
        SELECT COUNT(*) AS count
        FROM job_image_doc
        WHERE job_id = %(job_id)s
    """

    DELETE_JOB_IMAGE_DOCS_BY_JOB = """
        DELETE FROM job_image_doc
        WHERE job_id = %(job_id)s
        RETURNING id, url
    """

    GET_JOB_BATCHES_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            j.batch_no,
            MIN(j.job_date)                                         AS batch_date,
            cc.full_name                                            AS customer_name,
            cc.mobile,
            STRING_AGG(DISTINCT jt.name, ', ' ORDER BY jt.name)    AS job_type_name,
            COUNT(j.id)                                             AS job_count
        FROM job j
        JOIN customer_contact  cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        WHERE j.batch_no IS NOT NULL
          AND j.branch_id = (table "p_branch_id")
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
        GROUP BY j.batch_no, cc.full_name, cc.mobile
        ORDER BY j.batch_no DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_BATCHES_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(DISTINCT j.batch_no) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.batch_no IS NOT NULL
          AND j.branch_id = (table "p_branch_id")
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_BATCHES_WITH_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int)),
            "paged_batches" as (
                SELECT DISTINCT j.batch_no
                FROM job j
                WHERE j.batch_no IS NOT NULL
                  AND j.branch_id = (table "p_branch_id")
                  AND ((table "p_search") = ''
                   OR  LOWER((SELECT cc.full_name FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
                   OR  LOWER((SELECT cc.mobile FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
                   OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
                   OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
                ORDER BY j.batch_no DESC
                LIMIT  (table "p_limit")
                OFFSET (table "p_offset")
            )
        SELECT
            j.batch_no,
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.purchase_date,
            j.is_closed,
            j.amount,
            j.serial_no,
            cc.full_name                                    AS customer_name,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name                                         AS job_type_name,
            jt.code                                         AS job_type_code,
            js.name                                         AS job_status_name,
            js.code                                         AS job_status_code,
            js.id                                           AS job_status_id,
            t.name                                          AS technician_name,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN paged_batches           pb  ON pb.batch_no = j.batch_no
        JOIN customer_contact        cc  ON cc.id       = j.customer_contact_id
        JOIN job_type                jt  ON jt.id       = j.job_type_id
        LEFT JOIN job_status         js  ON js.id       = j.job_status_id
        LEFT JOIN technician         t   ON t.id        = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id     = j.product_brand_model_id
        LEFT JOIN brand              b   ON b.id        = pbm.brand_id
        LEFT JOIN product            p   ON p.id        = pbm.product_id
        ORDER BY j.batch_no DESC, j.id DESC
    """

    GET_JOB_BATCHES_WITH_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(DISTINCT j.batch_no) AS total
        FROM job j
        WHERE j.batch_no IS NOT NULL
          AND j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  LOWER((SELECT cc.full_name FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER((SELECT cc.mobile FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_BATCH_DETAIL = """
        with "p_batch_no" as (values(%(batch_no)s::integer))
        SELECT
            j.*,
            cc.full_name  AS customer_name,
            cc.mobile,
            cc.gstin         AS customer_gstin,
            cc.address_line1 AS customer_address_line1,
            cc.address_line2 AS customer_address_line2,
            cc.landmark      AS customer_landmark,
            cc.city          AS customer_city,
            cc.postal_code   AS customer_postal_code,
            s.name           AS customer_state,
            CONCAT_WS(', ', NULLIF(cc.address_line1, ''), NULLIF(cc.address_line2, ''), NULLIF(cc.city, ''), NULLIF(cc.postal_code, '')) AS address_snapshot,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            js.name       AS job_status_name,
            js.code       AS job_status_code,
            jrm.name      AS job_receive_manner_name,
            jrc.name      AS job_receive_condition_name,
            pbm.model_name,
            b.name        AS brand_name,
            p.name        AS product_name,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count,
            (SELECT COUNT(*) FROM job_image_doc  jd  WHERE jd.job_id  = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN state            s   ON s.id   = cc.state_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.batch_no = (table "p_batch_no")
        ORDER BY j.id
    """

    GET_JOB_BATCH_QUICK_INFO = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_offset"    as (values(%(offset)s::int)),
            "target_batch" as (
                SELECT DISTINCT j.batch_no
                FROM job j
                WHERE j.batch_no IS NOT NULL
                  AND j.branch_id = (table "p_branch_id")
                ORDER BY j.batch_no DESC
                LIMIT 1 OFFSET (table "p_offset")
            )
        SELECT
            j.batch_no,
            MIN(j.job_date) OVER (PARTITION BY j.batch_no) AS batch_date,
            cc.full_name                                    AS customer_name,
            cc.mobile,
            jt.name                                         AS job_type_name,
            j.id                                            AS job_id,
            j.job_no,
            CASE WHEN pbm.id IS NOT NULL
                 THEN CONCAT(b.name, ' — ', p.name, ' — ', pbm.model_name)
                 ELSE NULL END                              AS device_details,
            j.serial_no,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.batch_no = (SELECT batch_no FROM target_batch)
        ORDER BY j.id
    """

    GET_JOB_BATCH_QUICK_INFO_COUNT = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT COUNT(DISTINCT batch_no) AS total
        FROM job
        WHERE batch_no IS NOT NULL
          AND branch_id = (table "p_branch_id")
    """

    # ── Part Used (Job) ───────────────────────────────────────────────────────

    GET_JOBS_BY_KEYWORD = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int))
        SELECT j.id, j.job_no, j.job_date, j.branch_id, j.is_closed, j.is_final,
               js.code AS job_status_code, js.name AS job_status_name,
               cc.full_name AS customer_name, cc.mobile
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT (table "p_limit")
    """

    GET_JOB_PART_USED_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT jpu.id, jpu.part_id, jpu.qty, jpu.cost_price, jpu.selling_price, jpu.gst_rate, jpu.remarks,
               sp.part_code, sp.part_name, sp.uom, sp.brand_id,
               COALESCE(jpu.hsn_code, sp.hsn_code) AS hsn_code,
               sp.cost_price    AS master_cost_price,
               sp.selling_price AS master_selling_price,
               sp.gst_rate      AS master_gst_rate
        FROM job_part_used jpu
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        WHERE jpu.job_id = (table "p_job_id")
        ORDER BY jpu.id
    """

    GET_JOB_ADDITIONAL_CHARGES_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT id, charge_name, ref_no, description, hsn_code, gst_rate, qty, cost_price, selling_price
        FROM job_additional_charge
        WHERE job_id = (table "p_job_id")
        ORDER BY id
    """

    # ── Job Receipts (Payments) ───────────────────────────────────────────────

    GET_JOB_PAYMENTS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS count
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND jp.payment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.reference_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT jp.id, jp.job_id, jp.receipt_no, j.job_no, j.alternate_job_no, j.is_opening_job, j.job_date, cc.full_name AS customer_name, cc.gstin AS customer_gstin, cc.mobile,
               jp.payment_date, jp.payment_mode, jp.amount, jp.reference_no, jp.remarks,
               jp.is_posted, jp.created_at, jp.updated_at,
               j.is_closed, j.is_final, j.batch_no, j.division_id, js.code AS job_status_code, js.name AS job_status_name,
               jt.name AS job_type_name, jt.code AS job_type_code,
               TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
               ji.is_posted AS invoice_is_posted,
               (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN job_status js ON js.id = j.job_status_id
        JOIN job_type   jt ON jt.id = j.job_type_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand   b  ON b.id  = pbm.brand_id
        LEFT JOIN product p  ON p.id  = pbm.product_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        WHERE j.branch_id = (table "p_branch_id")
          AND jp.payment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.reference_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jp.payment_date DESC, jp.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    # ── Final a Job ────────────────────────────────────────────────────

    GET_COMPLETED_JOBS_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_search"      as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact     cc  ON cc.id  = j.customer_contact_id
        JOIN job_status           js  ON js.id  = j.job_status_id
        LEFT JOIN technician      t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand           b   ON b.id   = pbm.brand_id
        LEFT JOIN product         p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          --AND ((table "p_division_id") IS NULL OR j.division_id = (table "p_division_id"))
          AND js.code = 'COMPLETED_OK'
          AND j.is_final = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.email, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.city, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))       LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_COMPLETED_JOBS_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_search"      as (values(%(search)s::text)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.is_opening_job,
            j.job_date,
            j.purchase_date,
            j.amount,
            j.batch_no,
            j.serial_no,
            j.is_closed,
            j.is_final,
            j.division_id,
            cc.full_name  AS customer_name,
            cc.gstin      AS customer_gstin,
            cc.mobile,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            t.name        AS technician_name,
            TRIM(CONCAT_WS(' / ', NULLIF(p.name, ''), NULLIF(b.name, ''), NULLIF(pbm.model_name, ''))) AS device_details,
            (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact     cc  ON cc.id  = j.customer_contact_id
        JOIN job_type             jt  ON jt.id  = j.job_type_id
        JOIN job_status           js  ON js.id  = j.job_status_id
        LEFT JOIN technician      t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand           b   ON b.id   = pbm.brand_id
        LEFT JOIN product         p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          --AND ((table "p_division_id") IS NULL OR j.division_id = (table "p_division_id"))
          AND js.code = 'COMPLETED_OK'
          AND j.is_final = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.email, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.city, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))       LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_INVOICE_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT ji.id, ji.job_id, ji.invoice_no, ji.invoice_date,
               ji.supply_state_code, ji.aggregate, ji.cgst_amount, ji.sgst_amount,
               ji.igst_amount, ji.amount,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'id',          jil.id,
                           'job_invoice_id', jil.job_invoice_id,
                           'description', jil.description,
                           'part_code',   jil.part_code,
                           'hsn_code',    jil.hsn_code,
                           'qty',    jil.qty,
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
        LEFT JOIN job_invoice_line jil ON jil.job_invoice_id = ji.id
        WHERE ji.job_id = (table "p_job_id")
        GROUP BY ji.id
    """

    GET_JOB_INVOICES_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ji.is_posted = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text         ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)     LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_INVOICES_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            ji.id,
            ji.job_id,
            j.job_no,
            j.job_date,
            cc.full_name  AS customer_name,
            cc.mobile,
            ji.invoice_no,
            ji.invoice_date,
            ji.aggregate,
            ji.cgst_amount,
            ji.sgst_amount,
            ji.igst_amount,
            ji.amount,
            ji.is_posted
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ji.is_posted = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text         ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)     LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY ji.invoice_date DESC, ji.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PARTS_FOR_INVOICE = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT jpu.qty, sp.part_code, sp.part_name, sp.uom
        FROM job_part_used jpu
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        WHERE jpu.job_id = (table "p_job_id")
        ORDER BY jpu.id
    """

    # ── Deliver Job ───────────────────────────────────────────────────────────

    GET_DELIVERABLE_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_DELIVERABLE_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT j.id, j.job_no, j.alternate_job_no, j.is_opening_job, j.job_date, j.purchase_date, j.amount, j.last_transaction_id,
               j.division_id, j.batch_no, j.serial_no,
               TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
               cc.full_name  AS customer_name, cc.gstin AS customer_gstin, cc.mobile,
               js.name       AS job_status_name,
               js.code       AS job_status_code,
               t.name        AS technician_name,
               ji.id         AS invoice_id,
               ji.amount     AS invoice_total,
               ji.invoice_no,
               ji.is_posted  AS invoice_is_posted,
               jrm.name       AS receive_manner_name,
               jt.name        AS job_type_name,
               jt.code        AS job_type_code,
               COALESCE(jrc.name, '') AS receive_condition_name,
               j.qty,
               j.estimate_amount,
               COALESCE(
                   (SELECT SUM(jp2.amount) FROM job_payment jp2 WHERE jp2.job_id = j.id),
                   0
               )              AS total_paid,
               (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.updated_at DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_DELIVERED_JOBS_COUNT = """
        with
            "p_branch_id"      as (values(%(branch_id)s::bigint)),
            "p_search"         as (values(%(search)s::text)),
            "p_delivery_date"  as (values(%(delivery_date)s::date))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = true
          AND ((table "p_delivery_date") IS NULL OR j.delivery_date = (table "p_delivery_date"))
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_DELIVERED_JOBS_PAGED = """
        with
            "p_branch_id"      as (values(%(branch_id)s::bigint)),
            "p_search"         as (values(%(search)s::text)),
            "p_delivery_date"  as (values(%(delivery_date)s::date)),
            "p_limit"          as (values(%(limit)s::int)),
            "p_offset"         as (values(%(offset)s::int))
        SELECT j.id, j.job_no, j.alternate_job_no, j.is_opening_job, j.job_date, j.purchase_date, j.delivery_date,
               j.amount, j.last_transaction_id,
               j.division_id, j.batch_no, j.serial_no,
               j.customer_contact_id,
               TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)) AS device_details,
               cc.full_name      AS customer_name, cc.gstin AS customer_gstin, cc.mobile,
               cc.address_line1  AS customer_address_line1,
               cc.address_line2  AS customer_address_line2,
               cc.landmark       AS customer_landmark,
               cc.city           AS customer_city,
               cc.postal_code    AS customer_postal_code,
               s.name            AS customer_state,
               js.name       AS job_status_name,
               js.code       AS job_status_code,
               jt.name       AS job_type_name,
               jt.code       AS job_type_code,
               jrm.name      AS receive_manner_name,
               t.name        AS technician_name,
               ji.amount     AS invoice_total,
               ji.invoice_no,
               ji.is_posted  AS invoice_is_posted,
               (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        LEFT JOIN state            s   ON s.id   = cc.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = true
          AND ((table "p_delivery_date") IS NULL OR j.delivery_date = (table "p_delivery_date"))
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.delivery_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_DELIVERY_DETAIL = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT
            j.id, j.job_no, j.alternate_job_no, j.job_date, j.problem_reported, j.diagnosis, j.work_done,
            j.amount, j.delivery_date, j.is_closed, j.last_transaction_id,
            cc.full_name AS customer_name, cc.mobile,
            js.name      AS job_status_name,
            t.name       AS technician_name,
            ji.id        AS invoice_id,
            ji.invoice_no,
            ji.invoice_date,
            ji.amount AS invoice_total,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',           jp.id,
                        'payment_date', jp.payment_date,
                        'payment_mode', jp.payment_mode,
                        'amount',       jp.amount,
                        'reference_no', jp.reference_no,
                        'remarks',      jp.remarks
                    ) ORDER BY jp.created_at
                ) FILTER (WHERE jp.id IS NOT NULL),
                '[]'::json
            ) AS payments
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN job_invoice  ji ON ji.job_id = j.id
        LEFT JOIN job_payment  jp ON jp.job_id = j.id
        WHERE j.id = (table "p_job_id")
        GROUP BY j.id, cc.full_name, cc.mobile, js.name, t.name,
                 ji.id, ji.invoice_no, ji.invoice_date, ji.amount
    """

    GET_DELIVERABLE_JOBS_DETAIL_MULTI = """
        with "p_job_ids" as (
            SELECT unnest(%(job_ids)s::bigint[]) AS job_id
        )
        SELECT
            j.id, j.job_no, j.alternate_job_no, j.job_date, j.amount,
            j.estimate_amount, j.qty, j.last_transaction_id,
            j.division_id, j.serial_no, j.is_igst, j.to_show_parts_in_job_invoice,
            j.customer_contact_id,
            j.delivery_date, j.remarks,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            cc.full_name      AS customer_name, cc.mobile,
            cc.gstin          AS customer_gstin,
            cc.email          AS customer_email,
            cc.address_line1  AS customer_address_line1,
            cc.address_line2  AS customer_address_line2,
            cc.landmark       AS customer_landmark,
            cc.city           AS customer_city,
            cc.postal_code    AS customer_postal_code,
            s.name            AS customer_state,
            js.name       AS job_status_name,
            js.code       AS job_status_code,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            jrm.name      AS receive_manner_name,
            COALESCE(jrc.name, '') AS receive_condition_name,
            t.name        AS technician_name,
            ji.id         AS invoice_id,
            ji.invoice_no, ji.invoice_date,
            ji.amount     AS invoice_total,
            ji.is_posted  AS invoice_is_posted,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', jp.id, 'receipt_no', jp.receipt_no,
                    'payment_date', jp.payment_date,
                    'payment_mode', jp.payment_mode, 'amount', jp.amount,
                    'reference_no', jp.reference_no, 'remarks', jp.remarks
                ) ORDER BY jp.created_at)
                FROM job_payment jp WHERE jp.job_id = j.id
            ), '[]'::json) AS payments,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', jpu.id, 'part_code', sp.part_code, 'part_name', sp.part_name,
                    'qty', jpu.qty, 'cost_price', jpu.cost_price,
                    'selling_price', jpu.selling_price, 'gst_rate', jpu.gst_rate,
                    'hsn_code', COALESCE(jpu.hsn_code, sp.hsn_code), 'remarks', jpu.remarks
                ) ORDER BY jpu.id)
                FROM job_part_used jpu
                JOIN spare_part_master sp ON sp.id = jpu.part_id
                WHERE jpu.job_id = j.id
            ), '[]'::json) AS parts,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', jac.id, 'charge_name', jac.charge_name, 'qty', jac.qty,
                    'selling_price', jac.selling_price, 'gst_rate', jac.gst_rate,
                    'hsn_code', jac.hsn_code, 'description', jac.description
                ) ORDER BY jac.id)
                FROM job_additional_charge jac WHERE jac.job_id = j.id
            ), '[]'::json) AS charges
        FROM job j
        JOIN "p_job_ids" pj  ON pj.job_id = j.id
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id  = j.technician_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        LEFT JOIN state            s   ON s.id  = cc.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id  = pbm.brand_id
        LEFT JOIN product          p   ON p.id  = pbm.product_id
        GROUP BY j.id, cc.full_name, cc.mobile,
                 cc.gstin, cc.email, cc.address_line1, cc.address_line2,
                 cc.landmark, cc.city, cc.postal_code, s.name,
                 js.name, js.code, jt.name, jt.code,
                 jrm.name, jrc.name, t.name, pbm.model_name, b.name, p.name,
                 ji.id, ji.invoice_no, ji.invoice_date, ji.amount,
                 j.delivery_date, j.remarks
    """

    # ── WhatsApp Notifications (plans/plan-whatsapp.md §4d/§4e) ────────────────

    GET_JOBS_FOR_WHATSAPP_COMPLETION = """
        SELECT
            j.id AS job_id,
            j.job_no,
            j.amount,
            j.customer_contact_id,
            j.whatsapp_notifications,
            c.full_name AS customer_name,
            c.mobile
        FROM job j
        JOIN customer_contact c ON c.id = j.customer_contact_id
        WHERE j.id = ANY(%(job_ids)s)
          AND j.branch_id = %(branch_id)s
          AND j.is_final = true
    """

    GET_JOBS_FOR_WHATSAPP_SEND = """
        SELECT
            j.id AS job_id,
            j.job_no,
            j.amount,
            j.branch_id,
            j.customer_contact_id,
            j.whatsapp_notifications,
            c.full_name AS customer_name,
            c.mobile,
            b.name AS branch_name,
            jp.receipt_no,
            jp.payment_mode
        FROM job j
        JOIN customer_contact c ON c.id = j.customer_contact_id
        JOIN branch b ON b.id = j.branch_id
        LEFT JOIN LATERAL (
            SELECT receipt_no, payment_mode
            FROM job_payment
            WHERE job_payment.job_id = j.id
            ORDER BY created_at DESC
            LIMIT 1
        ) jp ON true
        WHERE j.id = ANY(%(job_ids)s)
    """

    SET_JOB_WHATSAPP_NOTIFICATION = """
        UPDATE job
        SET whatsapp_notifications = jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            %(event_path)s::text[],
            %(event_json)s::jsonb,
            true
        )
        WHERE id = %(job_id)s
    """

    # ── Customer Connect — eligible jobs for the completion message (§5e) ──────
    # Eligibility mirrors sendWhatsappCompletion's own re-filter: is_final=true,
    # is_closed=false, status not cancelled/disposed (plan §1/§2b).

    GET_WHATSAPP_ELIGIBLE_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status       js ON js.id = j.job_status_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND js.code NOT IN ('CANCELLED', 'DISPOSED')
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_WHATSAPP_ELIGIBLE_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.amount,
            j.whatsapp_notifications,
            cc.id        AS customer_contact_id,
            cc.full_name AS customer_name,
            cc.mobile,
            jt.name      AS job_type_name,
            jt.code      AS job_type_code,
            js.name      AS job_status_name,
            js.code      AS job_status_code,
            TRIM(CONCAT_WS(' / ', NULLIF(p.name, ''), NULLIF(b.name, ''), NULLIF(pbm.model_name, ''))) AS device_details
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type         jt ON jt.id = j.job_type_id
        JOIN job_status       js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand       b  ON b.id = pbm.brand_id
        LEFT JOIN product     p  ON p.id = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND js.code NOT IN ('CANCELLED', 'DISPOSED')
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_WHATSAPP_ELIGIBLE_JOB_IDS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT j.id
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status       js ON js.id = j.job_status_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND js.code NOT IN ('CANCELLED', 'DISPOSED')
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
    """
