# Implementation Plan — Posting Service-Plus Data to Trace-Plus Accounts (Option B)

> Architecture decision is fixed: **Browser → Service-Plus server → Trace-Plus server**
> (server-to-server relay). The high-level design rationale lives in `plans/design.md`.
> This document is the **executable implementation plan**: concrete code, account mapping, and
> ordered steps. Each step is self-contained and can be executed and verified independently.
>
> **Conventions reused (verified in source):**
> - Server: Ariadne GraphQL, resolvers in `mutation.py` → helpers in `mutation_helper.py`;
>   all SQL in `app/db/sql_store.py` (`SqlStore`); all strings in `app/exceptions.py` (`AppMessages`);
>   DB via `exec_sql` / `process_data` / `get_service_db_connection`; audit via `audit_logger.log`.
> - `httpx>=0.27.0` is already a dependency (use it for the S2S call — no new package).
> - Trace ingest: GraphQL mutation `validateDebitCreditAndUpdate(dbName, value)` where `value` is
>   `encodeURIComponent(JSON)` carrying `buCode`, `dbParams`, and the voucher `sqlObject`
>   (`tableName:"TranH"`, `xData{...header..., xDetails:[{tableName:"TranD", xData:[...]}]}`).
>   Trace auto-generates `autoRefNo` when `xData` has no `id` and has `finYearId+branchId+tranTypeId`,
>   and rejects the write unless Σdebit == Σcredit per entry.
> - Client: Apollo + `GRAPHQL_MAP` (gql) + `graphQlUtils`/`encodeObj` + `SQL_MAP`.

---

## Account Mapping (the accounting model produced per entity)

All vouchers are double-entry: each `TranH` carries balanced `TranD` rows (`dc` = `'D'`/`'C'`).
`tranTypeId` per Trace convention: **4 = Sales, 5 = Purchase, 9 = Sales Return, 10 = Purchase Return,
3 = Receipt**.

| Service-Plus entity | tranTypeId | Debit (Dr) | Credit (Cr) |
|---|---|---|---|
| **Purchase Invoice** (`is_return=false`) | 5 | Purchase a/c = `aggregate_amount`; Input CGST; Input SGST; Input IGST | Supplier (creditor) = `total_amount` |
| **Purchase Invoice** (`is_return=true`) | 10 | Supplier = `total_amount` | Purchase a/c = `aggregate_amount`; Input CGST/SGST/IGST |
| **Sales Invoice** (`is_return=false`) | 4 | Customer (debtor) = `amount` | Sales a/c = `aggregate`; Output CGST; Output SGST; Output IGST |
| **Sales Invoice** (`is_return=true`) | 9 | Sales a/c = `aggregate`; Output CGST/SGST/IGST | Customer = `amount` |
| **Job Invoice** | 4 | Customer/Job party = `amount` | Service Income a/c = `aggregate`; Output CGST; Output SGST; Output IGST |
| **Money Receipt** (`job_payment`) | 3 | Bank or Cash (by `payment_mode`) = `amount` | Customer/Job party = `amount` |

GST lines are emitted only when the corresponding amount ≠ 0. Counterparty (supplier/customer)
resolves to a single Trace ledger account via the **account map** (Step 1) — initially a fixed
control account ("Sundry Debtors" / "Sundry Creditors"); auto-subledger is a later enhancement.

The Trace GL account ids (`accId`) are **not hard-coded**: they come from a per-tenant map row so
each business unit can point at its own chart of accounts.

---

## Phase 0 — Prerequisites & configuration

### Step 0.1 — Add Trace + posting settings (`app/config.py`)
Append to `class Settings`:

```python
    # ── Trace-Plus (accounts) integration ──────────────────────────────────────
    trace_base_url: str = Field(
        default="http://localhost:8001",
        description="Trace-Plus server base URL (GraphQL at <base>/graphql/)",
    )
    trace_service_username: str = Field(default="", description="Trace service-account login")
    trace_service_password: str = Field(default="", description="Trace service-account password")
    trace_service_client_id: str = Field(default="", description="Trace clientId for login")
    trace_http_timeout_seconds: float = Field(default=30.0, description="S2S call timeout")
    trace_post_max_retries: int = Field(default=2, description="Retries on transient/network errors only")
```

