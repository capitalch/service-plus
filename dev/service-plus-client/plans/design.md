# Plan — Posting Service-Plus Data to Trace-Plus Accounts

> **Scope of this document:** Design / architecture phase only, as requested in `plans/tran.md`.
> No production code is written here. This is the blueprint for posting **Purchase Invoices,
> Sales Invoices, Job Invoices and Money Receipts** from Service-Plus into the Trace-Plus
> accounting system, with `is_posted` flipped to `true` only after a confirmed, successful post.

---

## 1. Current State (verified from source)

### Service-Plus client (`service-plus-client`, React + Vite + Apollo)
- `Accounts Posting` menu already exists:
  `src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx`.
- Two outer tabs **Posting / Posted**, four inner tabs/grids: Purchase, Sales, Job, Money Receipts.
- Selection state (`Set<number>` of ids) is held in the section and shared across grids.
- **"Post selected" button (`handlePostAllSelected`) currently only fires a toast** — this is the hook to implement.
- Grids read via `GRAPHQL_MAP.genericQuery` + `SQL_MAP.*` paged queries; the per-row
  posted toggle uses `GRAPHQL_MAP.genericUpdate` against `tableName: "<entity>"` with `xData: { id, is_posted }`.
- Apollo attaches `Authorization: Bearer <accessToken>` (from `localStorage`) and auto-refreshes on 401.

### Service-Plus server (`service-plus-server`, FastAPI + Ariadne GraphQL)
- JWT (PyJWT) + bcrypt auth; `get_current_user` reads the Bearer token (`app/core/dependencies.py`).
- GraphQL mounted at `/graphql/`; `genericQuery` / `genericUpdate` pattern with `tableName` / `xData` / `xDetails`.
- Audit logging present (`app/core/audit_log.py`), all SQL centralized in `app/db/sql_store.py`,
  messages centralized in `app/exceptions.py` (`AppMessages`).
- Posting source tables (schema `service-plus-demo.sql`), each with an `is_posted boolean DEFAULT false`
  and a dedicated `is_posted` index:
  - `purchase_invoice` (+ `purchase_invoice_line`)
  - `sales_invoice` (+ `sales_invoice_line`)
  - `job_invoice` (+ `job_invoice_line`)
  - `job_payment` (money receipts)

### Trace-Plus server (`trace-server`, FastAPI + Ariadne GraphQL) — the accounting target
- Double-entry model: `TranH` (header) + `TranD` (debit/credit lines) + `AccM` (account master);
  sales/purchase add `SalePurchaseDetails`, GST in `ExtGstTranD`.
- Vouchers are inserted through the **`validateDebitCreditAndUpdate`** mutation (and `genericUpdate`),
  which accept a nested `sqlObject`: `tableName:"TranH"`, `xData:{header...}`, `xData.xDetails:[ {tableName:"TranD", xData:[ rows ]} ... ]`.
  `validateDebitCreditAndUpdate` enforces **Σ debit == Σ credit** per entry before writing.
- **Auto voucher numbering**: when `xData` has no `id` but has `finYearId`+`branchId`+`tranTypeId`,
  the server generates `autoRefNo` (`branchCode/tranCode/lastNo/finYearId`) and increments a counter.
- **Target business unit selection** is carried inside the GraphQL `value` JSON as
  `dbName`, `buCode` (schema/`search_path`), and `dbParams` (external-DB connection, encrypted at rest).
- `tranTypeId` convention: `4`=Sale, `5`=Purchase, `9`=Sale Return, `10`=Purchase Return, plus a receipt/voucher type for money receipts.
- Duplicate detection precedent exists (`does_purchase_invoice_exist` keyed on `userRefNo`).

---

## 2. Architecture Decision — the Handshake

**Two candidate topologies were considered:**

| | Option A — Browser → Trace directly | **Option B — Browser → Service-Plus server → Trace server (RECOMMENDED)** |
|---|---|---|
| Trace credentials / `dbParams` | Exposed to the browser | **Never leave the server** |
| Auth model | Client must hold a second (Trace) token | Single client token; server holds a service credential |
| Transaction / idempotency control | Hard (client orchestrates) | **Server-side, centralized, auditable** |
| CORS / network surface | Trace must trust browsers | Trace trusts only one server origin |
| Failure handling & `is_posted` flip | Race-prone | **Atomic, server-controlled** |

**Decision: Option B (server-to-server relay).** The Service-Plus client calls its own
Service-Plus server (already authenticated). The Service-Plus server builds the accounting
JSON and makes a **secured server-to-server** call to the Trace-Plus GraphQL API, then flips
`is_posted` in Service-Plus **only after** Trace confirms success.

