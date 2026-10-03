"""Monthly billing — SQL for plans/plan.md (billing columns, payment ledger, branch limit).

Billing state lives on `security.bu` of every tenant database; the paying unit is a BU
for Lite / Basic / Standard and the whole database for Enterprise (constraint 6).

- `BillingSql` — reads the browser may run through genericQuery. Composed into SqlStore.
  Step 13 adds them.
- `BillingServerSql` — DDL, writes and server-only reads. Deliberately NOT in SqlStore.

There is no database trigger here, by decision: the branch limit is enforced by the
`addBranch` mutation (Step 12), which takes LOCK_BU_FOR_BRANCH, counts with
COUNT_BRANCHES and inserts in one transaction.
"""


class BillingSql:
    """Billing reads the browser runs through genericQuery (Step 13). Both name `security.`,
    so Step 1's scan makes them admin-only."""

    # Admin → Subscriptions (default database) and the Super Admin's client panel (the client's
    # database). The status mirrors app.core.billing.compute_billing_status on the IST date.
    GET_BU_SUBSCRIPTIONS = """
        with "today" as (values((now() AT TIME ZONE 'Asia/Kolkata')::date))
        SELECT b.id, b.code, b.name, b.is_active, b.plan_code, b.billing_required,
               b.monthly_fee_paise, b.paid_through, b.billing_hold, b.branch_limit,
               CASE
                   WHEN NOT b.billing_required THEN 'not_billed'
                   WHEN b.billing_hold OR b.paid_through IS NULL
                        OR (table "today") > b.paid_through THEN 'read_only'
                   WHEN b.paid_through - (table "today") < 5 THEN 'due_soon'
                   ELSE 'active'
               END AS status,
               (b.billing_required AND b.paid_through IS NULL) AS awaiting_first_payment
        FROM security.bu b
        ORDER BY (b.billing_required AND b.paid_through IS NULL) DESC, b.name
    """

    # Ledger, newest first: one BU's rows plus the client-level rows (bu_id null); every row
    # when p_bu_id is null.
    GET_BU_PAYMENTS = """
        with "p_bu_id" as (values(%(bu_id)s::bigint))
        SELECT p.id, p.bu_id, b.code AS bu_code, p.entry_kind, p.amount_paise, p.months,
               p.monthly_fee_paise, p.payment_mode, p.payment_reference, p.received_on,
               p.period_from, p.period_to, p.note, p.recorded_by, p.recorded_at
        FROM security.bu_payment p
        LEFT JOIN security.bu b ON b.id = p.bu_id
        WHERE (table "p_bu_id") IS NULL OR p.bu_id = (table "p_bu_id") OR p.bu_id IS NULL
        ORDER BY p.recorded_at DESC, p.id DESC
    """


