# Design Document — Accounts Posting: Service-Plus to Trace-Plus

## 1. Problem Statement

Service-Plus (service jobs management) needs to post Purchase Invoices, Sales Invoices, Job Invoices, and Money Receipts to Trace-Plus (accounting software). The process must be atomic, secure, auditable, and idempotent — the `is_posted` flag in Service-Plus must flip to `true` **only after** Trace-Plus confirms a successful write.

---

## 2. Architecture Decision: Server-to-Server Relay

```
┌──────────────────────┐         ┌──────────────────────────┐         ┌──────────────────────┐
│  Service-Plus Client │  ───►   │  Service-Plus Server     │  ───►   │  Trace-Plus Server   │
│  (React + Apollo)    │  JWT    │  (FastAPI + Ariadne GQL) │  S2S    │  (FastAPI + Ariadne) │
│                      │  ◄───   │                          │  ◄───   │                      │
└──────────────────────┘         └──────────────────────────┘         └──────────────────────┘
```

**Option B (selected) — Client → Service-Plus server → Trace-Plus server**

| Criterion | Option A: Browser → Trace directly | Option B: Server relay ✓ |
|---|---|---|
| Trace credentials exposure | Exposed in browser bundle | Never leave the server |
| Auth model | Client needs two tokens | Single client JWT; server has its own service credential |
| Atomicity control | Client orchestrates both writes (hard to make atomic) | Server controls both writes in one request context |
| CORS surface | Trace must trust browser origins | Trace trusts only one known server origin |
| Failure handling | Race-prone on `is_posted` flip | Server-controlled, auditable |

---

## 3. System Context & Current State

### 3.1 Service-Plus Client (React + Vite + Apollo)

- **Accounts Posting** menu exists under client explorer panel, gated by `post_data_to_accounts` app setting.
- UI: outer tabs **Posting / Posted**, four inner entity tabs with selection grids for Purchase, Sales, Job, Money Receipts.
- Selection state: `Set<number>` per entity in React state.
- **"Post Selected" button** exists as a placeholder (currently fires a toast only).
- Data flow: grids use `GRAPHQL_MAP.genericQuery` + `SQL_MAP.*` queries; row-level `is_posted` toggle uses `GRAPHQL_MAP.genericUpdate`.
- Auth: Apollo attaches `Authorization: Bearer <accessToken>` from localStorage.

### 3.2 Service-Plus Server (FastAPI + Ariadne GraphQL)

- JWT auth via `app/core/dependencies.py` (`get_current_user`).
- GraphQL endpoint at `/graphql/` with generic `Query.genericQuery` / `Mutation.genericUpdate`.
- SQL centralized in `app/db/sql_store.py` (`SqlStore` class). DB driver: `psycopg` async.
- Audit logging: `app/core/audit_log.py`.
- Messages: centralized in `app/exceptions.py` (`AppMessages`).
- Source tables (schema `demo1`), each with `is_posted boolean DEFAULT false` + dedicated index:
  - `purchase_invoice` + `purchase_invoice_line`
  - `sales_invoice` + `sales_invoice_line`
  - `job_invoice` + `job_invoice_line`
  - `job_payment` (money receipts)

### 3.3 Trace-Plus Server (FastAPI + Ariadne GraphQL)

- **No ORM.** All data operations use raw SQL via `psycopg` async.
- GraphQL schema: `query.graphql` + `mutation.graphql` loaded by Ariadne.
- Key mutation: `validateDebitCreditAndUpdate(dbName, value)` — validates Σdebit == Σcredit, then upserts `TranH` + `TranD` + line details.
- Core accounting tables: `TranH` (header), `TranD` (debit/credit lines), `AccM` (account master), `SalePurchaseDetails`, `ExtGstTranD`.
- Transaction types (in `TranTypeM`): `4`=Sales, `5`=Purchase, `3`=Receipt, `2`=Payment.
- Auto voucher numbering: when `xData` has no `id` but has `finYearId`+`branchId`+`tranTypeId`, Trace generates `autoRefNo`.
- Schema-per-tenant: each business unit gets a PostgreSQL schema, switched via `SET search_path`.
- JWT auth currently enforced on REST routes (`securityRouter`) but **not** on the `/graphql/` endpoint — this is a gap to close.

---

## 4. Trust & Secret Model

| Layer | Mechanism | Notes |
|---|---|---|
| Client → SP Server | User JWT (Bearer token, HS256) | Existing, no change |
| SP Server → Trace Server | Service-account JWT (obtained via Trace `/api/login`) | New: SP server logs in as a service user, caches token, refreshes on 401 |
| Trace target BU selection | `dbName`, `buCode`, `dbParams` stored in SP's `trace_posting_map` table | **Never** exposed to client |
| Secrets | `trace_base_url`, service creds, encryption keys in SP server env/`.env` | Not in code, not in client bundle |