`.env` (per environment) supplies real values; **no secrets in code or client**.

### Step 0.2 — Confirm Trace constants (manual, no code)
In the Trace DB, confirm `TranTypeM` ids for Purchase(5)/Sale(4)/returns(9,10)/Receipt and the GST
account convention. Record them; they feed Step 1's seed row.

**Verify:** `python -c "from app.config import settings; print(settings.trace_base_url)"` runs clean.

---

## Phase 1 — Account map (Service-Plus client DB, `service_plus_client` schema)

### Step 1.1 — Create the map table (migration SQL, run once)
Add `db/migrations/2026-06-14_accounts_posting.sql`:

```sql
-- Per-business-unit mapping to a Trace-Plus business unit + chart-of-accounts ids.
CREATE TABLE IF NOT EXISTS public.trace_posting_map (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_db_name text   NOT NULL,            -- Service-Plus tenant DB
    service_schema  text   NOT NULL,            -- e.g. 'demo1'
    branch_id       bigint NOT NULL,            -- Service-Plus branch
    -- Trace targeting
    trace_db_name   text   NOT NULL,            -- Trace 'dbName'
    trace_bu_code   text   NOT NULL,            -- Trace 'buCode' (schema)
    trace_db_params jsonb  NOT NULL,            -- Trace external DB params (stored encrypted)
    trace_branch_id int    NOT NULL,            -- Trace branchId
    trace_fin_year_id int  NOT NULL,            -- Trace finYearId (current FY)
    -- Trace GL account ids (AccM.id)
    acc_purchase    int NOT NULL,
    acc_sales       int NOT NULL,
    acc_service_income int NOT NULL,
    acc_input_cgst  int NOT NULL,
    acc_input_sgst  int NOT NULL,
    acc_input_igst  int NOT NULL,
    acc_output_cgst int NOT NULL,
    acc_output_sgst int NOT NULL,
    acc_output_igst int NOT NULL,
    acc_debtors     int NOT NULL,               -- Sundry Debtors control
    acc_creditors   int NOT NULL,               -- Sundry Creditors control
    acc_cash        int NOT NULL,
    acc_bank        int NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (service_db_name, service_schema, branch_id)
);

-- Idempotency + traceability ledger for every posting attempt.
CREATE TABLE IF NOT EXISTS public.trace_posting_log (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_db_name text NOT NULL,
    service_schema  text NOT NULL,
    entity_type   text   NOT NULL,              -- 'purchase'|'sales'|'job'|'receipt'
    entity_id     bigint NOT NULL,
    user_ref_no   text   NOT NULL,              -- stable key sent to Trace as userRefNo
    trace_ref_no  text,                         -- Trace autoRefNo on success
    status        text   NOT NULL,              -- 'posted'|'failed'
    message       text,
    posted_by     text,
    posted_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (service_db_name, service_schema, entity_type, entity_id)
);
```

> `trace_db_params` holds Trace's external-DB connection JSON. Reuse the existing encryption used
> elsewhere if available; otherwise store via a server-side secret and keep the column for non-secret
> routing only. **Never expose this to the client.**

### Step 1.2 — Seed one row per (tenant, branch) using the Step 0.2 values.

**Verify:** `SELECT * FROM trace_posting_map;` returns the seeded row.

---

## Phase 2 — SQL for assembly, idempotency, and flag flip (`app/db/sql_store.py`)

Add these to `class SqlStore` (CTE-parameter style per project standard; `%%` is escaped `%`).

### Step 2.1 — Fetch the posting map (client DB)
```python
    GET_TRACE_POSTING_MAP = """
        with "service_db_name" as (values (%(service_db_name)s::text)),
             "service_schema"  as (values (%(service_schema)s::text)),
             "branch_id"       as (values (%(branch_id)s::bigint))
        SELECT * FROM public.trace_posting_map
            WHERE service_db_name = (table "service_db_name")
              AND service_schema  = (table "service_schema")
              AND branch_id       = (table "branch_id")
              AND is_active = true
    """
```

