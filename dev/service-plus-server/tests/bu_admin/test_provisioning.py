"""
Smoke test for the Step 4 resolver split: bu_admin/users_roles.py.

resolve_create_admin_user_helper inserts a real security.user row and sends a
real password-reset email via SMTP. Skipped by default so importing/running
this test suite never creates real admin accounts or sends real email — see
plans/plan.md Step 6.2.

To actually exercise this against a disposable dev DB, remove the skip mark,
set _DEV_CLIENT_DB below to a throwaway client database, and use an email
address you control.
"""
import json
from urllib.parse import quote

import pytest

from app.graphql.resolvers.bu_admin.users_roles import resolve_create_admin_user_helper

_DEV_CLIENT_DB = "service_plus_demo"


@pytest.mark.skip(
    reason="Creates a real security.user row and sends a real reset-link email — "
    "enable explicitly against a disposable DB/inbox only."
)
@pytest.mark.asyncio
async def test_create_admin_user_creates_row_and_sends_email():
    payload = {
        "client_id": 1,
        "email": "test-admin@example.com",
        "full_name": "Test Admin",
        "mobile": "9999999999",
        "username": "test_admin_smoke",
    }
    value = quote(json.dumps(payload))

    result = await resolve_create_admin_user_helper(
        _DEV_CLIENT_DB, "security", value, request=None
    )

    assert "id" in result