### 4.1 Trace Auth Gap — Required Before Production

Trace-Plus's `/graphql/` endpoint currently lacks Bearer token enforcement. Before go-live, the GraphQL ASGI mount must invoke `validate_token(request)` (existing in `security_utils.py`). Without this, the server-to-server relay offers no real security.

---

## 5. Data Flow (End-to-End Sequence)

```
User clicks "Post Selected"
    │
    ▼
[1] Client collects selected ids per entity + branchId/finYearId from context
    │
    ▼
[2] Client → SP Server: postToAccounts(db_name, schema, value)
    │  value = encodeURIComponent({ entity_type, ids, branch_id, actor })
    │  Auth: user JWT (Bearer)
    ▼
[3] SP Server: validate user JWT → extract db_name/schema
    │
    ▼
[4] SP Server: fetch trace_posting_map (client DB, public schema)
    │  → resolves Trace target (dbName, buCode, dbParams, account ids, branchId, finYearId)
    │
    ▼
[5] SP Server: fetch unposted rows from service DB
    │  → GET_{ENTITY}_FOR_POST (with is_posted=false filter)
    │  → returns { header + tax + counterparty } for each requested id
    │
    ▼
[6] For each id (sequential, item-by-item):
    │
    ├── [6a] Build balanced double-entry voucher via accounts_posting_builder
    │       → sqlObject: { tableName:"TranH", xData: {tranDate, finYearId, branchId,
    │         tranTypeId, userRefNo, remarks, xDetails: [{tableName:"TranD", xData:[...]}] }}
    │       → Guarantee: Σdebits == Σcredits
    │
    ├── [6b] SP Server → Trace Server: validateDebitCreditAndUpdate(dbName, value)
    │       Auth: service JWT (Bearer)
    │       value contains: buCode, dbParams, sqlObject
    │       Retry: on transient/network errors only (up to N attempts)
    │
    ├── [6c] Trace Server:
    │   ├── Validate service JWT
    │   ├── Validate Σdebit == Σcredit
    │   ├── Insert TranH + TranD (+ SalePurchaseDetails, ExtGstTranD if applicable)
    │   ├── Generate autoRefNo (auto voucher number)
    │   └── Return { autoRefNo } or { error }
    │
    ├── [6d] On SUCCESS:
    │   ├── Flip is_posted = true in service DB (via process_data)
    │   ├── Upsert trace_posting_log (client DB) with status='posted', trace ref
    │   └── Audit log the event
    │
    └── [6e] On FAILURE:
        ├── Leave is_posted = false
        ├── Upsert trace_posting_log with status='failed', error message
        └── Continue to next item

    │
    ▼
[7] SP Server → Client: return { requested, posted, skipped, failed, results[] }
    │
    ▼
[8] Client:
    ├── Show summary toast ("X posted, Y failed, Z skipped")
    ├── Surface per-row failures inline
    ├── Clear selection
    └── Refresh grids (posted rows move to "Posted" tab)
```

---

## 6. Account Mapping (Per-Business-Unit Configuration)

Each Service-Plus tenant + branch maps to a Trace-Plus business unit, with dedicated GL account ids (from `AccM`). This mapping lives in the `trace_posting_map` table (client DB, `public` schema) and is maintained per tenant.

### 6.1 Voucher Structures

| Service-Plus Entity | Trace `tranTypeId` | Debit Lines (Dr) | Credit Lines (Cr) |
|---|---|---|---|
| **Purchase Invoice** | `5` (Purchase) | Purchase a/c (`aggregate_amount`), Input CGST, Input SGST, Input IGST | Supplier/Creditor (`total_amount`) |
| **Sales Invoice** | `4` (Sales) | Customer/Debtor (`amount`) | Sales a/c (`aggregate`), Output CGST, Output SGST, Output IGST |
| **Job Invoice** | `4` (Sales) | Customer/Job Party (`amount`) | Service Income a/c (`aggregate`), Output CGST, Output SGST, Output IGST |
| **Money Receipt** (`job_payment`) | `3` (Receipt) | Bank or Cash (by `payment_mode`) | Customer/Debtor (`amount`) |

### 6.2 GST Handling

- GST lines are emitted **only** when the corresponding amount is non-zero.
- Purchase GST (Input): Dr — increases cost.
- Sales/Job GST (Output): Cr — increases liability.
- Individual CGST/SGST/IGST accounts are mapped per tenant.

### 6.3 Idempotency Key

- `userRefNo` in each voucher carries the Service-Plus reference: `PI:{invoice_no}`, `SI:{invoice_no}`, `JI:{invoice_no}`, `MR:{receipt_no}`.
- Trace can use this to detect duplicates (via `does_purchase_invoice_exist`-style check keyed on `(tranTypeId, finYearId, accId, userRefNo)`).
- Service-Plus also maintains `trace_posting_log` as a local idempotency guard.

