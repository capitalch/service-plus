# Plan: Secure service-plus ↔ trace-plus Communication via Pre-shared API Key

## Decision

Replace the `superAdmin` username/password used by service-plus-server for accounts posting with a
**pre-shared API key** sent as an `X-Service-Key` header — the same pattern already in use between
service-plus-server and service-plus-file-server. This is Option A from the alternatives analysis.

**Why Option A over the original service-account (DB user) plan:**
- No trace-plus DB user, role, or secured-control setup required.
- No login roundtrip per posting run — one fewer network call, no token expiry mid-run.
- The file-server pattern is already proven in the codebase and ops team understands it.
- Same shared key is reused → single rotation point for both file-server and trace-plus integrations.

---

## Current State

`service-plus-server/app/graphql/resolvers/mutation_helper.py`

```
_get_trace_plus_token()   (~line 2029)  POST /api/login  →  accessToken
_post_tran_h_to_trace_plus() (~line 2377)  POST /graphql/   Authorization: Bearer <token>
resolve_accounts_posting_helper()  (~line 2421)  calls token fn once, loops over vouchers
```

`service-plus-server/app/config.py` (lines 125–174)
- `trace_plus_url` (dev: `http://localhost:8001`, prod: `http://192.168.14.60`)
- `trace_plus_super_admin_uid` (default `superAdmin`)
- `trace_plus_super_admin_password` (default `superadmin@123`)

File-server key (existing, reuse for trace-plus):
- Value: `5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6`
- Defined in: `service-plus-server/app/config.py` line ~34 and `service-plus-file-server/.env` line 3

---

## Target State

```
service-plus-server
  → POST {trace_plus_url}/internal/accounts-posting
    X-Service-Key: <shared_key>
    body: { clientCode, buCode, data: TranH }
  ← 200 OK  |  401 Unauthorized
```

No login call. No token management. No expiry risk.

---

## Implementation

### Step 1 — trace-plus-server: add config field

**File:** `trace-server/app/config.py`

Add one field to the `Settings` class:
```python
service_plus_api_key: str = Field(
    default="5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6",
    description="Pre-shared key for service-plus → trace-plus internal calls (X-Service-Key header)"
)
```
`SettingsConfigDict` already loads from `.env`, so set `SERVICE_PLUS_API_KEY` in each environment's
`.env` to override the default.

---

### Step 2 — trace-plus-server: key-validation dependency

**New file:** `trace-server/app/internal/internal_router.py`

```python
from fastapi import APIRouter, Header, HTTPException, Depends, Request
from app.config import settings

router = APIRouter(prefix="/internal", tags=["internal"])

def _verify_service_key(x_service_key: str = Header(..., alias="X-Service-Key")):
    if x_service_key != settings.service_plus_api_key:
        raise HTTPException(status_code=401, detail="Invalid service key")

@router.post("/accounts-posting")
async def accounts_posting(request: Request, _=Depends(_verify_service_key)):
    body = await request.json()
    # delegate to existing helper — import path may differ, adjust as needed
    from app.graphql.graphql_helper import accounts_posting_helper
    result = await accounts_posting_helper(body)
    return result
```

If `accounts_posting_helper` expects a specific argument shape (it receives `clientCode`, `buCode`,
`data` today from the GraphQL resolver), pass `body` or unpack it to match. No logic changes to
the helper itself.

---

### Step 3 — trace-plus-server: register the router

**File:** `trace-server/app/main.py`

```python
from app.internal.internal_router import router as internal_router
app.include_router(internal_router)
```

Add this alongside the existing router registrations. The `/internal/accounts-posting` route is
now live and key-protected. The existing `/graphql/` and `/api/login` routes are untouched.

---

### Step 4 — service-plus-server: add config field

**File:** `service-plus-server/app/config.py`

Add one field (keep old `trace_plus_super_admin_*` fields for rollback during transition):
```python
trace_plus_service_key: str = Field(
    default="5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6",
    description="Pre-shared key sent as X-Service-Key to trace-plus internal endpoint"
)
```

