"""Internal notes on jobs — server-only writes (plans/plan.md, Step 3).

`job_internal_note` holds staff-only notes: never printed, never sent to the customer.
The one read the browser runs, GET_JOB_INTERNAL_NOTES, lives in JobsSql (sql_jobs.py).

- `JobInternalNoteServerSql` — the three writes. Deliberately NOT in SqlStore: genericQuery
  runs any SqlStore constant by sqlId, so a write placed there could be called straight
  from the browser and skip the JOBS_INTERNAL_NOTES_MANAGE check on edit / delete. The
  table is also refused to genericUpdate (SECURITY_SERVER_ONLY_TABLES), so these
  statements, reached only through the addJobInternalNote / updateJobInternalNote /
  deleteJobInternalNote mutations, are the only way to write it.

Every statement checks that the job is in the caller's branch; no row back means the
job or note is not there. Author / editor ids and names come from the session.
"""


class JobInternalNoteServerSql:
    """Internal-note writes. Never composed into SqlStore."""

    ADD_JOB_INTERNAL_NOTE = """
        INSERT INTO job_internal_note (job_id, note, created_by, created_by_name)
        SELECT j.id, %(note)s::text, %(by)s::bigint, %(by_name)s::text
        FROM job j
        WHERE j.id = %(job_id)s::bigint AND j.branch_id = %(branch_id)s::bigint
        RETURNING id, created_at
    """

    UPDATE_JOB_INTERNAL_NOTE = """
        UPDATE job_internal_note n
        SET note = %(note)s::text,
            updated_by = %(by)s::bigint,
            updated_by_name = %(by_name)s::text,
            updated_at = now()
        FROM job j
        WHERE n.id = %(id)s::bigint AND n.job_id = j.id AND j.branch_id = %(branch_id)s::bigint
        RETURNING n.id, n.updated_at
    """

    DELETE_JOB_INTERNAL_NOTE = """
        DELETE FROM job_internal_note n
        USING job j
        WHERE n.id = %(id)s::bigint AND n.job_id = j.id AND j.branch_id = %(branch_id)s::bigint
        RETURNING n.id
    """