### Step 2.2 — Fetch full entity rows for posting (service DB), one query per entity
Each returns only **unposted** rows for the requested ids, with the fields the voucher needs.
```python
    GET_PURCHASE_INVOICES_FOR_POST = """
        with "ids" as (values (%(ids)s::bigint[]))
        SELECT pi.id, pi.invoice_no, pi.invoice_date, pi.branch_id, pi.is_return,
               pi.aggregate_amount, pi.cgst_amount, pi.sgst_amount, pi.igst_amount,
               pi.total_amount, pi.supplier_id, c.contact_name AS supplier_name
            FROM purchase_invoice pi
            LEFT JOIN contact c ON c.id = pi.supplier_id
            WHERE pi.id = ANY((table "ids")) AND pi.is_posted = false
    """

    GET_SALES_INVOICES_FOR_POST = """
        with "ids" as (values (%(ids)s::bigint[]))
        SELECT si.id, si.invoice_no, si.invoice_date, si.division_id, si.is_return,
               si.aggregate, si.cgst_amount, si.sgst_amount, si.igst_amount, si.amount,
               si.customer_contact_id, si.customer_name
            FROM sales_invoice si
            WHERE si.id = ANY((table "ids")) AND si.is_posted = false
    """

    GET_JOB_INVOICES_FOR_POST = """
        with "ids" as (values (%(ids)s::bigint[]))
        SELECT ji.id, ji.invoice_no, ji.invoice_date, ji.job_id,
               ji.aggregate, ji.cgst_amount, ji.sgst_amount, ji.igst_amount, ji.amount,
               j.customer_name, j.branch_id
            FROM job_invoice ji
            JOIN job j ON j.id = ji.job_id
            WHERE ji.id = ANY((table "ids")) AND ji.is_posted = false
    """

    GET_JOB_PAYMENTS_FOR_POST = """
        with "ids" as (values (%(ids)s::bigint[]))
        SELECT jp.id, jp.receipt_no, jp.payment_date, jp.payment_mode, jp.amount,
               jp.reference_no, jp.job_id, j.customer_name, j.branch_id
            FROM job_payment jp
            JOIN job j ON j.id = jp.job_id
            WHERE jp.id = ANY((table "ids")) AND jp.is_posted = false
    """
```
> Adjust counterparty joins (`contact`, `job`) to the real column names in `service-plus-demo.sql`
> during execution; the shapes above match the grid schemas in `accounts-posting-schema.ts`.

### Step 2.3 — Mark posted (service DB) — done via `process_data` (no raw SQL needed)
The flag flip uses the existing `process_data(x_data={"id":..,"is_posted":True}, cur, table, None, None)`.

### Step 2.4 — Idempotency log upsert (client DB)
```python
    UPSERT_TRACE_POSTING_LOG = """
        with t as (values (
            %(service_db_name)s::text, %(service_schema)s::text, %(entity_type)s::text,
            %(entity_id)s::bigint, %(user_ref_no)s::text, %(trace_ref_no)s::text,
            %(status)s::text, %(message)s::text, %(posted_by)s::text))
        INSERT INTO public.trace_posting_log
            (service_db_name, service_schema, entity_type, entity_id, user_ref_no,
             trace_ref_no, status, message, posted_by)
        SELECT * FROM t
        ON CONFLICT (service_db_name, service_schema, entity_type, entity_id)
        DO UPDATE SET trace_ref_no = EXCLUDED.trace_ref_no, status = EXCLUDED.status,
                      message = EXCLUDED.message, posted_by = EXCLUDED.posted_by,
                      posted_at = now()
    """
```

**Verify:** import `SqlStore` and read each new attribute is a non-empty string.

---

## Phase 3 — Trace client service (`app/services/trace_client.py`, new file)

Handles service-token login (cached + refreshed on 401) and the GraphQL call.