---

### Step 5 — service-plus-server: update mutation_helper.py

**File:** `service-plus-server/app/graphql/resolvers/mutation_helper.py`

**a) Remove `_get_trace_plus_token()`** — the function is no longer needed. Either delete it or
leave it commented for rollback reference.

**b) Update `_post_tran_h_to_trace_plus()`** (~line 2377):

Before:
```python
async def _post_tran_h_to_trace_plus(http_client, token: str, gql_body: dict) -> dict:
    resp = await http_client.post(
        f"{settings.trace_plus_url}/graphql/",
        json=gql_body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30.0,
    )
```

After:
```python
async def _post_tran_h_to_trace_plus(http_client, gql_body: dict) -> dict:
    resp = await http_client.post(
        f"{settings.trace_plus_url}/internal/accounts-posting",
        json=gql_body,
        headers={"X-Service-Key": settings.trace_plus_service_key},
        timeout=30.0,
    )
```

The `gql_body` dict (containing `clientCode`, `buCode`, `data`) is sent as-is to the new endpoint;
trace-plus's handler unpacks it the same way it did from the GraphQL mutation value.

**c) Update `resolve_accounts_posting_helper()`** (~line 2421):

Remove the `_get_trace_plus_token()` call and the `token` variable. Remove `token` from all
`_post_tran_h_to_trace_plus(...)` call sites within the loop.

Before:
```python
token = await _get_trace_plus_token()
...
result = await _post_tran_h_to_trace_plus(http_client, token, gql_body)
```

After:
```python
# no token call
...
result = await _post_tran_h_to_trace_plus(http_client, gql_body)
```

---

## Files Changed

| Repo | File | Action |
|------|------|--------|
| trace-plus | `trace-server/app/config.py` | Add `service_plus_api_key` field |
| trace-plus | `trace-server/app/internal/__init__.py` | Create (empty) |
| trace-plus | `trace-server/app/internal/internal_router.py` | New — route + key dependency |
| trace-plus | `trace-server/app/main.py` | Register `internal_router` |
| service-plus | `service-plus-server/app/config.py` | Add `trace_plus_service_key` field |
| service-plus | `service-plus-server/app/graphql/resolvers/mutation_helper.py` | Remove token login; update `_post_tran_h_to_trace_plus`; remove token from `resolve_accounts_posting_helper` |

---

## Environment Variables

| Service | Env var | Value (non-prod default) |
|---------|---------|--------------------------|
| trace-plus | `SERVICE_PLUS_API_KEY` | `5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6` |
| service-plus | `TRACE_PLUS_SERVICE_KEY` | `5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6` |

Both `.env` files already have `FILE_SERVER_API_KEY` with this value — the same key, just a new
variable name pointing to the same string. In production, rotate all three together.

---

## Rollout Order

1. Deploy trace-plus changes (Steps 1–3) first — the new endpoint is additive, nothing breaks.
2. Deploy service-plus changes (Steps 4–5) — switches posting to the new endpoint.
3. Smoke test (see Verification below).
4. Once stable, remove `trace_plus_super_admin_uid` / `trace_plus_super_admin_password` from
   service-plus config and the `_get_trace_plus_token()` function.

---

## Verification

1. **Key validation** — send a request to `/internal/accounts-posting` with a wrong key; confirm
   trace-plus returns `401`. Send with the correct key; confirm the handler is reached.

2. **Integration** — trigger accounts posting from service-plus for a branch that has unposted
   money receipts or invoices; confirm:
   - No login call appears in trace-plus logs.
   - Vouchers appear in trace-plus.
   - `is_posted = true` is set in the service-plus DB.

3. **End-to-end UI** — open `accounts-posting-section.tsx`, click "Post to Trace Plus"; verify
   live WebSocket progress events, success toast, and that rows are marked posted in the grid.

4. **Negative** — set `TRACE_PLUS_SERVICE_KEY` to a wrong value; confirm posting fails with a
   clear error logged (not a silent skip) and the progress event reflects failure.
