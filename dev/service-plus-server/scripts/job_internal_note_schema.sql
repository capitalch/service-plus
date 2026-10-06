-- Internal notes on jobs — table (plans/plan.md, Step 1).
--
-- Creates table job_internal_note: one row per note on a job. Staff only — never
-- printed, never sent to the customer. Written only by the addJobInternalNote /
-- updateJobInternalNote / deleteJobInternalNote mutations (the table is refused to
-- genericUpdate), so created_by / updated_by always come from the session.
--
-- Idempotent: safe to run more than once. Run once per BU schema, including the
-- `demo1` TEMPLATE schema. scripts/run_job_internal_note_ddl.py does that for every
-- tenant and also adds the JOBS_INTERNAL_NOTES_MANAGE access right.
--
-- No BEGIN/COMMIT in this file — the runner supplies the transaction. With psql:
--   psql "<conn>" -1 -v ON_ERROR_STOP=1 -c "SET search_path TO demo1;" -f scripts/job_internal_note_schema.sql
--
-- Afterwards (demo1 only) regenerate the schema dump and BU_SCHEMA_DDL — never by hand.

CREATE TABLE IF NOT EXISTS job_internal_note (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    job_id          bigint NOT NULL,
    note            text   NOT NULL,
    created_by      bigint NOT NULL,          -- security."user".id, from the session
    created_by_name text,                     -- stamped server-side
    created_at      timestamp with time zone DEFAULT now() NOT NULL,
    updated_by      bigint,                   -- NULL = never edited
    updated_by_name text,
    updated_at      timestamp with time zone,
    CONSTRAINT job_internal_note_pkey PRIMARY KEY (id),
    CONSTRAINT job_internal_note_job_fkey FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE,
    CONSTRAINT job_internal_note_note_chk CHECK (char_length(btrim(note)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS job_internal_note_job_id_idx ON job_internal_note (job_id, created_at);
