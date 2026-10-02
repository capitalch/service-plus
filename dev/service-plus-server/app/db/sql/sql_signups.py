"""Sign-up enquiries — SQL for plans/plan.md (plan-based sign-up, approval, billing).

Two homes, one per plan group (plans/plan.md, constraint 1):

- Lite / Basic / Standard ("lt") enquiries live in `security.sales_enquiry` of the
  default customer database (settings.default_customer_db_name).
- Enterprise enquiries stay in `public.sales_enquiry` of service_plus_client.

Two classes, split on purpose (same reasoning as ExtendedWarrantyServerSql and PublicSql):

- `SignupSql` — reads the browser may run through genericQuery. Composed into SqlStore.
  Steps 9 and 10 add them; every one names `security.` and so is admin-only under
  Step 1's ADMIN_ONLY_SQL_IDS scan.
- `SignupServerSql` — DDL, writes and server-only reads. Deliberately NOT in SqlStore,
  so genericQuery / genericUpdateScript can never run them.

Money is stored in paise (bigint). `*_by` columns hold the acting username as text:
an Enterprise action is taken by the Super Admin, who has no security."user" row.
"""

# Columns shared by both enquiry tables: the one-time setup payment, recorded by hand.
_PAYMENT_COLUMNS = """
    ADD COLUMN IF NOT EXISTS setup_fee_paise bigint DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' NOT NULL,
    ADD COLUMN IF NOT EXISTS payment_amount_paise bigint,
    ADD COLUMN IF NOT EXISTS payment_mode text,
    ADD COLUMN IF NOT EXISTS payment_reference text,
    ADD COLUMN IF NOT EXISTS payment_received_on date,
    ADD COLUMN IF NOT EXISTS payment_recorded_by text,
    ADD COLUMN IF NOT EXISTS payment_recorded_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS payment_note text
"""

# Payment rules shared by both tables. Each is dropped and re-added so the script stays
# safe to run twice; {table} and {not_valid} are filled per table below.
_PAYMENT_CONSTRAINTS = """
    ALTER TABLE {table} DROP CONSTRAINT IF EXISTS sales_enquiry_payment_status_check;
    ALTER TABLE {table} ADD CONSTRAINT sales_enquiry_payment_status_check
        CHECK (payment_status IN ('not_required', 'pending', 'received', 'failed')){not_valid};

    ALTER TABLE {table} DROP CONSTRAINT IF EXISTS sales_enquiry_payment_mode_check;
    ALTER TABLE {table} ADD CONSTRAINT sales_enquiry_payment_mode_check
        CHECK (payment_mode IS NULL OR payment_mode IN ('bank_transfer', 'upi', 'cash', 'other')){not_valid};

    ALTER TABLE {table} DROP CONSTRAINT IF EXISTS sales_enquiry_setup_fee_check;
    ALTER TABLE {table} ADD CONSTRAINT sales_enquiry_setup_fee_check
        CHECK (setup_fee_paise >= 0){not_valid};

    ALTER TABLE {table} DROP CONSTRAINT IF EXISTS sales_enquiry_received_check;
    ALTER TABLE {table} ADD CONSTRAINT sales_enquiry_received_check
        CHECK (payment_status <> 'received' OR (
            payment_mode IS NOT NULL
            AND payment_reference IS NOT NULL
            AND payment_received_on IS NOT NULL
            AND payment_amount_paise IS NOT NULL
            AND payment_amount_paise >= setup_fee_paise
        )){not_valid};

    ALTER TABLE {table} DROP CONSTRAINT IF EXISTS sales_enquiry_not_required_check;
    ALTER TABLE {table} ADD CONSTRAINT sales_enquiry_not_required_check
        CHECK (payment_status <> 'not_required' OR setup_fee_paise = 0){not_valid};

    ALTER TABLE {table} DROP CONSTRAINT IF EXISTS sales_enquiry_failed_note_check;
    ALTER TABLE {table} ADD CONSTRAINT sales_enquiry_failed_note_check
        CHECK (payment_status <> 'failed' OR payment_note IS NOT NULL){not_valid};
"""

# Provisioning progress columns: each finished part of an approval is recorded on the
# row so a failed approval resumes where it stopped (plans/plan.md, constraint 3).
_PROGRESS_COLUMNS = """
    ADD COLUMN IF NOT EXISTS bu_id bigint,
    ADD COLUMN IF NOT EXISTS bu_schema_ready_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS user_id bigint,
    ADD COLUMN IF NOT EXISTS login_email_sent boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS reviewed_by text,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS rejection_reason text
"""


