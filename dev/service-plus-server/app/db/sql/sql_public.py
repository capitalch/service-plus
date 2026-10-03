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

    # ── Job Intake (public, WhatsApp status-link token) ─────────────────────────
    # Not filtered by job status or is_closed — must keep working after delivery,
    # unlike the other public job lookups above. Tenant identity comes from the
    # signed token itself (app/whatsapp/token.py), not a company-code lookup, so
    # this has no ambient WHERE clause beyond the job ids the token names.
    # Every field below is either the customer's own data (mobile, address, problem
    # reported) going back to that same customer on their own signed link, or
    # routinely-public business info (branch phone/email/GSTIN) — same "customer's
    # own copy" boundary the printed job slip already crosses at drop-off. Nothing
    # from job_type/job_receive_manner/job_receive_condition or the job/customer
    # columns here approaches internal-only territory (cost price, technician,
    # diagnosis, payments/invoice lines) — that boundary is drawn at the
    # client-side JobDetailType / buildJobInfoDoc's internal audit report, never
    # exposed on this public route.
    GET_JOB_INTAKE_STATUS = """
        SELECT
            j.job_no,
            j.batch_no,
            j.job_date,
            j.alternate_job_no,
            j.problem_reported,
            j.remarks,
            j.qty,
            j.warranty_card_no,
            j.purchase_date,
            j.address_snapshot,
            j.serial_no,
            p.name AS product_name,
            brd.name AS brand_name,
            pbm.model_name,
            TRIM(CONCAT_WS(' / ', NULLIF(p.name, ''), NULLIF(brd.name, ''), NULLIF(pbm.model_name, ''),
                           NULLIF(j.serial_no, ''))) AS device,
            js.name AS status,
            js.code AS status_code,
            j.is_final,
            j.amount,
            jt.name AS job_type_name,
            jrm.name AS receive_manner_name,
            jrc.name AS receive_condition_name,
            b.code AS branch_code,
            b.name AS branch_name,
            b.phone AS branch_phone,
            b.email AS branch_email,
            b.gstin AS branch_gstin,
            TRIM(CONCAT_WS(', ', NULLIF(b.address_line1, ''), NULLIF(b.address_line2, ''),
                           NULLIF(b.city, ''), NULLIF(st.name, ''), NULLIF(b.pincode, ''))) AS branch_address,
            -- The printed/downloadable Job Sheet is branded per DIVISION, same as
            -- the client's own job-sheet-pdf.ts (division.name/address/phone/
            -- email/gstin, not the branch's) — the HTML status page above keeps
            -- using branch_* as it always has; only the PDF builder reads these.
            d.name AS division_name,
            d.phone AS division_phone,
            d.email AS division_email,
            d.gstin AS division_gstin,
            TRIM(CONCAT_WS(', ', NULLIF(d.address_line1, ''), NULLIF(d.address_line2, ''),
                           NULLIF(d.city, ''), NULLIF(d.pincode, ''))) AS division_address,
            cc.full_name AS customer_name,
            cc.mobile AS customer_mobile
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status js ON js.id = j.job_status_id
        JOIN job_type jt ON jt.id = j.job_type_id
        JOIN job_receive_manner jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        JOIN branch b ON b.id = j.branch_id
        LEFT JOIN state st ON st.id = b.state_id
        LEFT JOIN division d ON d.id = j.division_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand brd ON brd.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE j.id = ANY(%(job_ids)s::bigint[])
        ORDER BY j.job_no
    """

    # BU display name, resolved once per request against the tenant schema code —
    # same lookup SqlStore.GET_BU_NAME_BY_CODE (sql_jobs.py) performs for the
    # WhatsApp send itself; kept as its own public-safe constant per this module's
    # docstring (never share a query object with the internal admin/GraphQL side).
    GET_BU_NAME_BY_CODE = """
        SELECT name FROM security.bu WHERE LOWER(code) = LOWER(%(schema)s)
    """

    # Generic per-key app_setting lookup — identical to SharedSql.GET_APP_SETTING_BY_KEY
    # (sql_shared.py), duplicated here rather than imported so this public router never
    # shares a query object with the internal admin/GraphQL side, same reasoning as
    # GET_BU_NAME_BY_CODE above. Used to pull job_terms_and_conditions onto the job
    # slip PDF — the same legal text already printed on the manual job sheet.
    GET_APP_SETTING_BY_KEY = """
        with "p_key" as (values(%(setting_key)s::text))
        SELECT setting_value
        FROM app_setting
        WHERE setting_key = (table "p_key")
    """

    # ── Job Delivery (public, WhatsApp OTP-confirmed delivery) ──────────────────
    # Tenant identity comes from the signed token itself (app/whatsapp/token.py),
    # same as Job Intake above — no ambient WHERE clause beyond the job ids the
    # token names. Not filtered by is_closed — must keep working after the job
    # closes, same discipline as GET_JOB_INTAKE_STATUS. `batch_no` is each row's
    # OWN value here, never a single shared value the way GET_JOB_INTAKE_STATUS
    # treats it — one delivery can span jobs from several different intake
    # batches, or individually-created jobs, all for one customer
    # (plans/plan.md's "One delivery is not one intake batch").
    GET_JOB_DELIVERY_STATUS = """
        SELECT
            j.job_no,
            j.batch_no,
            j.amount,
            COALESCE((SELECT SUM(jp.amount) FROM job_payment jp WHERE jp.job_id = j.id), 0) AS paid_amount,
            j.serial_no,
            TRIM(CONCAT_WS(' / ', NULLIF(p.name, ''), NULLIF(brd.name, ''), NULLIF(pbm.model_name, ''))) AS device,
            b.name AS branch_name,
            TRIM(CONCAT_WS(', ', NULLIF(b.address_line1, ''), NULLIF(b.address_line2, ''),
                           NULLIF(b.city, ''), NULLIF(st.name, ''), NULLIF(b.pincode, ''))) AS branch_address,
            cc.full_name AS customer_name
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN branch b ON b.id = j.branch_id
        LEFT JOIN state st ON st.id = b.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand brd ON brd.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        WHERE j.id = ANY(%(job_ids)s::bigint[])
        ORDER BY j.job_no
    """

    # Line-item detail for the "Download Invoice" PDF — one row per invoice line,
    # header fields repeated per line (same denormalized-rows shape this
    # codebase already uses for other multi-row job detail queries). LEFT JOINs
    # throughout, not JOIN: a job with no invoice yet (e.g. a zero-charge RETURN)
    # must still appear, with null invoice/line fields, rather than silently
    # vanish from the PDF.
    # Deliberately mirrors the manual, staff-triggered invoice's own field set
    # (deliver-job-pdf.ts's drawInvoiceContent / GET_JOB_INVOICE_BY_JOB) — division
    # (not branch) is what brands the printed Tax Invoice, same "why" as
    # GET_JOB_INTAKE_STATUS's division_* columns above — plus enough
    # customer/device detail for the WhatsApp-triggered PDF to render the same
    # Customer Details/Shipping Address block, not a stripped-down summary.
    GET_JOB_DELIVERY_INVOICE_DETAIL = """
        SELECT
            j.id AS job_id,
            j.job_no,
            TRIM(CONCAT_WS(' / ', NULLIF(p.name, ''), NULLIF(brd.name, ''), NULLIF(pbm.model_name, ''))) AS device,
            j.serial_no,
            b.name AS branch_name,
            d.code AS division_code,
            d.name AS division_name,
            d.phone AS division_phone,
            d.email AS division_email,
            d.gstin AS division_gstin,
            d.web_site AS division_web_site,
            dst.gst_state_code AS division_gst_state_code,
            TRIM(CONCAT_WS(', ', NULLIF(d.address_line1, ''), NULLIF(d.address_line2, ''),
                           NULLIF(d.city, ''), NULLIF(d.pincode, ''))) AS division_address,
            cc.full_name AS customer_name,
            cc.mobile AS customer_mobile,
            cc.gstin AS customer_gstin,
            cc.email AS customer_email,
            TRIM(CONCAT_WS(', ', NULLIF(cc.address_line1, ''), NULLIF(cc.address_line2, ''),
                           NULLIF(cc.landmark, ''), NULLIF(cc.city, ''), NULLIF(cst.name, ''),
                           NULLIF(cc.postal_code, ''))) AS customer_address,
            ji.invoice_no,
            ji.invoice_date,
            ji.aggregate AS invoice_aggregate,
            ji.cgst_amount AS invoice_cgst,
            ji.sgst_amount AS invoice_sgst,
            ji.igst_amount AS invoice_igst,
            ji.amount AS invoice_total,
            jil.description,
            jil.part_code,
            jil.hsn_code,
            jil.qty,
            jil.price,
            jil.aggregate AS line_aggregate,
            jil.gst_rate,
            jil.cgst_amount AS line_cgst,
            jil.sgst_amount AS line_sgst,
            jil.igst_amount AS line_igst,
            jil.amount AS line_amount,
            COALESCE((SELECT SUM(jp.amount) FROM job_payment jp WHERE jp.job_id = j.id), 0) AS paid_amount
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN state cst ON cst.id = cc.state_id
        JOIN branch b ON b.id = j.branch_id
        LEFT JOIN division d ON d.id = j.division_id
        LEFT JOIN state dst ON dst.id = d.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand brd ON brd.id = pbm.brand_id
        LEFT JOIN product p ON p.id = pbm.product_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN job_invoice_line jil ON jil.job_invoice_id = ji.id
        WHERE j.id = ANY(%(job_ids)s::bigint[])
        ORDER BY j.job_no, jil.id
    """

    # Receipts against the delivered job(s), for the invoice PDF's "Receipts /
    # Debits" table — same job_payment columns deliver-job-pdf.ts's own
    # JobPaymentRow reads, fetched separately (not folded into the
    # invoice-line query above) so a job with N lines and M payments doesn't
    # cross-join into N*M denormalized rows.
    GET_JOB_DELIVERY_PAYMENTS = """
        SELECT job_id, id, receipt_no, payment_date, payment_mode, amount, reference_no, remarks
        FROM job_payment
        WHERE job_id = ANY(%(job_ids)s::bigint[])
        ORDER BY payment_date, id
    """

    # ── Money Receipt (public, WhatsApp-triggered "Download Money Receipt") ─────
    # Whitelisted columns only, one specific job_payment row — both payment_id
    # and job_id required in the WHERE (never trust one alone), same discipline
    # verify_receipt's two-id token payload exists for (plans/plan.md, Step 1).
    # Division, not branch, brands the printed receipt — same reasoning
    # GET_JOB_INTAKE_STATUS/GET_JOB_DELIVERY_INVOICE_DETAIL already give for
    # their own division_* columns.
    GET_JOB_PAYMENT_FOR_WHATSAPP_RECEIPT = """
        SELECT
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.remarks,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            b.name AS branch_name,
            d.name AS division_name,
            d.phone AS division_phone,
            d.email AS division_email,
            d.gstin AS division_gstin,
            TRIM(CONCAT_WS(', ', NULLIF(d.address_line1, ''), NULLIF(d.address_line2, ''),
                           NULLIF(d.city, ''), NULLIF(d.pincode, ''))) AS division_address,
            cc.full_name AS customer_name,
            cc.mobile AS customer_mobile,
            TRIM(CONCAT_WS(', ', NULLIF(cc.address_line1, ''), NULLIF(cc.address_line2, ''),
                           NULLIF(cc.landmark, ''), NULLIF(cc.city, ''), NULLIF(cst.name, ''),
                           NULLIF(cc.postal_code, ''))) AS customer_address
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN state cst ON cst.id = cc.state_id
        JOIN branch b ON b.id = j.branch_id
        LEFT JOIN division d ON d.id = j.division_id
        WHERE jp.id = %(payment_id)s AND jp.job_id = %(job_id)s
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
