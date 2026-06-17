# Plan: Money Receipt Accounts Posting (Service-Plus → Trace-Plus)

**Chain:** Client → service-plus-server `accountsPosting` → trace-plus-server `accountsPosting` → trace-plus `validateDebitCreditAndUpdate`

Client sends only `divisionCode`. Server fetches one unposted receipt and posts it to Trace-Plus (test mode — one row at a time).

---

## Step 1 ✅ — Client: add GQL mutation constant
**File:** `service-plus-client/src/constants/graphql-map.ts`

Add after `undoJobTransaction`:
```ts
accountsPosting: gql`
    mutation AccountsPosting($db_name: String!, $schema: String, $value: String!) {
        accountsPosting(db_name: $db_name, schema: $schema, value: $value)
    }
`,
```
**Done.**

---

## Step 2 ✅ — Client: wire "Accounts Posting" button
**File:** `service-plus-client/src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx`

- Added imports, selectors (`dbName`, `schema`, `division`), `posting` state.
- Added `handleAccountsPosting` — sends `{ divisionCode: division.code }` only.
- Added "Accounts Posting" button in the page header (top-right) with spinner and disabled state.

**Done.**

---

## Step 3 — trace-plus-server: add SQL
**File:** `trace-plus/dev/trace-server/app/graphql/db/sql_security.py`

Add inside the `Sql` class:
```python
get_client_dbname_dbparams_on_client_code = """
    SELECT "dbName", "dbParams"
    FROM "ClientM"
    WHERE lower("clientCode") = lower(%(clientCode)s)
    LIMIT 1
"""
```

---

## Step 4 — trace-plus-server: add `accounts_posting_helper`
**File:** `trace-plus/dev/trace-server/app/graphql/graphql_helper.py`

Add at top of file (if not already imported): `from urllib.parse import quote`

Add the helper function:
```python
async def accounts_posting_helper(info, value: str):
    try:
        value_str  = unquote(value)
        value_dict = json.loads(value_str)

        client_code = value_dict.get("clientCode", "")
        bu_code     = value_dict.get("buCode", "")
        data        = value_dict.get("data", {})

        if not client_code or not bu_code or not data:
            raise AppHttpException(
                message="Error",
                detail="clientCode, buCode and data are required",
                error_code="e1031",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        from app.graphql.db.sql_security import Sql as SqlSecurity
        from app.graphql.db.psycopg_async_helper import exec_sql

        rows = await exec_sql(
            dbName=Config.DB_NAME,  # 'traceAuth'
            sql=SqlSecurity.get_client_dbname_dbparams_on_client_code,
            sqlArgs={"clientCode": client_code},
        )
        if not rows:
            raise AppHttpException(
                message="Error",
                detail=f"Client '{client_code}' not found in ClientM",
                error_code="e1032",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        db_name   = rows[0]["dbName"]
        db_params = rows[0]["dbParams"]  # plain dict stored in DB

        encrypted_conn   = encrypt(json.dumps(db_params))
        data["dbParams"] = {"conn": encrypted_conn}
        data["buCode"]   = bu_code

        encoded_value = quote(json.dumps(data))
        return await validate_debit_credit_and_update_helper(info, db_name, encoded_value)

    except Exception as e:
        return create_graphql_exception(e)
```

---

## Step 5 — trace-plus-server: register resolver
**File:** `trace-plus/dev/trace-server/app/graphql/graphql_router.py`

Import:
```python
from app.graphql.graphql_helper import (
    ...
    accounts_posting_helper,   # add this
)
```

Add resolver (before `schema = make_executable_schema(...)`):
```python
@mutation.field("accountsPosting")
async def accounts_posting(_, info, value=""):
    return await accounts_posting_helper(info, value)
```

---

## Step 6 — trace-plus-server: add to GraphQL schema
**File:** `trace-plus/dev/trace-server/app/graphql/mutation.graphql`

Add inside `type Mutation`:
```graphql
accountsPosting(value: Generic): Generic
```

---

## Step 7 — service-plus-server: add SQL
**File:** `service-plus/dev/service-plus-server/app/db/sql_store.py`