class SignupSql:
    """Sign-up reads the browser runs through genericQuery (added by Steps 9 and 10)."""


class SignupServerSql:
    """Sign-up DDL, writes and server-only reads. Never composed into SqlStore."""

    # service_plus_client DB, public schema — run with db_name=None (the client pool).
    GET_DEFAULT_CUSTOMER_CLIENT = """
        SELECT id, code, name, db_name
        FROM public.client
        WHERE db_name = %(db_name)s::text
          AND is_active = true
        LIMIT 1
    """

    # Default customer database, security schema. Safe to run twice.
    SALES_ENQUIRY_DDL = (
        """
        CREATE TABLE IF NOT EXISTS security.sales_enquiry (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            reference text NOT NULL,
            plan_code text NOT NULL,
            name text NOT NULL,
            business_name text NOT NULL,
            mobile text NOT NULL,
            email text NOT NULL,
            city text NOT NULL,
            gstin text,
            branches integer DEFAULT 1 NOT NULL,
            message text,
            ip text,
            bu_name text NOT NULL,
            bu_code text NOT NULL,
            status text DEFAULT 'pending' NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL
        );

        ALTER TABLE security.sales_enquiry
        """
        + _PROGRESS_COLUMNS
        + ","
        + _PAYMENT_COLUMNS
        + """;

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_plan_code_check;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_plan_code_check
            CHECK (plan_code IN ('lite', 'basic', 'standard'));

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_status_check;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_status_check
            CHECK (status IN ('pending', 'approved', 'rejected'));

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_branches_check;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_branches_check
            CHECK (branches BETWEEN 1 AND 50);

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_approved_paid_check;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_approved_paid_check
            CHECK (status <> 'approved' OR payment_status IN ('received', 'not_required'));

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_bu_id_fkey;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_bu_id_fkey
            FOREIGN KEY (bu_id) REFERENCES security.bu (id);

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_user_id_fkey;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES security."user" (id);
        """
        + _PAYMENT_CONSTRAINTS.format(table="security.sales_enquiry", not_valid="")
        + """
        CREATE UNIQUE INDEX IF NOT EXISTS sales_enquiry_reference_key
            ON security.sales_enquiry (reference);
        CREATE UNIQUE INDEX IF NOT EXISTS sales_enquiry_open_email_key
            ON security.sales_enquiry (email) WHERE status IN ('pending', 'approved');
        CREATE UNIQUE INDEX IF NOT EXISTS sales_enquiry_open_mobile_key
            ON security.sales_enquiry (mobile) WHERE status IN ('pending', 'approved');
        CREATE UNIQUE INDEX IF NOT EXISTS sales_enquiry_open_bu_code_key
            ON security.sales_enquiry (bu_code) WHERE status IN ('pending', 'approved');
        """
    )

    # service_plus_client DB, public schema (Enterprise). Safe to run twice. Rules that
    # existing rows could break are added NOT VALID: old rows stay, new writes are checked.
    SALES_ENQUIRY_ENT_ALTER = (
        """
        ALTER TABLE public.sales_enquiry
            ADD COLUMN IF NOT EXISTS reference text,
            ADD COLUMN IF NOT EXISTS client_id bigint,
        """
        + _PROGRESS_COLUMNS
        + ","
        + _PAYMENT_COLUMNS
        + """;

        ALTER TABLE public.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_converted_paid_check;
        ALTER TABLE public.sales_enquiry ADD CONSTRAINT sales_enquiry_converted_paid_check
            CHECK (status <> 'converted' OR payment_status = 'received') NOT VALID;

        ALTER TABLE public.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_client_id_fkey;
        ALTER TABLE public.sales_enquiry ADD CONSTRAINT sales_enquiry_client_id_fkey
            FOREIGN KEY (client_id) REFERENCES public.client (id) NOT VALID;
        """
        + _PAYMENT_CONSTRAINTS.format(table="public.sales_enquiry", not_valid=" NOT VALID")
        + """
        CREATE UNIQUE INDEX IF NOT EXISTS sales_enquiry_reference_key
            ON public.sales_enquiry (reference);
        """
    )