---

## 7. Database Schema Additions

### 7.1 `public.trace_posting_map` (Client DB — per-tenant configuration)

Stores the mapping from a Service-Plus tenant+branch to a Trace-Plus business unit and its chart-of-accounts IDs.

| Column | Type | Description |
|---|---|---|
| `id` | `bigint PK` | Auto-generated |
| `service_db_name` | `text NOT NULL` | SP tenant DB name |
| `service_schema` | `text NOT NULL` | SP schema (e.g. `demo1`) |
| `branch_id` | `bigint NOT NULL` | SP branch ID |
| `trace_db_name` | `text NOT NULL` | Trace `dbName` for targeting |
| `trace_bu_code` | `text NOT NULL` | Trace `buCode` (schema name) |
| `trace_db_params` | `jsonb NOT NULL` | Trace external DB connection params (encrypted at rest) |
| `trace_branch_id` | `int NOT NULL` | Trace branch ID |
| `trace_fin_year_id` | `int NOT NULL` | Trace current financial year ID |
| `acc_purchase` | `int NOT NULL` | Purchase GL account ID |
| `acc_sales` | `int NOT NULL` | Sales GL account ID |
| `acc_service_income` | `int NOT NULL` | Service income GL account ID |
| `acc_input_cgst` | `int NOT NULL` | Input CGST GL account ID |
| `acc_input_sgst` | `int NOT NULL` | Input SGST GL account ID |
| `acc_input_igst` | `int NOT NULL` | Input IGST GL account ID |
| `acc_output_cgst` | `int NOT NULL` | Output CGST GL account ID |
| `acc_output_sgst` | `int NOT NULL` | Output SGST GL account ID |
| `acc_output_igst` | `int NOT NULL` | Output IGST GL account ID |
| `acc_debtors` | `int NOT NULL` | Sundry Debtors control account |
| `acc_creditors` | `int NOT NULL` | Sundry Creditors control account |
| `acc_cash` | `int NOT NULL` | Cash GL account ID |
| `acc_bank` | `int NOT NULL` | Bank GL account ID |
| `is_active` | `boolean DEFAULT true` | Soft-disable switch |
| `created_at` | `timestamptz DEFAULT now()` | |
| **UNIQUE** | `(service_db_name, service_schema, branch_id)` | One map per branch |

### 7.2 `public.trace_posting_log` (Client DB — audit/idempotency ledger)

Records every posting attempt with its outcome for full traceability.

| Column | Type | Description |
|---|---|---|
| `id` | `bigint PK` | Auto-generated |
| `service_db_name` | `text NOT NULL` | SP tenant DB name |
| `service_schema` | `text NOT NULL` | SP schema |
| `entity_type` | `text NOT NULL` | `'purchase'`, `'sales'`, `'job'`, `'receipt'` |
| `entity_id` | `bigint NOT NULL` | SP entity primary key |
| `user_ref_no` | `text NOT NULL` | Stable key sent to Trace as `userRefNo` |
| `trace_ref_no` | `text` | Trace `autoRefNo` on success (null on failure) |
| `status` | `text NOT NULL` | `'posted'` or `'failed'` |
| `message` | `text` | Error detail on failure |
| `posted_by` | `text` | User who initiated the posting |
| `posted_at` | `timestamptz DEFAULT now()` | |
| **UNIQUE** | `(service_db_name, service_schema, entity_type, entity_id)` | One log per entity (upsert on retry) |

---

## 8. API Contracts

### 8.1 Service-Plus GraphQL Mutation: `postToAccounts`

```graphql
type Mutation {
    postToAccounts(db_name: String!, schema: String, value: String!): Generic
}
```

**Input `value`** (URI-encoded JSON):

```json
{
    "entity_type": "purchase" | "sales" | "job" | "receipt",
    "ids": [1, 2, 3],
    "branch_id": 10,
    "actor": "username"
}
```

**Response** (decoded `Generic`):

```json
{
    "requested": 5,
    "posted": 3,
    "skipped": 1,
    "failed": 1,
    "results": [
        {"id": 1, "status": "posted", "trace_ref": "B1/SAL/001/25-26"},
        {"id": 2, "status": "posted", "trace_ref": "B1/SAL/002/25-26"},
        {"id": 3, "status": "skipped", "message": "Already posted"},
        {"id": 4, "status": "failed", "message": "Trace: Debit-Credit mismatch"},
        {"id": 5, "status": "posted", "trace_ref": "B1/SAL/003/25-26"}
    ]
}
```

