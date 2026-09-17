-- Branch restriction on a user (plans/plan.md, Step 6). One row per branch a user is
-- allowed to work in, within one of their BU assignments. No rows for a (user_id, bu_id)
-- pair = unrestricted (every branch in that BU) — the default, and what every existing
-- user already effectively has today.
--
-- branch_id is a SOFT reference: branches live inside each BU's own schema (named after
-- security.bu.code), not in this `security` schema, so Postgres cannot enforce that FK
-- directly. Application code must check a branch_id actually belongs to the BU it's being
-- attached to before inserting here — see resolve_create_business_user_helper /
-- resolve_set_user_bu_role_helper.
--
-- Run ONCE per tenant database, against its `security` schema:
--   psql "<tenant conn>" -1 -v ON_ERROR_STOP=1 -c "SET search_path TO security;" \
--       -f scripts/user_bu_role_branch_schema.sql
--
-- Idempotent: safe to run more than once.
--
-- Afterwards, regenerate app/db/schema_dumps/service_plus_service.sql and
-- app/db/sql/sql_bu_admin_ddl.py — never by hand.

CREATE TABLE IF NOT EXISTS user_bu_role_branch (
    user_id    bigint NOT NULL,
    bu_id      bigint NOT NULL,
    branch_id  bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_bu_role_branch_pkey PRIMARY KEY (user_id, bu_id, branch_id)
);

-- Cascades on the (user_id, bu_id) pair: resolve_set_user_bu_role_helper deletes and
-- reinserts user_bu_role rows wholesale, so a branch restriction disappears cleanly
-- when its underlying BU assignment does, without a second DELETE in application code.
ALTER TABLE user_bu_role_branch DROP CONSTRAINT IF EXISTS user_bu_role_branch_user_bu_fkey;
ALTER TABLE user_bu_role_branch ADD CONSTRAINT user_bu_role_branch_user_bu_fkey
    FOREIGN KEY (user_id, bu_id) REFERENCES user_bu_role(user_id, bu_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_bu_role_branch_user_bu_idx
    ON user_bu_role_branch (user_id, bu_id);
