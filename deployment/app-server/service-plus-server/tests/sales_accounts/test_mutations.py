"""
Smoke test for the Step 4 resolver split: sales_accounts/mutations.py.

resolve_create_sales_invoice_helper claims a real SALES_INVOICE sequence number
and inserts a real sales_invoice row (+ nested lines/stock_transactions) on a
client DB. Skipped by default so importing/running this test suite never
mutates real client data — see plans/plan.md Step 6.2.

To actually exercise this against a disposable dev DB, remove the skip mark,
set _DEV_CLIENT_DB below to a throwaway client database, and supply real
branch_id/division_id/customer_id/part ids from that DB's masters tables.
"""
import json
from urllib.parse import quote

import pytest

from app.graphql.resolvers.sales_accounts.mutations import resolve_create_sales_invoice_helper

_DEV_CLIENT_DB = "service_plus_demo"


@pytest.mark.skip(
    reason="Mutates real sales_invoice rows and claims a real sequence number "
    "in a shared dev DB — enable explicitly against a disposable DB only."
)
@pytest.mark.asyncio
async def test_create_sales_invoice_claims_number_and_inserts_row():
    payload = {
        "branch_id": 1,
        "division_id": 1,
        "xData": {
            "customer_id": 1,
            "invoice_date": "2026-01-01",
            "xDetails": {
                "tableName": "sales_invoice_line",
                "xData": [{"part_id": 1, "qty": 1, "rate": 100}],
            },
        },
    }
    value = quote(json.dumps(payload))

    invoice_id = await resolve_create_sales_invoice_helper(_DEV_CLIENT_DB, "public", value)

    assert invoice_id is not None