```python
"""Server-to-server client for posting vouchers into Trace-Plus."""
import json
from urllib.parse import quote
from typing import Any
import httpx
from app.config import settings
from app.logger import logger
from app.exceptions import AppMessages

_token_cache: dict[str, str] = {"access": ""}


async def _login() -> str:
    """Obtain a Trace service JWT via Trace's /api/login (form-encoded)."""
    url = f"{settings.trace_base_url}/api/login"
    data = {
        "clientId": settings.trace_service_client_id,
        "username": settings.trace_service_username,
        "password": settings.trace_service_password,
    }
    async with httpx.AsyncClient(timeout=settings.trace_http_timeout_seconds) as client:
        resp = await client.post(url, data=data)
        resp.raise_for_status()
        bundle = resp.json()
    token = bundle.get("accessToken") or bundle.get("access_token")
    if not token:
        raise RuntimeError(AppMessages.TRACE_LOGIN_FAILED)
    _token_cache["access"] = token
    return token


async def _ensure_token() -> str:
    return _token_cache["access"] or await _login()


async def post_voucher(trace_db_name: str, value_obj: dict) -> dict:
    """
    Call Trace `validateDebitCreditAndUpdate`. `value_obj` already contains
    buCode, dbParams, autoRefNo flag inputs, and the TranH sqlObject.
    Returns {"ok": True, "ref": <autoRefNo|None>} or {"ok": False, "detail": <msg>}.
    """
    gql_url = f"{settings.trace_base_url}/graphql/"
    encoded = quote(json.dumps(value_obj))
    query = (
        "mutation($dbName:String!,$value:String!){"
        "validateDebitCreditAndUpdate(dbName:$dbName,value:$value)}"
    )
    payload = {"query": query, "variables": {"dbName": trace_db_name, "value": encoded}}

    async def _send(token: str) -> httpx.Response:
        async with httpx.AsyncClient(timeout=settings.trace_http_timeout_seconds) as client:
            return await client.post(
                gql_url, json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )

    token = await _ensure_token()
    resp = await _send(token)
    if resp.status_code == 401:                      # token expired → refresh once
        token = await _login()
        resp = await _send(token)
    resp.raise_for_status()

    body = resp.json()
    data = (body.get("data") or {}).get("validateDebitCreditAndUpdate")
    # Trace returns errors-as-data: {"error": {...}}
    if isinstance(data, dict) and data.get("error"):
        detail = data["error"].get("content", {}).get("detail", AppMessages.TRACE_POST_FAILED)
        return {"ok": False, "detail": detail}
    if body.get("errors"):
        return {"ok": False, "detail": str(body["errors"][0].get("message"))}
    ref = data.get("autoRefNo") if isinstance(data, dict) else None
    return {"ok": True, "ref": ref}
```

> Retries (on `httpx.TransportError`/timeout only, never after a confirmed write) are added in the
> orchestrator (Step 5) using `settings.trace_post_max_retries`.

**Verify:** with a running Trace dev server, `await _login()` returns a token.

---

## Phase 4 — Voucher builder (`app/services/accounts_posting_builder.py`, new file)

Pure functions: `(entity_row, map_row) -> sqlObject`. No I/O — fully unit-testable.

