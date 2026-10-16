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
    """Sign-up reads the browser runs through genericQuery. Every one names `security.` or
    `public.`, so Step 1's ADMIN_ONLY_SQL_IDS scan makes it admin-only."""

    # Admin → Enquiries grid (default customer database). Each filter is optional (null = all).
    GET_SALES_ENQUIRIES = """
        with
            "p_status"         as (values(%(status)s::text)),
            "p_plan_code"      as (values(%(plan_code)s::text)),
            "p_payment_status" as (values(%(payment_status)s::text))
        SELECT e.id, e.reference, e.created_at, e.plan_code, e.name, e.business_name, e.mobile,
               e.email, e.city, e.gstin, e.branches, e.message, e.bu_name, e.bu_code, e.status,
               e.setup_fee_paise, e.payment_status, e.payment_amount_paise, e.payment_mode,
               e.payment_reference, e.payment_received_on, e.payment_recorded_by, e.payment_note,
               e.bu_id, e.user_id, e.login_email_sent, e.processing_started_at, e.reviewed_by,
               e.reviewed_at, e.rejection_reason, u.username, x.username AS existing_username,
               e.kind, e.upgrade_bu_id, ub.plan_code AS upgrade_bu_plan_code
        FROM security.sales_enquiry e
        LEFT JOIN security."user" u ON u.id = e.user_id
        LEFT JOIN security."user" x ON x.id = e.existing_user_id
        LEFT JOIN security.bu ub ON ub.id = e.upgrade_bu_id
        WHERE ((table "p_status") IS NULL OR e.status = (table "p_status"))
          AND ((table "p_plan_code") IS NULL OR e.plan_code = (table "p_plan_code"))
          AND ((table "p_payment_status") IS NULL OR e.payment_status = (table "p_payment_status"))
        ORDER BY e.created_at DESC
    """

    GET_SALES_ENQUIRY_PENDING_COUNT = """
        SELECT COUNT(*)::int AS pending FROM security.sales_enquiry WHERE status = 'pending'
    """

    # Super Admin → Enquiries grid (control plane, Enterprise). Filters optional.
    GET_ENTERPRISE_ENQUIRIES = """
        with
            "p_status"         as (values(%(status)s::text)),
            "p_payment_status" as (values(%(payment_status)s::text))
        SELECT e.id, e.reference, e.created_at, e.plan_code, e.name, e.business_name, e.mobile,
               e.email, e.city, e.gstin, e.branches, e.message, e.status, e.setup_fee_paise,
               e.payment_status, e.payment_amount_paise, e.payment_mode, e.payment_reference,
               e.payment_received_on, e.payment_recorded_by, e.payment_note, e.client_id, e.bu_id,
               e.user_id, e.processing_started_at, e.reviewed_by, e.reviewed_at, e.rejection_reason,
               c.code AS client_code, c.db_name
        FROM public.sales_enquiry e
        LEFT JOIN public.client c ON c.id = e.client_id
        WHERE e.plan_code = 'enterprise'
          AND ((table "p_status") IS NULL OR e.status = (table "p_status"))
          AND ((table "p_payment_status") IS NULL OR e.payment_status = (table "p_payment_status"))
        ORDER BY e.created_at DESC
    """

    GET_ENTERPRISE_ENQUIRY_NEW_COUNT = """
        SELECT COUNT(*)::int AS pending
        FROM public.sales_enquiry
        WHERE plan_code = 'enterprise' AND status = 'new'
    """


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

    # ── Public sign-up (Step 7). lt: default customer database, security schema. ──

    # One row when a pending request already has this email (stored lower-case). Approved
    # and rejected requests never block a new one, and mobile is not compared (Step 4).
    CHECK_LT_SIGNUP_PENDING = """
        SELECT 1 AS found FROM security.sales_enquiry
        WHERE status = 'pending' AND lower(email) = %(email)s
        LIMIT 1
    """

    # The login that already owns this email, if any. Email is a login's only identity;
    # mobile may be shared by several users. Shared by sign-up (Step 4) and approval (Step 6).
    GET_LT_SIGNUP_EXISTING_USER = """
        SELECT id, username, full_name, mobile, is_active, is_admin FROM security."user"
        WHERE lower(email) = %(email)s
    """

    # The BUs this email's login is Manager of, with their plans: the plan rules of a sign-up
    # (a Lite owner must upgrade first; a paid owner gets no Lite) and the BU an upgrade targets.
    GET_LT_MANAGED_BUS = """
        SELECT b.id, b.code, b.name, b.plan_code
        FROM security."user" u
        JOIN security.user_bu_role r ON r.user_id = u.id
        JOIN security.role ro ON ro.id = r.role_id AND ro.code = 'MANAGER'
        JOIN security.bu b ON b.id = r.bu_id
        WHERE lower(u.email) = %(email)s
        ORDER BY b.id
    """

    # A Lite BU's request to move to Basic / Standard (Step: upgrades). It carries the BU's code
    # and name and the login it belongs to; approval changes the plan of upgrade_bu_id.
    INSERT_LT_UPGRADE = """
        INSERT INTO security.sales_enquiry
            (reference, plan_code, name, business_name, mobile, email, city, branches, ip, bu_name,
             bu_code, setup_fee_paise, payment_status, existing_user_id, kind, upgrade_bu_id)
        VALUES
            (%(reference)s, %(plan_code)s, %(name)s, %(bu_name)s, %(mobile)s, %(email)s, '', 1, %(ip)s,
             %(bu_name)s, %(bu_code)s, %(setup_fee_paise)s, %(payment_status)s, %(existing_user_id)s,
             'upgrade', %(upgrade_bu_id)s)
        RETURNING id
    """

    # True when a BU or a pending / approved request already uses this BU name.
    CHECK_LT_BU_NAME_TAKEN = """
        SELECT EXISTS (
            SELECT 1 FROM security.bu WHERE LOWER(name) = LOWER(%(name)s)
        ) OR EXISTS (
            SELECT 1 FROM security.sales_enquiry
            WHERE status IN ('pending', 'approved') AND LOWER(bu_name) = LOWER(%(name)s)
        ) AS taken
    """

    # True when this BU code is a BU, an existing schema or a pending / approved request.
    CHECK_LT_BU_CODE_TAKEN = """
        SELECT EXISTS (
            SELECT 1 FROM security.bu WHERE LOWER(code) = %(code)s
        ) OR EXISTS (
            SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = %(code)s
        ) OR EXISTS (
            SELECT 1 FROM security.sales_enquiry
            WHERE status IN ('pending', 'approved') AND bu_code = %(code)s
        ) AS taken
    """

    INSERT_LT_ENQUIRY = """
        INSERT INTO security.sales_enquiry
            (reference, plan_code, name, business_name, mobile, email, city, gstin, branches,
             message, ip, bu_name, bu_code, setup_fee_paise, payment_status, existing_user_id)
        VALUES
            (%(reference)s, %(plan_code)s, %(name)s, %(business_name)s, %(mobile)s, %(email)s,
             %(city)s, %(gstin)s, %(branches)s, %(message)s, %(ip)s, %(bu_name)s, %(bu_code)s,
             %(setup_fee_paise)s, %(payment_status)s, %(existing_user_id)s)
        RETURNING id
    """

    GET_LT_PENDING_COUNT = """
        SELECT COUNT(*)::int AS pending FROM security.sales_enquiry WHERE status = 'pending'
    """

    # Approver email recipients: every active admin of the default database.
    GET_ACTIVE_ADMIN_EMAILS = """
        SELECT DISTINCT LOWER(email) AS email
        FROM security."user"
        WHERE is_admin AND is_active AND email <> ''
    """

    # Status page: mobile AND email must match the same request; the newest one wins.
    GET_LT_SIGNUP_STATUS = """
        SELECT status, plan_code, rejection_reason, email, existing_user_id
        FROM security.sales_enquiry
        WHERE mobile = %(mobile)s AND email = %(email)s
        ORDER BY created_at DESC
        LIMIT 1
    """

    # ── Sign-up email codes (plans/plan.md Step 3). Default customer database, security schema. ──

    # A new code for this email. A resend resets the tries and replaces the stored form. No row
    # comes back while the last code is under resend_seconds old, or when max_sends codes went
    # out within the past hour: the caller then reads the row to say which.
    UPSERT_SIGNUP_OTP = """
        INSERT INTO security.signup_otp AS o (email, code_hash, payload, expires_at)
        VALUES (%(email)s, %(code_hash)s, %(payload)s::jsonb, now() + %(ttl_minutes)s * interval '1 minute')
        ON CONFLICT (email) DO UPDATE
        SET code_hash = EXCLUDED.code_hash,
            payload = EXCLUDED.payload,
            expires_at = EXCLUDED.expires_at,
            attempts = 0,
            sent_count = CASE WHEN o.first_sent_at < now() - interval '1 hour' THEN 1 ELSE o.sent_count + 1 END,
            first_sent_at = CASE WHEN o.first_sent_at < now() - interval '1 hour' THEN now() ELSE o.first_sent_at END,
            last_sent_at = now()
        WHERE o.last_sent_at < now() - %(resend_seconds)s * interval '1 second'
          AND (o.first_sent_at < now() - interval '1 hour' OR o.sent_count < %(max_sends)s)
        RETURNING email
    """

    GET_SIGNUP_OTP = """
        SELECT email, code_hash, attempts, expires_at < now() AS expired,
               last_sent_at > now() - %(resend_seconds)s * interval '1 second' AS too_soon
        FROM security.signup_otp
        WHERE email = %(email)s
    """

    # One wrong try; no row once the tries are used up.
    BUMP_SIGNUP_OTP_ATTEMPTS = """
        UPDATE security.signup_otp SET attempts = attempts + 1
        WHERE email = %(email)s AND attempts < %(max_attempts)s
        RETURNING attempts
    """

    # Uses the code up: only the request that deletes the row gets the form back, so a code
    # cannot be replayed or used twice by two clicks.
    DELETE_SIGNUP_OTP = """
        DELETE FROM security.signup_otp
        WHERE email = %(email)s AND code_hash = %(code_hash)s AND expires_at >= now()
        RETURNING payload
    """

    PURGE_SIGNUP_OTP = """
        DELETE FROM security.signup_otp WHERE last_sent_at < now() - interval '1 day'
    """

    # ── Deleting a BU (provisioning.py resolve_delete_bu_schema_helper). Any database. ──

    # What decides whether a BU row may be deleted: it must be inactive, and a BU with payment
    # records is never deleted (bu_payment is the ledger and keeps no ON DELETE rule on purpose).
    GET_BU_DELETE_CHECK = """
        SELECT b.is_active,
               (SELECT count(*) FROM security.bu_payment p WHERE p.bu_id = b.id)::int AS payments
        FROM security.bu b
        WHERE LOWER(b.code) = %(code)s
    """

    # True when this database has the sign-up table (only the default customer database does).
    HAS_SALES_ENQUIRY_TABLE = """
        SELECT to_regclass('security.sales_enquiry') IS NOT NULL AS present
    """

    # A sign-up keeps its row when the BU it created is deleted, like the user link (ON DELETE
    # SET NULL). A still-pending request also forgets its finished schema, so a later approval
    # builds a fresh BU and schema instead of skipping the schema step.
    RELEASE_SALES_ENQUIRY_BU = """
        UPDATE security.sales_enquiry
        SET bu_id = NULL,
            bu_schema_ready_at = CASE WHEN status = 'pending' THEN NULL ELSE bu_schema_ready_at END
        WHERE bu_id IN (SELECT id FROM security.bu WHERE LOWER(code) = %(code)s)
    """

    # ── Enterprise: service_plus_client DB, public schema (db_name=None). ──

    INSERT_ENT_ENQUIRY = """
        INSERT INTO public.sales_enquiry
            (reference, plan_code, name, business_name, mobile, email, city, gstin, branches,
             message, ip, setup_fee_paise, payment_status)
        VALUES
            (%(reference)s, 'enterprise', %(name)s, %(business_name)s, %(mobile)s, %(email)s,
             %(city)s, %(gstin)s, %(branches)s, %(message)s, %(ip)s, %(setup_fee_paise)s, 'pending')
        RETURNING id
    """

    GET_ENT_NEW_COUNT = """
        SELECT COUNT(*)::int AS pending
        FROM public.sales_enquiry
        WHERE plan_code = 'enterprise' AND status = 'new'
    """

    # ── Approval (Step 9). lt: default customer database, security schema. ──

    GET_LT_ENQUIRY = """
        SELECT * FROM security.sales_enquiry WHERE id = %(id)s
    """

    GET_USERNAME = """
        SELECT username FROM security."user" WHERE id = %(id)s
    """

    GET_ROLE_ID_BY_CODE = """
        SELECT id FROM security.role WHERE code = %(code)s
    """

    # Setup payment for Basic / Standard while the request is still pending.
    RECORD_LT_PAYMENT = """
        UPDATE security.sales_enquiry
        SET payment_status = 'received', payment_amount_paise = %(amount_paise)s,
            payment_mode = %(mode)s, payment_reference = %(reference)s,
            payment_received_on = %(received_on)s, payment_recorded_by = %(by)s,
            payment_recorded_at = now(), payment_note = %(note)s
        WHERE id = %(id)s AND status = 'pending' AND plan_code IN ('basic', 'standard')
          AND payment_status IN ('pending', 'failed')
        RETURNING id
    """

    MARK_LT_PAYMENT_FAILED = """
        UPDATE security.sales_enquiry
        SET payment_status = 'failed', payment_note = %(note)s, payment_recorded_by = %(by)s,
            payment_recorded_at = now()
        WHERE id = %(id)s AND status = 'pending' AND plan_code IN ('basic', 'standard')
          AND payment_status IN ('pending', 'failed')
        RETURNING id
    """

    # One statement, so two clicks cannot both claim the row (plans/plan.md constraint 3).
    CLAIM_LT_ENQUIRY = """
        UPDATE security.sales_enquiry
        SET processing_started_at = now()
        WHERE id = %(id)s AND status = 'pending'
          AND (processing_started_at IS NULL OR processing_started_at < now() - interval '10 minutes')
        RETURNING *
    """

    RELEASE_LT_CLAIM = """
        UPDATE security.sales_enquiry SET processing_started_at = NULL WHERE id = %(id)s
    """

    # Step 3 of approval, run with INSERT_BU on one connection (one transaction).
    SET_LT_BU = """
        UPDATE security.sales_enquiry
        SET bu_id = %(bu_id)s, bu_code = %(bu_code)s, bu_name = %(bu_name)s
        WHERE id = %(id)s
    """

    SET_LT_SCHEMA_READY = """
        UPDATE security.sales_enquiry SET bu_schema_ready_at = now() WHERE id = %(id)s
    """

    # Approval of a returning applicant (Step 6): the new BU joins their existing login as
    # Manager. One row for this BU only; the user's roles in other BUs are left as they are.
    INSERT_LT_USER_BU_ROLE = """
        INSERT INTO security.user_bu_role (user_id, bu_id, role_id)
        VALUES (%(user_id)s, %(bu_id)s, %(role_id)s)
        ON CONFLICT DO NOTHING
    """

    SET_LT_USER = """
        UPDATE security.sales_enquiry
        SET user_id = %(user_id)s, login_email_sent = %(login_email_sent)s
        WHERE id = %(id)s
    """

    FINISH_LT_APPROVAL = """
        UPDATE security.sales_enquiry
        SET status = 'approved', reviewed_by = %(by)s, reviewed_at = now(),
            processing_started_at = NULL
        WHERE id = %(id)s AND status = 'pending'
        RETURNING id
    """

    # Only while pending and before any BU exists; the claim must not be held by an approval.
    REJECT_LT_ENQUIRY = """
        UPDATE security.sales_enquiry
        SET status = 'rejected', rejection_reason = %(reason)s, reviewed_by = %(by)s,
            reviewed_at = now()
        WHERE id = %(id)s AND status = 'pending' AND bu_id IS NULL
          AND (processing_started_at IS NULL OR processing_started_at < now() - interval '10 minutes')
        RETURNING *
    """

    # Admin → Enquiries → Delete: only a rejected request, which never has a BU or user.
    DELETE_LT_ENQUIRY = """
        DELETE FROM security.sales_enquiry
        WHERE id = %(id)s AND status = 'rejected' AND bu_id IS NULL AND user_id IS NULL
        RETURNING id, reference, business_name
    """

    # The plan fields on the new BU (security schema of the BU's database).
    SET_BU_PLAN = """
        UPDATE security.bu
        SET plan_code = %(plan_code)s, branch_limit = %(branch_limit)s,
            job_limit_monthly = %(job_limit_monthly)s, whatsapp_limit_monthly = %(whatsapp_limit_monthly)s,
            billing_required = %(billing_required)s, monthly_fee_paise = %(monthly_fee_paise)s,
            paid_through = NULL, updated_at = now()
        WHERE id = %(bu_id)s
    """

    GET_BU_BY_ID = """
        SELECT id, code, name, plan_code FROM security.bu WHERE id = %(id)s
    """

    # Run in the new BU schema: the applicant's city (and GSTIN, if given) on the head office
    # and on its default division Main (plans/plan2.md). Two statements: psycopg cannot send
    # several parameterised statements at once.
    # The applicant's city and state on the new BU's head office. GSTIN is not set here: the
    # branch has no gstin column (it lives only on the division since the branch GSTIN drop).
    # An unknown or missing state keeps the branch's existing state.
    SET_HEAD_OFFICE_CITY_GSTIN = """
        UPDATE branch
        SET city = %(city)s,
            state_id = COALESCE((SELECT id FROM state WHERE LOWER(name) = LOWER(%(state)s)), state_id),
            updated_at = now()
        WHERE code = 'HO'
    """

    SET_MAIN_DIVISION_CITY_GSTIN = """
        UPDATE division
        SET city = %(city)s, gstin = COALESCE(%(gstin)s, gstin),
            state_id = COALESCE((SELECT id FROM state WHERE LOWER(name) = LOWER(%(state)s)), state_id),
            updated_at = now()
        WHERE is_default AND branch_id = (SELECT id FROM branch WHERE code = 'HO')
    """

    # ── Enterprise (Step 10). Control plane, public schema — run with db_name=None. ──

    GET_ENT_ENQUIRY = """
        SELECT * FROM public.sales_enquiry WHERE id = %(id)s AND plan_code = 'enterprise'
    """

    MARK_ENT_CONTACTED = """
        UPDATE public.sales_enquiry
        SET status = 'contacted', reviewed_by = %(by)s, reviewed_at = now()
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status = 'new'
        RETURNING id
    """

    # The setup fee can be set while the payment is still outstanding.
    SET_ENT_FEE = """
        UPDATE public.sales_enquiry
        SET setup_fee_paise = %(setup_fee_paise)s
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status IN ('new', 'contacted')
          AND payment_status IN ('pending', 'failed')
        RETURNING id
    """

    RECORD_ENT_PAYMENT = """
        UPDATE public.sales_enquiry
        SET payment_status = 'received', payment_amount_paise = %(amount_paise)s,
            payment_mode = %(mode)s, payment_reference = %(reference)s,
            payment_received_on = %(received_on)s, payment_recorded_by = %(by)s,
            payment_recorded_at = now(), payment_note = %(note)s
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status IN ('new', 'contacted')
          AND payment_status IN ('pending', 'failed')
        RETURNING id
    """

    MARK_ENT_PAYMENT_FAILED = """
        UPDATE public.sales_enquiry
        SET payment_status = 'failed', payment_note = %(note)s, payment_recorded_by = %(by)s,
            payment_recorded_at = now()
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status IN ('new', 'contacted')
          AND payment_status IN ('pending', 'failed')
        RETURNING id
    """

    CLAIM_ENT_ENQUIRY = """
        UPDATE public.sales_enquiry
        SET processing_started_at = now()
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status IN ('new', 'contacted')
          AND (processing_started_at IS NULL OR processing_started_at < now() - interval '10 minutes')
        RETURNING *
    """

    RELEASE_ENT_CLAIM = """
        UPDATE public.sales_enquiry SET processing_started_at = NULL WHERE id = %(id)s
    """

    # Step 2 of provisioning: the client row and the enquiry's client_id, one transaction.
    INSERT_ENT_CLIENT = """
        INSERT INTO public.client (code, name, email, phone, city, gstin, is_active)
        VALUES (%(code)s, %(name)s, %(email)s, %(phone)s, %(city)s, %(gstin)s, true)
        RETURNING id
    """

    SET_ENT_CLIENT = """
        UPDATE public.sales_enquiry SET client_id = %(client_id)s WHERE id = %(id)s
    """

    CHECK_DB_NAME_USED = """
        SELECT 1 AS found FROM public.client WHERE db_name = %(db_name)s
    """

    GET_CLIENT_BY_ID = """
        SELECT id, code, name, db_name FROM public.client WHERE id = %(id)s
    """

    SET_ENT_BU = """
        UPDATE public.sales_enquiry SET bu_id = %(bu_id)s WHERE id = %(id)s
    """

    SET_ENT_SCHEMA_READY = """
        UPDATE public.sales_enquiry SET bu_schema_ready_at = now() WHERE id = %(id)s
    """

    SET_ENT_USER = """
        UPDATE public.sales_enquiry
        SET user_id = %(user_id)s, login_email_sent = %(login_email_sent)s
        WHERE id = %(id)s
    """

    FINISH_ENT_PROVISIONING = """
        UPDATE public.sales_enquiry
        SET status = 'converted', reviewed_by = %(by)s, reviewed_at = now(),
            processing_started_at = NULL
        WHERE id = %(id)s AND status IN ('new', 'contacted')
        RETURNING id
    """

    # Super Admin → Enquiries → Delete: only a rejected enquiry, which never has a client.
    DELETE_ENT_ENQUIRY = """
        DELETE FROM public.sales_enquiry
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status = 'rejected' AND client_id IS NULL
        RETURNING id, reference, business_name
    """

    REJECT_ENT_ENQUIRY = """
        UPDATE public.sales_enquiry
        SET status = 'rejected', rejection_reason = %(reason)s, reviewed_by = %(by)s,
            reviewed_at = now()
        WHERE id = %(id)s AND plan_code = 'enterprise' AND status IN ('new', 'contacted')
          AND client_id IS NULL
          AND (processing_started_at IS NULL OR processing_started_at < now() - interval '10 minutes')
        RETURNING *
    """

    # In the new client database: its first BU, looked up by code on a resumed provisioning.
    GET_BU_BY_CODE = """
        SELECT id, code, name FROM security.bu WHERE code = %(code)s
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
        -- Deleting a BU keeps the request and only clears its link (as for user_id below).
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_bu_id_fkey
            FOREIGN KEY (bu_id) REFERENCES security.bu (id) ON DELETE SET NULL;

        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_user_id_fkey;
        -- Deleting the login user an approved sign-up created keeps the request (reference,
        -- email, approval history) and only clears its link to the user.
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES security."user" (id) ON DELETE SET NULL;
        """
        + _PAYMENT_CONSTRAINTS.format(table="security.sales_enquiry", not_valid="")
        + """
        CREATE UNIQUE INDEX IF NOT EXISTS sales_enquiry_reference_key
            ON security.sales_enquiry (reference);
        -- A request is a new BU ('signup') or a Lite BU's move to Basic / Standard ('upgrade',
        -- of upgrade_bu_id). An upgrade row carries that BU's code and name.
        ALTER TABLE security.sales_enquiry
            ADD COLUMN IF NOT EXISTS kind text DEFAULT 'signup' NOT NULL,
            ADD COLUMN IF NOT EXISTS upgrade_bu_id bigint;
        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_kind_check;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_kind_check
            CHECK ((kind = 'signup' AND upgrade_bu_id IS NULL) OR (kind = 'upgrade' AND plan_code IN ('basic', 'standard')));
        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_upgrade_bu_id_fkey;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_upgrade_bu_id_fkey
            FOREIGN KEY (upgrade_bu_id) REFERENCES security.bu (id) ON DELETE SET NULL;

        -- One pending request per email; approved or rejected ones never block a new one, and
        -- mobile is only a contact field (plans/plan.md Step 2). Dropped and recreated so an
        -- older definition is replaced. An upgrade reuses its BU's code, so only sign-ups
        -- reserve a BU code.
        DROP INDEX IF EXISTS security.sales_enquiry_open_mobile_key;
        DROP INDEX IF EXISTS security.sales_enquiry_open_email_key;
        CREATE UNIQUE INDEX sales_enquiry_open_email_key
            ON security.sales_enquiry (lower(email)) WHERE status = 'pending';
        DROP INDEX IF EXISTS security.sales_enquiry_open_bu_code_key;
        CREATE UNIQUE INDEX sales_enquiry_open_bu_code_key
            ON security.sales_enquiry (bu_code) WHERE status IN ('pending', 'approved') AND kind = 'signup';

        -- The existing login whose email the applicant proved by OTP; display only, approval
        -- looks the user up again by email.
        ALTER TABLE security.sales_enquiry ADD COLUMN IF NOT EXISTS existing_user_id bigint;
        ALTER TABLE security.sales_enquiry DROP CONSTRAINT IF EXISTS sales_enquiry_existing_user_id_fkey;
        ALTER TABLE security.sales_enquiry ADD CONSTRAINT sales_enquiry_existing_user_id_fkey
            FOREIGN KEY (existing_user_id) REFERENCES security."user" (id) ON DELETE SET NULL;

        -- One row per email waiting for its sign-up code: the checked form, the code's HMAC
        -- hash (never the code), and the counters behind the expiry, try and resend limits.
        CREATE TABLE IF NOT EXISTS security.signup_otp (
            email text PRIMARY KEY CHECK (email = lower(email)),
            code_hash text NOT NULL,
            payload jsonb NOT NULL,
            expires_at timestamp with time zone NOT NULL,
            attempts integer DEFAULT 0 NOT NULL CHECK (attempts >= 0),
            sent_count integer DEFAULT 1 NOT NULL CHECK (sent_count >= 1),
            first_sent_at timestamp with time zone DEFAULT now() NOT NULL,
            last_sent_at timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS signup_otp_last_sent_at_idx ON security.signup_otp (last_sent_at);
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
