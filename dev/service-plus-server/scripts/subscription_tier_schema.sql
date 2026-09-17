-- Subscription tiers (plans/plan.md, Step 2) — Basic / Pro / Enterprise on the client
-- (tenant) registry. Run ONCE against the service_plus_client database (there is only
-- one), not per tenant — public.client is the shared tenant registry, not a per-tenant
-- table.
--
-- Idempotent: safe to run more than once.
--
-- No BEGIN/COMMIT in this file — run with psql -1 (single transaction):
--   psql "<service_plus_client conn>" -1 -v ON_ERROR_STOP=1 -f scripts/subscription_tier_schema.sql
--
-- Afterwards, regenerate app/db/schema_dumps/service_plus_client.sql — never by hand.

ALTER TABLE public.client
    ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'BASIC';

ALTER TABLE public.client DROP CONSTRAINT IF EXISTS client_subscription_tier_chk;
ALTER TABLE public.client ADD CONSTRAINT client_subscription_tier_chk
    CHECK (subscription_tier IN ('BASIC', 'PRO', 'ENTERPRISE'));