```python
"""Map Service-Plus entities to balanced Trace double-entry voucher sql_objects."""
from datetime import date
from typing import Any

T_SALE, T_PURCHASE, T_SALE_RET, T_PURCHASE_RET, T_RECEIPT = 4, 5, 9, 10, 3


def _fin_year_id(d: str, fallback: int) -> int:
    """Indian FY: Apr–Mar. Use map's current FY by default; derive if needed."""
    return fallback


def _row(acc_id: int, dc: str, amount: float, **extra) -> dict:
    return {"accId": acc_id, "dc": dc, "amount": round(float(amount), 2), **extra}


def _tax_rows(m: dict, kind: str, cgst, sgst, igst) -> list[dict]:
    """kind='input' for purchase, 'output' for sales/job. Emit only non-zero."""
    pfx = "input" if kind == "input" else "output"
    dc = "D" if kind == "input" else "C"   # input GST is a debit; output GST a credit
    out = []
    for amt, acc in ((cgst, m[f"acc_{pfx}_cgst"]), (sgst, m[f"acc_{pfx}_sgst"]), (igst, m[f"acc_{pfx}_igst"])):
        if amt and float(amt) != 0:
            out.append(_row(acc, dc, amt))
    return out


def _envelope(m: dict, tran_type_id: int, tran_date: str, user_ref_no: str,
              remarks: str, detail_rows: list[dict]) -> dict:
    """Wrap balanced TranD rows in the TranH sqlObject Trace expects."""
    return {
        "buCode": m["trace_bu_code"],
        "dbParams": m["trace_db_params"],
        "tableName": "TranH",
        "xData": {
            "tranDate": tran_date,
            "finYearId": m["trace_fin_year_id"],
            "branchId": m["trace_branch_id"],
            "tranTypeId": tran_type_id,
            "userRefNo": user_ref_no,
            "remarks": remarks,
            "xDetails": [{"tableName": "TranD", "xData": detail_rows}],
        },
    }


def build_purchase(r: dict, m: dict) -> dict:
    is_ret = r.get("is_return")
    tt = T_PURCHASE_RET if is_ret else T_PURCHASE
    gst = _tax_rows(m, "input", r["cgst_amount"], r["sgst_amount"], r["igst_amount"])
    purchase = _row(m["acc_purchase"], "D" if not is_ret else "C", r["aggregate_amount"])
    supplier = _row(m["acc_creditors"], "C" if not is_ret else "D", r["total_amount"])
    rows = [purchase, *gst, supplier]            # debits == credits by construction
    return _envelope(m, tt, r["invoice_date"], f"PI:{r['invoice_no']}",
                     f"Purchase {r['invoice_no']} {r.get('supplier_name','')}", rows)


def build_sales(r: dict, m: dict) -> dict:
    is_ret = r.get("is_return")
    tt = T_SALE_RET if is_ret else T_SALE
    gst = _tax_rows(m, "output", r["cgst_amount"], r["sgst_amount"], r["igst_amount"])
    sales = _row(m["acc_sales"], "C" if not is_ret else "D", r["aggregate"])
    customer = _row(m["acc_debtors"], "D" if not is_ret else "C", r["amount"])
    rows = [customer, sales, *gst]
    return _envelope(m, tt, r["invoice_date"], f"SI:{r['invoice_no']}",
                     f"Sales {r['invoice_no']} {r.get('customer_name','')}", rows)


def build_job_invoice(r: dict, m: dict) -> dict:
    gst = _tax_rows(m, "output", r["cgst_amount"], r["sgst_amount"], r["igst_amount"])
    income = _row(m["acc_service_income"], "C", r["aggregate"])
    customer = _row(m["acc_debtors"], "D", r["amount"])
    rows = [customer, income, *gst]
    return _envelope(m, T_SALE, r["invoice_date"], f"JI:{r['invoice_no']}",
                     f"Job invoice {r['invoice_no']} {r.get('customer_name','')}", rows)


def build_receipt(r: dict, m: dict) -> dict:
    mode = (r.get("payment_mode") or "").lower()
    bank_or_cash = m["acc_cash"] if mode in ("cash",) else m["acc_bank"]
    rows = [_row(bank_or_cash, "D", r["amount"]),
            _row(m["acc_debtors"], "C", r["amount"], lineRefNo=r.get("reference_no"))]
    return _envelope(m, T_RECEIPT, r["payment_date"], f"MR:{r['receipt_no']}",
                     f"Receipt {r['receipt_no']} {r.get('customer_name','')}", rows)


BUILDERS = {"purchase": build_purchase, "sales": build_sales,
            "job": build_job_invoice, "receipt": build_receipt}
```

**Verify (unit):** for a sample row, assert `sum(D) == sum(C)` over `xData[0].xData`.

---

## Phase 5 — Posting orchestrator (`app/graphql/resolvers/mutation_helper.py`)

Add the helper. It loops items, builds each voucher, calls Trace, and **only on success** flips
`is_posted` (service DB) + writes `trace_posting_log` (client DB) + audits.

