"""
Smoke test for the Step 4 resolver split: inventory/mutations.py.

resolve_import_spare_parts_helper bulk-inserts real rows into spare_part_master
on a client DB. Skipped by default so importing/running this test suite never
mutates real client data — see plans/plan.md Step 6.2.

To actually exercise this against a disposable dev DB, remove the skip mark and
set _DEV_CLIENT_DB below to a throwaway client database.
"""
import json
from urllib.parse import quote

import pytest

from app.graphql.resolvers.inventory.mutations import resolve_import_spare_parts_helper

_DEV_CLIENT_DB = "service_plus_demo"


@pytest.mark.skip(
    reason="Bulk-inserts real spare_part_master rows in a shared dev DB — "
    "enable explicitly against a disposable DB only."
)
@pytest.mark.asyncio
async def test_import_spare_parts_bulk_inserts_records():
    parts = [
        {"code": "TEST-PART-1", "name": "Test Part 1", "brand_id": 1},
        {"code": "TEST-PART-2", "name": "Test Part 2", "brand_id": 1},
    ]
    value = quote(json.dumps(parts))

    result = await resolve_import_spare_parts_helper(_DEV_CLIENT_DB, "public", value)

    assert result == {"success_count": 2}