class BillingServerSql:
    """Billing DDL, writes and server-only reads. Never composed into SqlStore."""

    # Every tenant database, security schema. Safe to run twice. Existing BUs get
    # billing_required = false and branch_limit = null: not billed, unlimited.
    BU_BILLING_DDL = """
        ALTER TABLE security.bu
            ADD COLUMN IF NOT EXISTS plan_code text,
            ADD COLUMN IF NOT EXISTS billing_required boolean DEFAULT false NOT NULL,
            ADD COLUMN IF NOT EXISTS monthly_fee_paise bigint,
            ADD COLUMN IF NOT EXISTS paid_through date,
            ADD COLUMN IF NOT EXISTS billing_hold boolean DEFAULT false NOT NULL,
            ADD COLUMN IF NOT EXISTS branch_limit integer,
            ADD COLUMN IF NOT EXISTS last_reminder_on date,
            ADD COLUMN IF NOT EXISTS last_reminder_kind text;

        ALTER TABLE security.bu DROP CONSTRAINT IF EXISTS bu_plan_code_check;
        ALTER TABLE security.bu ADD CONSTRAINT bu_plan_code_check
            CHECK (plan_code IS NULL OR plan_code IN ('lite', 'basic', 'standard', 'enterprise'));

        ALTER TABLE security.bu DROP CONSTRAINT IF EXISTS bu_monthly_fee_check;
        ALTER TABLE security.bu ADD CONSTRAINT bu_monthly_fee_check
            CHECK (monthly_fee_paise IS NULL OR monthly_fee_paise >= 0);

        ALTER TABLE security.bu DROP CONSTRAINT IF EXISTS bu_branch_limit_check;
        ALTER TABLE security.bu ADD CONSTRAINT bu_branch_limit_check
            CHECK (branch_limit IS NULL OR branch_limit >= 1);

        ALTER TABLE security.bu DROP CONSTRAINT IF EXISTS bu_last_reminder_kind_check;
        ALTER TABLE security.bu ADD CONSTRAINT bu_last_reminder_kind_check
            CHECK (last_reminder_kind IS NULL
                OR last_reminder_kind IN ('due_soon', 'due_today', 'lapsed', 'first_payment'));

        CREATE TABLE IF NOT EXISTS security.bu_payment (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            bu_id bigint REFERENCES security.bu (id),
            entry_kind text DEFAULT 'payment' NOT NULL,
            amount_paise bigint DEFAULT 0 NOT NULL,
            months smallint DEFAULT 0 NOT NULL,
            monthly_fee_paise bigint NOT NULL,
            payment_mode text,
            payment_reference text,
            received_on date,
            period_from date,
            period_to date,
            note text,
            recorded_by text NOT NULL,
            recorded_at timestamp with time zone DEFAULT now() NOT NULL
        );

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_entry_kind_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_entry_kind_check
            CHECK (entry_kind IN ('payment', 'fee_rebase', 'extension', 'correction'));

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_months_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_months_check
            CHECK (months BETWEEN 0 AND 60 AND (entry_kind = 'payment' OR months = 0));

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_amounts_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_amounts_check
            CHECK (amount_paise >= 0 AND monthly_fee_paise >= 0);

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_mode_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_mode_check
            CHECK (payment_mode IS NULL OR payment_mode IN ('bank_transfer', 'upi', 'cash', 'other'));

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_payment_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_payment_check
            CHECK (entry_kind <> 'payment' OR (
                months >= 1
                AND amount_paise >= monthly_fee_paise * months
                AND payment_mode IS NOT NULL
                AND payment_reference IS NOT NULL
                AND received_on IS NOT NULL
            ));

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_note_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_note_check
            CHECK (entry_kind = 'payment' OR note IS NOT NULL);

        ALTER TABLE security.bu_payment DROP CONSTRAINT IF EXISTS bu_payment_period_check;
        ALTER TABLE security.bu_payment ADD CONSTRAINT bu_payment_period_check
            CHECK (period_to IS NULL OR period_from IS NULL OR period_to >= period_from);

        CREATE INDEX IF NOT EXISTS bu_payment_bu_id_idx ON security.bu_payment (bu_id, recorded_at);
    """

    # Run on the BU's own connection inside addBranch's transaction (Step 12). The row
    # lock makes a second addBranch, or changeBuPlan, on the same BU wait for this one.
    LOCK_BU_FOR_BRANCH = """
        SELECT id, branch_limit
        FROM security.bu
        WHERE LOWER(code) = LOWER(%(schema)s::text)
        FOR UPDATE
    """

    # Every branch counts toward the limit, inactive ones included.
    COUNT_BRANCHES = """
        SELECT COUNT(*)::int AS branch_count FROM branch
    """

    # View-only guard (Step 11): one BU's billing columns, found by its schema (= code).
    GET_BU_BILLING_BY_CODE = """
        SELECT plan_code, billing_required, paid_through, billing_hold, branch_limit
        FROM security.bu
        WHERE LOWER(code) = LOWER(%(code)s::text)
    """

    # ── Plan change and payments (Steps 12, 13). Security schema of the BU's database. ──

    LOCK_BU_BY_ID = """
        SELECT * FROM security.bu WHERE id = %(id)s FOR UPDATE
    """

    LOCK_BILLED_BUS = """
        SELECT * FROM security.bu WHERE billing_required ORDER BY id FOR UPDATE
    """

    LOCK_ALL_BUS = """
        SELECT * FROM security.bu ORDER BY id FOR UPDATE
    """

    INSERT_BU_PAYMENT = """
        INSERT INTO security.bu_payment
            (bu_id, entry_kind, amount_paise, months, monthly_fee_paise, payment_mode,
             payment_reference, received_on, period_from, period_to, note, recorded_by)
        VALUES (%(bu_id)s, 'payment', %(amount_paise)s, %(months)s, %(monthly_fee_paise)s, %(mode)s,
                %(reference)s, %(received_on)s, %(period_from)s, %(period_to)s, %(note)s, %(recorded_by)s)
        RETURNING id
    """

    # A zero-amount row of another kind ('extension', 'correction'); the note is required.
    INSERT_LEDGER_NOTE = """
        INSERT INTO security.bu_payment
            (bu_id, entry_kind, amount_paise, months, monthly_fee_paise, period_to, note, recorded_by)
        VALUES (%(bu_id)s, %(entry_kind)s, 0, 0, %(monthly_fee_paise)s, %(period_to)s, %(note)s, %(recorded_by)s)
    """

    SET_BU_PAID_THROUGH = """
        UPDATE security.bu SET paid_through = %(paid_through)s, updated_at = now() WHERE id = %(id)s
    """

    SET_BU_PLAN_FIELDS = """
        UPDATE security.bu
        SET plan_code = %(plan_code)s, branch_limit = %(branch_limit)s,
            billing_required = %(billing_required)s, monthly_fee_paise = %(monthly_fee_paise)s,
            paid_through = %(paid_through)s, updated_at = now()
        WHERE id = %(id)s
    """

    SET_BU_FEE = """
        UPDATE security.bu SET monthly_fee_paise = %(monthly_fee_paise)s, updated_at = now() WHERE id = %(id)s
    """

    SET_CLIENT_BILLING_HOLD = """
        UPDATE security.bu SET billing_hold = %(hold)s, updated_at = now() WHERE billing_required
    """

    # startClientBilling: one existing BU put on the Enterprise plan.
    START_BU_BILLING = """
        UPDATE security.bu
        SET plan_code = 'enterprise', billing_required = true, branch_limit = NULL,
            billing_hold = false, monthly_fee_paise = %(monthly_fee_paise)s,
            paid_through = %(paid_through)s, updated_at = now()
        WHERE id = %(id)s
    """

    # Every foreign key to <schema>.branch: the tables a branch's data lives in.
    GET_BRANCH_FOREIGN_KEYS = """
        SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = to_regclass(%(branch_table)s)
        ORDER BY 1, 2
    """

    # Run in the BU schema: the branches a downgrade to one branch would leave.
    GET_NON_HO_BRANCHES = """
        SELECT id, code, name FROM branch WHERE code <> 'HO' ORDER BY code
    """

    # Receipt and reminder recipients: the BU's active Managers plus the database's admins.
    GET_BU_BILLING_RECIPIENTS = """
        SELECT DISTINCT LOWER(u.email) AS email
        FROM security."user" u
        LEFT JOIN security.user_bu_role ubr ON ubr.user_id = u.id AND ubr.is_active
        LEFT JOIN security.role r ON r.id = ubr.role_id
        WHERE u.is_active AND u.email <> ''
          AND (u.is_admin OR (ubr.bu_id = %(bu_id)s AND r.code = 'MANAGER'))
    """

    # Reminders: every active billed BU with its reminder bookkeeping.
    GET_REMINDER_BUS = """
        SELECT id, code, name, paid_through, billing_hold, last_reminder_on, last_reminder_kind
        FROM security.bu
        WHERE billing_required AND is_active
    """

    SET_BU_REMINDER = """
        UPDATE security.bu
        SET last_reminder_on = %(on)s, last_reminder_kind = %(kind)s
        WHERE id = %(id)s
    """

    # ── Enterprise later BUs (plans/plan.md Step 10). Run in the client's database. ──

    # Every BU with its billing columns, oldest first; inactive BUs count too.
    GET_BU_BILLING_ROWS = """
        SELECT id, code, plan_code, billing_required, monthly_fee_paise, paid_through,
               billing_hold, branch_limit
        FROM security.bu
        ORDER BY id
    """

    # A new BU of a billed client shares the client's plan and dates.
    COPY_CLIENT_BILLING_TO_BU = """
        UPDATE security.bu
        SET plan_code = %(plan_code)s, billing_required = %(billing_required)s,
            paid_through = %(paid_through)s, billing_hold = %(billing_hold)s,
            branch_limit = %(branch_limit)s, monthly_fee_paise = %(monthly_fee_paise)s,
            updated_at = now()
        WHERE id = %(bu_id)s
    """

    # The client's shared paid_through after a fee change (constraint 8), on every billed BU.
    SET_CLIENT_PAID_THROUGH = """
        UPDATE security.bu
        SET paid_through = %(paid_through)s, updated_at = now()
        WHERE billing_required
    """

    # A zero-amount ledger row recording a fee change and both dates.
    INSERT_FEE_REBASE = """
        INSERT INTO security.bu_payment
            (bu_id, entry_kind, amount_paise, months, monthly_fee_paise, note, recorded_by)
        VALUES (%(bu_id)s, 'fee_rebase', 0, 0, %(monthly_fee_paise)s, %(note)s, %(recorded_by)s)
    """