```python
# add near other imports
import asyncio
import httpx
from app.db.psycopg_driver import exec_sql
from app.services.trace_client import post_voucher
from app.services.accounts_posting_builder import BUILDERS

_POST_SQL = {
    "purchase": ("GET_PURCHASE_INVOICES_FOR_POST", "purchase_invoice"),
    "sales":    ("GET_SALES_INVOICES_FOR_POST",    "sales_invoice"),
    "job":      ("GET_JOB_INVOICES_FOR_POST",      "job_invoice"),
    "receipt":  ("GET_JOB_PAYMENTS_FOR_POST",      "job_payment"),
}


async def resolve_post_to_accounts_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    """
    value (URL-encoded JSON): { entity_type, ids:[...], branch_id, actor }
    Returns: { requested, posted, skipped, failed, results:[{id,status,trace_ref,message}] }
    """
    payload = _decode_value(value, "postToAccounts")
    entity_type = payload.get("entity_type")
    ids = payload.get("ids") or []
    branch_id = payload.get("branch_id")
    actor = payload.get("actor") or "business_user"

    if entity_type not in _POST_SQL or not ids or not branch_id:
        raise ValidationException(message=AppMessages.REQUIRED_FIELD_MISSING,
                                  extensions={"fields": ["entity_type", "ids", "branch_id"]})

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"
    sql_id, table = _POST_SQL[entity_type]

    # 1. Load the Trace map (client DB) and unposted rows (service DB)
    map_rows = await exec_sql(None, "public", SqlStore.GET_TRACE_POSTING_MAP,
                              {"service_db_name": db_name or "", "service_schema": schema_name,
                               "branch_id": branch_id})
    if not map_rows:
        raise ValidationException(message=AppMessages.TRACE_MAP_NOT_FOUND,
                                  extensions={"branch_id": branch_id})
    m = map_rows[0]
    rows = await exec_sql(db_name_arg, schema_name, getattr(SqlStore, sql_id),
                          {"ids": list(ids)}, text_dates=True)
    rows_by_id = {r["id"]: r for r in rows}

    results, posted, failed = [], 0, 0
    build = BUILDERS[entity_type]

    for _id in ids:
        row = rows_by_id.get(_id)
        if row is None:                       # already posted or not found → skip
            results.append({"id": _id, "status": "skipped", "message": AppMessages.ALREADY_POSTED})
            continue
        try:
            voucher = build(row, m)
            user_ref = voucher["xData"]["userRefNo"]
            res = await _post_with_retry(m["trace_db_name"], voucher)
            if not res["ok"]:
                failed += 1
                await _record_log(db_name, schema_name, entity_type, _id, user_ref,
                                  None, "failed", res["detail"], actor)
                results.append({"id": _id, "status": "failed", "message": res["detail"]})
                continue
            # success → flip flag in service DB
            async with get_service_db_connection(db_name_arg) as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(pgsql.SQL("SET search_path TO {}").format(
                        pgsql.Identifier(schema_name)))
                    await process_data({"id": _id, "is_posted": True, "to_set_updated_at": True},
                                       cur, table, None, None)
            await _record_log(db_name, schema_name, entity_type, _id, user_ref,
                              res["ref"], "posted", None, actor)
            await audit_logger.log(action=AuditAction.POST_TO_ACCOUNTS, actor_type="business_user",
                                   actor_username=actor, outcome="success",
                                   resource_type=entity_type, resource_id=str(_id),
                                   resource_name=res["ref"])
            posted += 1
            results.append({"id": _id, "status": "posted", "trace_ref": res["ref"]})
        except Exception as e:               # isolate per-item failure
            failed += 1
            logger.error("Posting %s id=%s failed: %s", entity_type, _id, e, exc_info=True)
            results.append({"id": _id, "status": "failed", "message": str(e)})

    return {"requested": len(ids), "posted": posted, "skipped": len(ids) - posted - failed,
            "failed": failed, "results": results}


async def _post_with_retry(trace_db_name: str, voucher: dict) -> dict:
    attempts = settings.trace_post_max_retries + 1
    for i in range(attempts):
        try:
            return await post_voucher(trace_db_name, voucher)
        except (httpx.TransportError, httpx.TimeoutException) as e:
            if i == attempts - 1:
                return {"ok": False, "detail": f"{AppMessages.TRACE_UNREACHABLE}: {e}"}
            await asyncio.sleep(0.5 * (i + 1))


async def _record_log(db_name, schema_name, entity_type, entity_id, user_ref,
                      trace_ref, status, message, actor) -> None:
    await exec_sql(None, "public", SqlStore.UPSERT_TRACE_POSTING_LOG, {
        "service_db_name": db_name or "", "service_schema": schema_name,
        "entity_type": entity_type, "entity_id": entity_id, "user_ref_no": user_ref,
        "trace_ref_no": trace_ref, "status": status, "message": message, "posted_by": actor})
```