### 8.2 Trace-Plus GraphQL Mutation: `validateDebitCreditAndUpdate`

```graphql
type Mutation {
    validateDebitCreditAndUpdate(dbName: String!, value: Generic!): Generic
}
```

SP server constructs `value` with `buCode`, `dbParams`, and a nested `sqlObject`:

```json
{
    "buCode": "bu_demo1",
    "dbParams": {"host": "...", "port": 5432, ...},
    "tableName": "TranH",
    "xData": {
        "tranDate": "2026-06-15",
        "finYearId": 3,
        "branchId": 1,
        "tranTypeId": 4,
        "userRefNo": "SI:INV-001",
        "remarks": "Sales INV-001 ABC Corp",
        "xDetails": [
            {
                "tableName": "TranD",
                "xData": [
                    {"accId": 101, "dc": "D", "amount": 11800.00},
                    {"accId": 201, "dc": "C", "amount": 10000.00},
                    {"accId": 301, "dc": "C", "amount": 900.00},
                    {"accId": 302, "dc": "C", "amount": 900.00}
                ]
            }
        ]
    }
}
```

Trace returns `{ autoRefNo: "B1/SAL/001/25-26" }` on success, or `{ error: { content: { detail: "..." } } }` on failure.

---

## 9. Error Handling Strategy

| Scenario | Behaviour |
|---|---|
| Network error calling Trace | Retry (up to `trace_post_max_retries` times, with backoff). If all retries fail → mark item as `failed`, leave `is_posted = false`. |
| Trace returns error-as-data | No retry (Trace processed the request). Mark item `failed`. |
| Trace returns `errors` (GraphQL error) | No retry. Mark item `failed`. |
| Duplicate (already posted) | Skip — `is_posted` filter at fetch stage covers this. |
| SP server internal error | Item marked `failed`, error message returned. Other items continue. |
| Trace service JWT expired | Detect 401 → re-login → retry once. |

**Principle:** Failures are isolated per item. One bad invoice never blocks the rest of the batch. The batch is re-runnable — only unposted items are sent.

---

## 10. Security Principles

1. **Least exposure:** Trace credentials, `dbParams`, account mappings never leave the server.
2. **Defence in depth:** Service JWT for S2S + user JWT for client + TLS for all transports.
3. **Server-side re-validation:** The server fetches source data fresh from its own DB — it never trusts client-supplied amounts or `is_posted` status.
4. **No secrets in code:** All credentials in environment variables / `.env`.
5. **Audit trail:** Every post attempt (success or failure) is logged with user, timestamp, entity, and Trace reference.

---

## 11. Implementation Phases

| Phase | Deliverable | Verification |
|---|---|---|
| **0. Prerequisites** | Add Trace config settings (`config.py`); confirm Trace `TranTypeM` constants | Config loads; TranTypeM ids confirmed |
| **1. DB schema** | Create `trace_posting_map` + `trace_posting_log` tables; seed one map row | `SELECT *` returns seeded rows |
| **2. Server SQL** | Add 8 queries to `SqlStore` (4 fetch + 1 map + 1 log upsert + 2 count queries exist) | Queries return correct data |
| **3. Trace client** | `app/services/trace_client.py` — service login, token caching, S2S post | `await _login()` returns token |
| **4. Voucher builder** | `app/services/accounts_posting_builder.py` — pure functions for 4 entity types | Unit: Σdebit == Σcredit |
| **5. Orchestrator** | `resolve_post_to_accounts_helper` in mutation_helper — loop, build, post, flip, log | One end-to-end item posted |
| **6. GraphQL wiring** | Add mutation to `schema.graphql` + resolver in `mutation.py` | Schema loads; playground shows mutation |
| **7. Client wiring** | Add `GRAPHQL_MAP.postToAccounts`; create `posting-service.ts`; wire button; add grid refresh | Click → summary toast; rows move |
| **8. Trace hardening** | Enforce Bearer auth on Trace `/graphql/`; (optional) add idempotency guard | Unauthenticated request returns 401 |
| **9. Testing** | Unit tests (builder); integration (single item, idempotency, partial failure, auth refresh) | All scenarios pass |

---

## 12. Key Design Principles

- **Atomic truth:** `is_posted` flips only after confirmed Trace write. The two operations (flag flip + log) happen within the same server request context.
- **Idempotent retry:** Stable `userRefNo` + `posting_log` UNIQUE constraint + server-side `is_posted` filter guarantee safe re-runs.
- **Isolated failures:** Item-by-item processing ensures one failure doesn't corrupt the batch.
- **Convention adherence:** Centralized SQL (`SqlStore`), messages (`AppMessages`), GraphQL for secured calls, errors-as-data pattern — all consistent with existing project conventions.
- **Auditability:** `trace_posting_log` + audit log provide full forensic trail.
