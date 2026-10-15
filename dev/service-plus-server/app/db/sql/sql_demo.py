"""Live demo — server-only reads for the demo-data generator (app/demo/demo_data.py).
Deliberately NOT in SqlStore: the browser never runs these."""


class DemoServerSql:  # pylint: disable=too-few-public-methods
    """Reads in the demo business unit's schema (search_path set by exec_sql)."""

    GET_BRANDS = "SELECT id, code FROM brand"

    GET_BRANCH_AND_DIVISION = """
        SELECT b.id AS branch_id, d.id AS division_id
        FROM branch b
        JOIN division d ON d.branch_id = b.id
        WHERE b.is_head_office
        ORDER BY d.is_default DESC, d.id
        LIMIT 1
    """

    GET_CUSTOMER_NAME = "SELECT full_name FROM customer_contact WHERE id = %(id)s"

    GET_CUSTOMERS = "SELECT id, mobile FROM customer_contact ORDER BY id"

    # security schema: job history rows need a performing user; the demo user does the work.
    GET_DEMO_USER_ID = 'SELECT id FROM security."user" WHERE username = %(username)s'

    GET_JOB_CHARGES = """
        SELECT charge_name, qty, selling_price FROM job_additional_charge WHERE job_id = %(job_id)s ORDER BY id
    """

    GET_JOB_PARTS = """
        SELECT u.qty, u.selling_price, s.part_name, s.part_code
        FROM job_part_used u
        JOIN spare_part_master s ON s.id = u.part_id
        WHERE u.job_id = %(job_id)s
        ORDER BY u.id
    """

    GET_LOOKUP_IDS = """
        SELECT 'status' AS kind, code, id FROM job_status
        UNION ALL SELECT 'job_type', code, id FROM job_type
        UNION ALL SELECT 'stock_type', code, id FROM stock_transaction_type
        UNION ALL SELECT 'doc_seq', dt.code, ds.id FROM document_sequence ds
            JOIN document_type dt ON dt.id = ds.document_type_id
    """

    GET_MODELS = """
        SELECT m.id, m.brand_id, m.product_id, m.model_name, p.name AS product
        FROM product_brand_model m
        JOIN product p ON p.id = m.product_id
        ORDER BY m.id
    """

    GET_DEMO_COUNTS = """
        SELECT (SELECT count(*) FROM job) AS jobs,
               (SELECT max(job_date) FROM job) AS newest_job_date,
               (SELECT count(*) FROM customer_contact) AS customers
    """

    GET_NEWEST_JOB_DATE = "SELECT max(job_date) AS newest, count(*) AS jobs FROM job"

    GET_OPEN_JOBS = """
        SELECT j.id, j.job_date, j.job_status_id, j.last_transaction_id, j.is_final, j.amount,
               j.technician_id, j.estimate_amount, jt.code AS job_type_code, m.brand_id, p.name AS product,
               COALESCE(t.transaction_date, j.job_date) AS last_date
        FROM job j
        JOIN job_type jt ON jt.id = j.job_type_id
        JOIN product_brand_model m ON m.id = j.product_brand_model_id
        JOIN product p ON p.id = m.product_id
        LEFT JOIN job_transaction t ON t.id = j.last_transaction_id
        WHERE NOT j.is_closed
        ORDER BY j.id
    """

    GET_PARTS = "SELECT id, brand_id, category, cost_price, hsn_code, part_name, part_code FROM spare_part_master"

    GET_PRODUCTS = "SELECT id, name FROM product"

    GET_STOCK = "SELECT part_id, sum(qty) AS qty FROM stock_balance GROUP BY part_id"

    GET_SUPPLIERS = "SELECT id FROM supplier ORDER BY id"

    GET_TECHNICIANS = "SELECT id FROM technician WHERE is_active ORDER BY id"

    GET_WEST_BENGAL = "SELECT id, gst_state_code FROM state WHERE code = 'WB'"

    # pg_advisory lock key for the demo generator — one run at a time per database.
    LOCK_KEY = 74_200_301
