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
    """Billing reads the browser runs through genericQuery (added by Step 13)."""


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