Add inside the `SqlStore` class:
```python
GET_DIVISION_ACCOUNT_SETTING_BY_CODE = """
    WITH "p_code" AS (VALUES(%(code)s::text))
    SELECT d.id, d.branch_id, d.account_setting
    FROM division d
    WHERE LOWER(d.code) = LOWER((TABLE "p_code"))
    LIMIT 1
"""

GET_ONE_UNPOSTED_MONEY_RECEIPT = """
    WITH "p_division_code" AS (VALUES(%(division_code)s::text))
    SELECT
        jp.id,
        jp.job_id,
        j.job_no,
        jp.receipt_no,
        jp.payment_date,
        jp.payment_mode,
        jp.amount,
        jp.reference_no,
        jp.remarks,
        j.branch_id,
        cc.full_name AS customer_name
    FROM job_payment jp
    JOIN job j ON j.id = jp.job_id
    JOIN division d ON d.id = j.division_id
    LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
    WHERE LOWER(d.code) = LOWER((TABLE "p_division_code"))
      AND jp.is_posted = false
    ORDER BY jp.payment_date ASC, jp.id ASC
    LIMIT 1
"""
```

---

## Step 8 — service-plus-server: add trace-plus config
**File:** `service-plus/dev/service-plus-server/app/config.py`

Add to the `Settings` class:
```python
trace_plus_url: str = Field(
    default="http://localhost:8001",
    description="Base URL of trace-plus-server (no trailing slash)",
)
trace_plus_super_admin_uid: str = Field(
    default="superAdmin",
    description="Trace-plus superAdmin username for service-to-service auth",
)
trace_plus_super_admin_password: str = Field(
    default="superadmin@123",
    description="Trace-plus superAdmin password for service-to-service auth",
)
```

---

## Step 9 — service-plus-server: add `resolve_accounts_posting_helper`
**File:** `service-plus/dev/service-plus-server/app/graphql/resolvers/mutation_helper.py`

Ensure `httpx` is installed (`pip install httpx` / add to requirements).

Add imports at the top of the file:
```python
import httpx
from datetime import date
```

Add the two functions at the end of the file:
```python
async def _get_trace_plus_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.trace_plus_url}/api/login",
            data={
                "username": settings.trace_plus_super_admin_uid,
                "password": settings.trace_plus_super_admin_password,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        body = resp.json()
        return body.get("token") or body.get("access_token", "")


async def resolve_accounts_posting_helper(db_name: str, schema: str, value: str) -> dict:
    import json
    from urllib.parse import quote

    payload = _decode_value(value, "accountsPosting")
    division_code = payload.get("divisionCode", "").strip()

    if not division_code:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "divisionCode"},
        )

    # 1. Get division account_setting
    rows = await exec_sql(
        db_name=db_name, schema=schema,
        sql=SqlStore.GET_DIVISION_ACCOUNT_SETTING_BY_CODE,
        sql_args={"code": division_code},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"detail": f"Division '{division_code}' not found"},
        )
    account_setting   = rows[0].get("account_setting") or {}
    client_code       = account_setting.get("clientCode", "")
    bu_code           = account_setting.get("buCode", "")
    debit_account_id  = account_setting.get("receipt", {}).get("debitAccountId")
    credit_account_id = account_setting.get("receipt", {}).get("creditAccountId")

    if not client_code or not bu_code or not debit_account_id or not credit_account_id:
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Division account_setting is incomplete"},
        )

    # 2. Fetch 1 unposted money receipt
    receipts = await exec_sql(
        db_name=db_name, schema=schema,
        sql=SqlStore.GET_ONE_UNPOSTED_MONEY_RECEIPT,
        sql_args={"division_code": division_code},
    )
    if not receipts:
        return {"message": "No unposted money receipts found."}
    row = _serialize_row(receipts[0])

    # 3. Build TranD lines
    # dc='C' → accId = debitAccountId;  dc='D' → accId = creditAccountId
    detail_entry_c: dict = {"accId": int(debit_account_id),  "dc": "C", "amount": row["amount"]}
    detail_entry_d: dict = {"accId": int(credit_account_id), "dc": "D", "amount": row["amount"]}
    for entry in (detail_entry_c, detail_entry_d):
        if row.get("remarks"):      entry["remarks"]   = row["remarks"]
        if row.get("receipt_no"):   entry["lineRefNo"] = row["receipt_no"]
        if row.get("reference_no"): entry["instrNo"]   = row["reference_no"]

    fin_year = int(str(row.get("payment_date", str(date.today())))[:4])

    # 4. Build TranH payload
    x_data: dict = {
        "tranDate":   row["payment_date"],
        "tranTypeId": 3,
        "finYearId":  fin_year,
        "branchId":   row["branch_id"],
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [detail_entry_c, detail_entry_d],
        }],
    }
    if row.get("receipt_no"):    x_data["userRefNo"] = row["receipt_no"]
    if row.get("customer_name"): x_data["remarks"]   = row["customer_name"]

    tran_h_payload = {
        "tableName": "TranH",
        "dbParams":  {"conn": ""},   # trace-server fills this in
        "xData":     x_data,
        "buCode":    bu_code,
    }

    # 5. Authenticate with trace-plus-server
    token = await _get_trace_plus_token()

    # 6. Call trace-plus-server accountsPosting mutation
    trace_value = quote(json.dumps({
        "clientCode": client_code,
        "buCode":     bu_code,
        "data":       tran_h_payload,
    }))
    gql_body = {
        "query": "mutation AccountsPosting($value: Generic) { accountsPosting(value: $value) }",
        "variables": {"value": trace_value},
    }
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.post(
            f"{settings.trace_plus_url}/graphql/",
            json=gql_body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        result = resp.json()

    if result.get("errors"):
        raise Exception(str(result["errors"]))

    return result.get("data", {}).get("accountsPosting", {})
```