Add to `app/core/audit_log.py` (`AuditAction`): `POST_TO_ACCOUNTS = "POST_TO_ACCOUNTS"`.
Add to `app/exceptions.py` (`AppMessages`): `TRACE_LOGIN_FAILED`, `TRACE_POST_FAILED`,
`TRACE_UNREACHABLE`, `TRACE_MAP_NOT_FOUND`, `ALREADY_POSTED`.

**Verify:** call with a list of ids against a Trace dev BU; confirm `is_posted` flips only for
successfully posted ids and `trace_posting_log` rows appear.

---

## Phase 6 — GraphQL wiring (server)

### Step 6.1 — `app/graphql/schema.graphql` (add under `type Mutation`)
```graphql
    postToAccounts(db_name: String!, schema: String, value: String!): Generic
```

### Step 6.2 — `app/graphql/resolvers/mutation.py` (register resolver + import helper)
```python
from app.graphql.resolvers.mutation_helper import resolve_post_to_accounts_helper  # add to import block

@mutation.field("postToAccounts")
async def resolve_post_to_accounts(_, info, db_name: str = "", schema: str = "public", value: str = "") -> Any:
    try:
        return await resolve_post_to_accounts_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error posting to accounts: %s", e, exc_info=True)
        raise GraphQLException(message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)})
```

**Verify:** GraphQL playground shows `postToAccounts`; schema loads without error.

---

## Phase 7 — Client wiring (`service-plus-client`)

