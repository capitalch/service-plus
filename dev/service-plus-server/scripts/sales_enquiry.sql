-- Sales enquiries from the service-plus-portal pricing page (POST /api/public/sales-enquiry).
--
-- Creates, in the `public` schema of the **service_plus_client** database (the tenant
-- registry — not a tenant DB, not a BU schema):
--   - table sales_enquiry   one row per enquiry; `status` is for the future super-admin
--                           enquiries grid (new → contacted → converted | rejected)
--
-- No triggers by design. There is no updated_at column; add one together with the code that
-- updates rows (the future grid), and have that UPDATE set it explicitly.
--
-- Idempotent: safe to run more than once.
--
-- No BEGIN/COMMIT in this file — the runner supplies the transaction:
--   psql "<service_plus_client conn>" -1 -v ON_ERROR_STOP=1 -f scripts/sales_enquiry.sql
--
-- Afterwards regenerate app/db/schema_dumps/service_plus_client.sql (scripts/extract_schema.sh)
-- and, in service-plus-client, src/types/db-schema-client.ts (pnpm gen-types-client) — never by hand.

CREATE TABLE IF NOT EXISTS public.sales_enquiry (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_code text NOT NULL,
    name text NOT NULL,
    business_name text NOT NULL,
    mobile text NOT NULL,
    email text NOT NULL,
    city text NOT NULL,
    gstin text,
    branches integer DEFAULT 1 NOT NULL,
    message text,
    status text DEFAULT 'new' NOT NULL,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_enquiry_plan_code_check CHECK (plan_code IN ('lite', 'basic', 'standard', 'enterprise')),
    CONSTRAINT sales_enquiry_status_check CHECK (status IN ('new', 'contacted', 'converted', 'rejected')),
    CONSTRAINT sales_enquiry_branches_check CHECK (branches BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS sales_enquiry_status_idx ON public.sales_enquiry USING btree (status);
CREATE INDEX IF NOT EXISTS sales_enquiry_created_at_idx ON public.sales_enquiry USING btree (created_at DESC);