---

## Step 10 — service-plus-server: register resolver
**File:** `service-plus/dev/service-plus-server/app/graphql/resolvers/mutation.py`

Add to imports at top:
```python
from app.graphql.resolvers.mutation_helper import (
    ...
    resolve_accounts_posting_helper,   # add this
)
```

Add resolver at the end of the file:
```python
@mutation.field("accountsPosting")
async def resolve_accounts_posting(_, info, db_name: str = "", schema: str = "public", value: str = "") -> Any:
    try:
        return await resolve_accounts_posting_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error in accountsPosting: %s", e, exc_info=True)
        raise GraphQLException(message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)})
```

---

## Step 11 — service-plus-server: add to GraphQL schema
**File:** `service-plus/dev/service-plus-server/app/graphql/schema.graphql`

Add inside `type Mutation`:
```graphql
accountsPosting(db_name: String!, schema: String, value: String!): Generic
```

---

## Step 12 — End-to-end test

1. Start trace-plus-server (port 8001).
2. Start service-plus-server (port 8000).
3. Open the client app → Jobs → Accounts Posting.
4. Select a division that has `account_setting` configured with `clientCode`, `buCode`, `debitAccountId`, `creditAccountId`.
5. Click "Accounts Posting" button.
6. Expect: success toast on client; one new `TranH` + two `TranD` rows created in the trace-plus client database.

---

## Data-Mapping Reference

| TranH field  | Source |
|---|---|
| `tranDate`   | `job_payment.payment_date` |
| `userRefNo`  | `job_payment.receipt_no` (if present) |
| `remarks`    | `customer_contact.full_name` (if present) |
| `tranTypeId` | Hard-coded `3` |
| `finYearId`  | Year part of `payment_date` |
| `branchId`   | `job.branch_id` |
| `posId`      | Hard-coded `1` |
| `buCode`     | `division.account_setting.buCode` |

| TranD field | dc=`C` | dc=`D` |
|---|---|---|
| `accId`     | `receipt.debitAccountId`  | `receipt.creditAccountId` |
| `dc`        | `"C"` | `"D"` |
| `amount`    | `job_payment.amount` | `job_payment.amount` |
| `lineRefNo` | `receipt_no` (if present) | `receipt_no` (if present) |
| `instrNo`   | `reference_no` (if present) | `reference_no` (if present) |
| `remarks`   | `job_payment.remarks` (if present) | `job_payment.remarks` (if present) |