### Step 7.1 — `src/constants/graphql-map.ts` (add to `GRAPHQL_MAP`)
```ts
    postToAccounts: gql`
        mutation PostToAccounts($db_name: String!, $schema: String, $value: String!) {
            postToAccounts(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
```

### Step 7.2 — `src/features/client/components/jobs/accounts-posting/posting-service.ts` (new)
```ts
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { GRAPHQL_MAP } from "@/constants/graphql-map";

export type PostEntity = "purchase" | "sales" | "job" | "receipt";
export type PostItemResult = { id: number; status: "posted" | "skipped" | "failed"; trace_ref?: string; message?: string };
export type PostResult = { requested: number; posted: number; skipped: number; failed: number; results: PostItemResult[] };

export async function postEntityToAccounts(args: {
    dbName: string; schema: string; entityType: PostEntity; ids: number[]; branchId: number; actor: string;
}): Promise<PostResult> {
    const res = await apolloClient.mutate<{ postToAccounts: PostResult }>({
        mutation: GRAPHQL_MAP.postToAccounts,
        variables: {
            db_name: args.dbName, schema: args.schema,
            value: encodeObj({ entity_type: args.entityType, ids: args.ids, branch_id: args.branchId, actor: args.actor }),
        },
    });
    return res.data!.postToAccounts;
}
```

### Step 7.3 — `accounts-posting-section.tsx` — replace `handlePostAllSelected`
Wire context (dbName/schema/branchId/user) and call the service per non-empty selection set,
then summarize and refresh. Pseudocode (keeps existing selection state):
```ts
const dbName   = useAppSelector(selectDbName);
const schema   = useAppSelector(selectSchema);
const branchId = useAppSelector(selectCurrentBranch)?.id;
const actor    = useAppSelector(/* current username */);

const handlePostAllSelected = async () => {
    if (!dbName || !schema || !branchId) return;
    const jobs: Array<[PostEntity, Set<number>]> = [
        ["purchase", selectedPurchaseIds], ["sales", selectedSalesIds],
        ["job", selectedJobIds], ["receipt", selectedReceiptIds],
    ];
    let posted = 0, failed = 0, skipped = 0;
    toast.info(`Posting ${totalSelected} item(s)…`);
    for (const [entityType, set] of jobs) {
        if (set.size === 0) continue;
        try {
            const r = await postEntityToAccounts({ dbName, schema, entityType, ids: [...set], branchId, actor });
            posted += r.posted; failed += r.failed; skipped += r.skipped;
        } catch { failed += set.size; }
    }
    failed === 0
        ? toast.success(`Posted ${posted}${skipped ? `, skipped ${skipped}` : ""}.`)
        : toast.warning(`Posted ${posted}, failed ${failed}${skipped ? `, skipped ${skipped}` : ""}.`);
    handleDeselectAll();
    // trigger grid reloads (e.g. bump a refreshKey passed to grids, or call their refresh)
};
```
Add a `refreshKey` (incrementing number) prop to the four grids so a successful post re-runs their
`loadData` (posted rows leave **Posting**, appear under **Posted**).

**Verify:** select rows, click **Post selected** → summary toast; posted rows move to **Posted**;
failures stay selected/visible with a message.

---

## Phase 8 — Trace-side hardening (prerequisite for production)

### Step 8.1 — Enforce Bearer auth on Trace `/graphql/`
In `trace-server`, wrap the GraphQL ASGI mount (or add an `on_request`/context) to call the existing
`validate_token(request)` so the relay is genuinely authenticated. Today only REST routes enforce it.

### Step 8.2 — (Optional) Trace-side idempotency guard
Use the existing `does_purchase_invoice_exist`-style check keyed on
`(tranTypeId, finYearId, accId, userRefNo)` to reject a duplicate voucher even if Service-Plus retries.

**Verify:** an unauthenticated POST to Trace `/graphql/` returns 401; re-posting the same selection
creates no duplicate `TranH`.

---

## Phase 9 — Testing & rollout

1. **Unit (builder):** debits == credits for each entity; GST lines omitted when zero; return signs flipped.
2. **Integration (single item):** post one purchase invoice; confirm Trace `TranH/TranD` + `is_posted=true` + `trace_posting_log`.
3. **Idempotency:** re-post the same selection → all `skipped`, no duplicate vouchers.
4. **Partial failure:** force one bad row (e.g. missing map account) → others post, bad one `failed`, re-runnable.
5. **Auth:** expire the Trace service token mid-run → auto re-login, run completes.
6. **Reconciliation:** sum a posted batch's Trace amounts vs Service-Plus source totals.

---

## Execution Order (checklist)

1. **Phase 0** — config settings + confirm Trace constants.
2. **Phase 1** — create + seed `trace_posting_map`, create `trace_posting_log`.
3. **Phase 2** — add `SqlStore` queries.
4. **Phase 3** — `trace_client.py`.
5. **Phase 4** — `accounts_posting_builder.py` (+ unit tests).
6. **Phase 5** — orchestrator helper + `AuditAction`/`AppMessages` additions.
7. **Phase 6** — GraphQL schema + resolver.
8. **Phase 7** — client `GRAPHQL_MAP`, `posting-service.ts`, button wiring + grid refresh.
9. **Phase 8** — Trace auth hardening (+ optional idempotency guard).
10. **Phase 9** — tests + reconciliation, then enable for one tenant before wider rollout.

---

## Workflow (runtime logic)

```
User clicks "Post selected"
        │  (per entity type with a non-empty selection)
        ▼
Client → postToAccounts(db_name, schema, value{entity_type, ids, branch_id, actor})   [user JWT]
        ▼
SP server: load trace_posting_map (client DB) + unposted rows (service DB)
        ▼
for each id:
   ├─ build balanced TranH/TranD voucher (builder)            ── Σdebit == Σcredit
   ├─ post_voucher → Trace validateDebitCreditAndUpdate       ── service JWT, buCode/dbParams
   │       ├─ transient/network error → bounded retry
   │       ├─ Trace error-as-data    → mark FAILED (flag stays false), log, continue
   │       └─ success {autoRefNo}    → flip is_posted=true (service DB) +
   │                                   upsert trace_posting_log + audit
   ▼
return {requested, posted, skipped, failed, results[]}
        ▼
Client: summary toast + per-row failures + refresh grids (posted → "Posted" tab)
        ▼
Re-running a partial batch re-posts only still-unposted ids (idempotent)
```
