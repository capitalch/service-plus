"""
Smoke test for the Step 4 resolver split: jobs/mutations.py.

resolve_create_job_batch_helper writes real rows to a client DB (job, job_transaction)
and claims a real document_sequence number. Skipped by default so importing/running
this test suite never mutates real client data — see plans/plan.md Step 6.2.

To actually exercise this against a disposable dev DB, remove the skip mark, set
_DEV_CLIENT_DB below to a throwaway client database, and supply a real branch_id/
division_id from that DB's masters tables.
"""
import pytest

from app.graphql.resolvers.jobs.mutations import resolve_create_job_batch_helper

_DEV_CLIENT_DB = "service_plus_demo"


@pytest.mark.skip(
    reason="Mutates real job/job_transaction rows in a shared dev DB — "
    "enable explicitly against a disposable DB only."
)
@pytest.mark.asyncio
async def test_create_job_batch_creates_jobs_and_claims_batch_number():
    payload = {
        "sharedData": {
            "branch_id": 1,
            "division_id": 1,
            "batch_date": "2026-01-01",
            "job_receive_manner_id": 1,
            "job_status_id": 1,
        },
        "jobs": [{"job_type_id": 1, "qty": 1}],
    }
    import json
    from urllib.parse import quote

    value = quote(json.dumps(payload))

    result = await resolve_create_job_batch_helper(_DEV_CLIENT_DB, "public", value)

    assert "batch_no" in result
    assert "job_ids" in result
    assert len(result["job_ids"]) == 1