### Trust & secret model
- **Client → Service-Plus**: existing user JWT (Bearer). No change.
- **Service-Plus → Trace**: a dedicated **service identity**. Trace issues Service-Plus a
  service JWT (via Trace's `/api/login`) or a long-lived signed service token; Service-Plus
  caches and refreshes it. Trace already validates Bearer tokens (`validate_token`).
- **Trace target BU**: Service-Plus stores per-tenant Trace mapping — `dbName`, `buCode`,
  and encrypted `dbParams` — in Service-Plus server config / a mapping table, **never** in the client.
- Secrets (`SECRET_KEY`, Trace base URL, service credentials, BU mapping) live in
  Service-Plus server settings/env, not in code or the client bundle.

### ⚠️ Security gap to close
Trace's GraphQL ASGI mount does **not** currently appear to enforce `validate_token` on the
GraphQL endpoint the way its REST routes do. Before go-live, **Trace's `/graphql/` must require
the service Bearer token** (context-level auth) so the relay is genuinely authenticated. This is
called out as a prerequisite, not silently assumed.

---

## 3. End-to-End Flow

```
┌────────────────────┐   1. Post Selected (ids per entity)     ┌─────────────────────────┐
│  Service-Plus      │ ──────────────────────────────────────► │  Service-Plus Server    │
│  Client (browser)  │     GraphQL mutation: postToAccounts     │  (FastAPI + GraphQL)    │
│  Accounts Posting  │ ◄────────────────────────────────────── │                         │
└────────────────────┘   6. Per-item result {posted/failed}    └───────────┬─────────────┘
                                                                            │ 2. load rows + lines,
                                                                            │    map to vouchers,
                                                                            │    idempotency check
                                                                            ▼
                                                                ┌─────────────────────────┐
                                                                │  Build accounting JSON  │
                                                                │  (TranH + balanced TranD │
                                                                │   + GST + line details)  │
                                                                └───────────┬─────────────┘
                                                                            │ 3. secured S2S call
                                                                            │    (service JWT,
                                                                            │     dbName/buCode/dbParams)
                                                                            ▼
                                                                ┌─────────────────────────┐
                                                                │  Trace-Plus Server      │
                                                                │  validateDebitCredit-   │
                                                                │  AndUpdate → TranH/TranD │
                                                                └───────────┬─────────────┘
                                                                            │ 4. {success, autoRefNo} | {error}
                                                                            ▼
                                                                ┌─────────────────────────┐
                                                                │ 5. On success: flip      │
                                                                │    is_posted=true +       │
                                                                │    store trace ref;       │
                                                                │    audit-log every item   │
                                                                └─────────────────────────┘
```

---

## 4. Execution Steps (design tasks, sequential)

### Step 1 — Define the posting contract (Service-Plus GraphQL)
- Add one mutation, e.g. `postToAccounts(value)`, where `value` (URI-encoded JSON) carries:
  `{ entityType: "purchase"|"sales"|"job"|"receipt", ids: number[], branchId, finYearId }`.
- Response: a per-item array `[{ id, status: "posted"|"skipped"|"failed", traceRefNo?, message? }]`
  plus a summary `{ requested, posted, skipped, failed }`. Errors returned as data (Trace/SP convention),
  not as raised GraphQL errors, so the client can render row-level outcomes.
- Keep all user-facing strings in `AppMessages`.

### Step 2 — Source data assembly (Service-Plus server)
- Add SQL in `sql_store.py` (CTE-parameter style per project standard) to fetch, for each id:
  header + lines + tax breakup + counterparty (supplier / customer / job customer) for
  `purchase_invoice`, `sales_invoice`, `job_invoice`, `job_payment`.
- Re-fetch server-side (do **not** trust client-supplied amounts); re-validate `is_posted = false`
  to avoid double posting from a stale grid.

### Step 3 — Account mapping & voucher construction (Service-Plus server, new module)
- Resolve Service-Plus entities to Trace `AccM` account ids. Mapping config (server-side):
  - Purchase Invoice → `tranTypeId 5`: Dr Purchase/Input-GST, Cr Supplier (creditor).
  - Sales Invoice → `tranTypeId 4` (Return → `9`): Dr Customer (debtor), Cr Sales + Output-GST.
  - Job Invoice → Sales-type voucher: Dr Customer/Job party, Cr Service income + Output-GST.
  - Money Receipt (`job_payment`) → receipt voucher: Dr Bank/Cash (by `payment_mode`), Cr Customer.
- Build the nested `sqlObject` Trace expects: `TranH` header (`tranDate`, `finYearId`, `branchId`,
  `tranTypeId`, `userRefNo` = Service-Plus invoice/receipt no, `remarks`) + `xDetails` balanced
  `TranD` rows (+ `SalePurchaseDetails`/`ExtGstTranD` where GST applies). Let Trace auto-generate `autoRefNo`.
- **Idempotency:** set `userRefNo` to a stable Service-Plus key and rely on Trace's
  `does_..._exist`-style check (and/or a Service-Plus `posting_log` table) so a retry never double-posts.

### Step 4 — Secured server-to-server call (Service-Plus → Trace)
- Add a Trace client service in Service-Plus (`app/services/`): obtains/caches the service JWT,
  posts to Trace `/graphql/` calling `validateDebitCreditAndUpdate` with the `value` containing
  `dbName`, `buCode`, `dbParams`, and the voucher `sqlObject`.
- Use TLS, short timeouts, and bounded retries (only on transient/network errors, never after a
  confirmed write). Process the selection **item-by-item** (or in small batches) so one bad invoice
  doesn't fail the whole run; each item is independently posted/flagged.

### Step 5 — Confirmation, flag flip & audit (Service-Plus server)
- On Trace success for an item: in a single Service-Plus transaction, set `is_posted = true`
  and persist the returned Trace reference (`autoRefNo`) — add a `posting_log` table
  (`entity_type, entity_id, trace_ref, posted_at, posted_by, status`) for traceability and idempotency.
- Audit-log every attempt (success/skip/failure) via `audit_logger`, including user, entity, ids, Trace ref.
- On failure: leave `is_posted = false`, record the error, continue with remaining items.

### Step 6 — Client wiring of "Post Selected" (Service-Plus client)
- Replace the placeholder `handlePostAllSelected` toast with calls to `postToAccounts`
  per entity type for the currently selected ids (gathering `branchId`/`finYearId` from context).
- Show progress, then a result summary toast ("X posted, Y skipped, Z failed"); surface per-row
  failures inline. On success, refresh the affected grids (posted rows move out of **Posting**,
  appear under **Posted**) and clear the selection.
- Reuse the existing Apollo client, token handling, and `GRAPHQL_MAP`/`SQL_MAP` conventions.

### Step 7 — Trace-side prerequisites & hardening
- **Enforce Bearer auth on Trace's `/graphql/`** (close the gap in §2).
- Confirm/whitelist the receipt voucher `tranTypeId` and the GST handling for job invoices.
- Optionally add a Trace-side idempotency guard keyed on `(tranTypeId, finYearId, accId, userRefNo)`.

### Step 8 — Testing & rollout
- Unit-test voucher construction (debits == credits, GST splits, return signs).
- Integration-test against a Trace demo BU; verify idempotency by re-posting the same selection.
- Verify `is_posted` flips only on confirmed success; verify failures are isolated and re-runnable.
- Reconcile a posted batch's `TranH/TranD` totals against Service-Plus source totals.

---

## 5. Workflow (logic summary)

1. **User** selects rows in Accounts Posting → clicks **Post Selected**.
2. **Client** calls Service-Plus `postToAccounts` with `{entityType, ids, branchId, finYearId}` (user JWT).
3. **Service-Plus server** authenticates the user, re-fetches each row + lines server-side, and
   filters out anything already `is_posted = true` (→ `skipped`).
4. For each item, the server **maps accounts** and builds a **balanced double-entry voucher** JSON.
5. The server makes a **secured server-to-server** call to **Trace** (`validateDebitCreditAndUpdate`),
   passing the service JWT and the target BU (`dbName`/`buCode`/`dbParams`); Trace validates
   Dr==Cr, writes `TranH`/`TranD`, and returns its `autoRefNo`.
6. **On success**, the server flips `is_posted = true`, records the Trace ref in `posting_log`,
   and audit-logs the event; **on failure**, it leaves the flag false and logs the error.
7. The server returns a **per-item result + summary** to the client.
8. **Client** shows the summary, surfaces row-level failures, refreshes grids (posted rows move to
   **Posted**), and clears selection.
9. Re-running a partially-failed batch re-posts only the still-unposted items (**idempotent**).

---

## 6. Key Principles Applied
- **Least exposure**: Trace credentials and `dbParams` stay server-side (Option B).
- **Idempotency first**: stable `userRefNo` + `posting_log` + Trace duplicate guard ⇒ safe retries.
- **Atomic truth**: `is_posted` flips only after a confirmed Trace write; failures are isolated per item.
- **Auditability**: every post attempt is logged with user, entity, ids and Trace reference.
- **Convention adherence**: centralized SQL (`sql_store.py`), centralized messages (`AppMessages`),
  GraphQL for secured calls, errors-as-data, existing Apollo/token plumbing on the client.
- **Prerequisite called out**: Trace `/graphql/` must enforce Bearer auth before go-live.
