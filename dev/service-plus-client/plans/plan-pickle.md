# Implementation Plan — Accounts Posting: Service-Plus to Trace-Plus

## Overview

This plan implements a server-to-server relay that posts Purchase Invoices, Sales Invoices, Job Invoices, and Money Receipts from Service-Plus to Trace-Plus accounting. The implementation follows the design in `design.md` and adheres to existing project conventions.

**Architecture:** Client → SP Server (GraphQL mutation) → Trace Server (HTTP GraphQL call)

---

## Phase 0 — Prerequisites

### Step 0.1 — Add Trace config to `config.py`

**File:** `dev/service-plus-server/app/config.py`

Add after the `super_admin_mobile` field (before `@computed_field`):

```python
    # Trace-Plus integration settings
    trace_base_url: str = Field(
        default="http://localhost:8000",
        description="Trace-Plus server base URL (including port)",
    )
    trace_service_username: str = Field(
        default="trace_service",
        description="Trace-Plus service account username for S2S auth",
    )
    trace_service_password: str = Field(
        default="",
        description="Trace-Plus service account password",
    )
    trace_post_max_retries: int = Field(
        default=3,
        description="Max retry attempts for transient Trace errors",
    )
    trace_post_retry_delay_ms: int = Field(
        default=1000,
        description="Base delay (ms) for exponential backoff on retry",
    )
```

Add defaults to `.env` as needed.

### Step 0.2 — Add Trace message constants to `AppMessages`

**File:** `dev/service-plus-server/app/exceptions.py`

Add before the `# Success messages` section:

```python
    # Trace-Plus integration messages
    TRACE_POST_STARTED = "Accounts posting to Trace-Plus initiated"
    TRACE_POST_COMPLETED = "Accounts posting to Trace-Plus completed"
    TRACE_LOGIN_FAILED = "Failed to authenticate with Trace-Plus server"
    TRACE_CONNECTION_FAILED = "Failed to connect to Trace-Plus server"
    TRACE_POST_FAILED = "Failed to post to Trace-Plus"
    TRACE_VALIDATION_FAILED = "Trace-Plus rejected the voucher: debit-credit mismatch"
    TRACE_MAP_NOT_FOUND = "Trace posting configuration not found for this branch"
    TRACE_ENTITY_NOT_FOUND = "No data found for the requested posting entity"
    TRACE_ALREADY_POSTED = "One or more items are already posted — skipped"
```

---

## Phase 1 — Database Schema

### Step 1.1 — Add `trace_posting_map` table DDL

**File:** `dev/service-plus-server/app/db/sql_bu.py`

Create a new section before `# ── BU Seed Data ──`:

```python
    # ── Trace-Plus Posting Map (client DB, public schema) ──────────────
    TRACE_POSTING_MAP_DDL = """
        CREATE TABLE IF NOT EXISTS public.trace_posting_map (
            id                  BIGINT  NOT NULL PRIMARY KEY,
            service_db_name     TEXT    NOT NULL,
            service_schema      TEXT    NOT NULL,
            branch_id           BIGINT  NOT NULL,
            trace_db_name       TEXT    NOT NULL,
            trace_bu_code       TEXT    NOT NULL,
            trace_db_params     JSONB   NOT NULL DEFAULT '{}'::jsonb,
            trace_branch_id     INT     NOT NULL,
            trace_fin_year_id   INT     NOT NULL,
            acc_purchase        INT     NOT NULL,
            acc_sales           INT     NOT NULL,
            acc_service_income  INT     NOT NULL,
            acc_input_cgst      INT     NOT NULL,
            acc_input_sgst      INT     NOT NULL,
            acc_input_igst      INT     NOT NULL,
            acc_output_cgst     INT     NOT NULL,
            acc_output_sgst     INT     NOT NULL,
            acc_output_igst     INT     NOT NULL,
            acc_debtors         INT     NOT NULL,
            acc_creditors       INT     NOT NULL,
            acc_cash            INT     NOT NULL,
            acc_bank            INT     NOT NULL,
            is_active           BOOLEAN DEFAULT true NOT NULL,
            created_at          TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE public.trace_posting_map ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME public.trace_posting_map_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );
        ALTER TABLE ONLY public.trace_posting_map
            ADD CONSTRAINT trace_posting_map_branch_uidx
            UNIQUE (service_db_name, service_schema, branch_id);
    """

    TRACE_POSTING_LOG_DDL = """
        CREATE TABLE IF NOT EXISTS public.trace_posting_log (
            id                  BIGINT  NOT NULL PRIMARY KEY,
            service_db_name     TEXT    NOT NULL,
            service_schema      TEXT    NOT NULL,
            entity_type         TEXT    NOT NULL,
            entity_id           BIGINT  NOT NULL,
            user_ref_no         TEXT    NOT NULL,
            trace_ref_no        TEXT,
            status              TEXT    NOT NULL DEFAULT 'failed',
            message             TEXT,
            posted_by           TEXT,
            posted_at           TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE public.trace_posting_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME public.trace_posting_log_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );
        ALTER TABLE ONLY public.trace_posting_log
            ADD CONSTRAINT trace_posting_log_entity_uidx
            UNIQUE (service_db_name, service_schema, entity_type, entity_id);
    """

    TRACE_POSTING_MAP_SEED = """
        INSERT INTO public.trace_posting_map (
            service_db_name, service_schema, branch_id,
            trace_db_name, trace_bu_code, trace_db_params,
            trace_branch_id, trace_fin_year_id,
            acc_purchase, acc_sales, acc_service_income,
            acc_input_cgst, acc_input_sgst, acc_input_igst,
            acc_output_cgst, acc_output_sgst, acc_output_igst,
            acc_debtors, acc_creditors, acc_cash, acc_bank
        ) VALUES (
            'service_plus_demo1', 'demo1', 1,
            'trace_db', 'bu_demo1', '{}'::jsonb,
            1, 3,
            1001, 2001, 3001,
            4001, 4002, 4003,
            5001, 5002, 5003,
            6001, 7001, 8001, 8002
        ) ON CONFLICT (service_db_name, service_schema, branch_id) DO NOTHING;
    """
```

### Step 1.2 — Add `trace_posting_log` index DDL

Add to the DDL section:

```python
    TRACE_POSTING_LOG_INDEX = """
        CREATE INDEX IF NOT EXISTS idx_trace_posting_log_status
            ON public.trace_posting_log (status);
        CREATE INDEX IF NOT EXISTS idx_trace_posting_log_posted_at
            ON public.trace_posting_log (posted_at DESC);
    """
```

---

## Phase 2 — Server SQL (SqlStore)

### Step 2.1 — Add posting data fetch queries

**File:** `dev/service-plus-server/app/db/sql_store.py`

Add after `GET_PURCHASE_INVOICES_FOR_POSTING_PAGED`:

```python
    GET_PURCHASE_INVOICE_DETAIL_FOR_POST = """
        with "p_ids" as (values(%(ids)s::bigint[]))
        SELECT
            pi.id, pi.branch_id, pi.supplier_id, s.name AS supplier_name,
            pi.invoice_no, pi.invoice_date,
            pi.aggregate_amount, pi.cgst_amount, pi.sgst_amount, pi.igst_amount,
            pi.total_tax, pi.total_amount, pi.remarks, pi.is_return,
            json_agg(
                json_build_object(
                    'id',               pil.id,
                    'part_id',          pil.part_id,
                    'aggregate_amount', pil.aggregate_amount,
                    'gst_rate',         pil.gst_rate,
                    'cgst_amount',      pil.cgst_amount,
                    'sgst_amount',      pil.sgst_amount,
                    'igst_amount',      pil.igst_amount,
                    'total_amount',     pil.total_amount
                ) ORDER BY pil.id
            ) AS lines
        FROM purchase_invoice pi
        JOIN supplier              s   ON s.id   = pi.supplier_id
        JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
        WHERE pi.id = ANY(table "p_ids") AND pi.is_posted = false
        GROUP BY pi.id, pi.branch_id, pi.supplier_id, s.name, pi.invoice_no,
                 pi.invoice_date, pi.aggregate_amount, pi.cgst_amount, pi.sgst_amount,
                 pi.igst_amount, pi.total_tax, pi.total_amount, pi.remarks, pi.is_return
    """
```

Add after `GET_SALES_INVOICES_FOR_POSTING_PAGED`:

```python
    GET_SALES_INVOICE_DETAIL_FOR_POST = """
        with "p_ids" as (values(%(ids)s::bigint[]))
        SELECT
            si.id, si.division_id, si.customer_contact_id, si.customer_name,
            si.customer_gstin, si.customer_state_code,
            si.invoice_no, si.invoice_date,
            si.aggregate_amount AS aggregate, si.cgst_amount, si.sgst_amount, si.igst_amount,
            si.total_tax, si.total_amount AS amount, si.remarks, si.is_return,
            si.aggregate_amount,
            json_agg(
                json_build_object(
                    'id',               sil.id,
                    'part_id',          sil.part_id,
                    'aggregate_amount', sil.aggregate_amount,
                    'gst_rate',         sil.gst_rate,
                    'cgst_amount',      sil.cgst_amount,
                    'sgst_amount',      sil.sgst_amount,
                    'igst_amount',      sil.igst_amount,
                    'total_amount',     sil.total_amount
                ) ORDER BY sil.id
            ) AS lines
        FROM sales_invoice si
        JOIN sales_invoice_line sil ON sil.sales_invoice_id = si.id
        WHERE si.id = ANY(table "p_ids") AND si.is_posted = false
        GROUP BY si.id
    """
```

Add after `GET_JOB_INVOICES_FOR_POSTING_PAGED`:

```python
    GET_JOB_INVOICE_DETAIL_FOR_POST = """
        with "p_ids" as (values(%(ids)s::bigint[]))
        SELECT
            ji.id, ji.job_id, j.job_no, ji.invoice_no, ji.invoice_date,
            ji.supply_state_code, ji.taxable_amount AS aggregate,
            ji.cgst_amount, ji.sgst_amount, ji.igst_amount,
            ji.total_tax, ji.total_amount AS amount,
            json_agg(
                json_build_object(
                    'id',               jil.id,
                    'description',      jil.description,
                    'hsn_code',         jil.hsn_code,
                    'qty',              jil.qty,
                    'unit_price',       jil.unit_price,
                    'taxable_amount',   jil.taxable_amount,
                    'cgst_amount',      jil.cgst_amount,
                    'sgst_amount',      jil.sgst_amount,
                    'igst_amount',      jil.igst_amount,
                    'total_amount',     jil.total_amount
                ) ORDER BY jil.id
            ) AS lines
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        JOIN job_invoice_line jil ON jil.job_invoice_id = ji.id
        WHERE ji.id = ANY(table "p_ids") AND ji.is_posted = false
        GROUP BY ji.id, ji.job_id, j.job_no, ji.invoice_no, ji.invoice_date,
                 ji.supply_state_code, ji.taxable_amount,
                 ji.cgst_amount, ji.sgst_amount, ji.igst_amount,
                 ji.total_tax, ji.total_amount
    """
```

Add after `GET_JOB_PAYMENTS_FOR_POSTING_PAGED`:

```python
    GET_JOB_PAYMENT_DETAIL_FOR_POST = """
        with "p_ids" as (values(%(ids)s::bigint[]))
        SELECT
            jp.id, jp.job_id, j.job_no, jp.receipt_no, jp.payment_date,
            jp.payment_mode, jp.amount, jp.reference_no, jp.remarks,
            j.customer_contact_id, cc.full_name AS customer_name
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE jp.id = ANY(table "p_ids") AND jp.is_posted = false
    """
```

### Step 2.2 — Add map and log queries

Add near the end of `SqlStore`, before the last closing `"""`:

```python
    # ── Trace-Plus Posting ─────────────────────────────────────────────────────

    GET_TRACE_POSTING_MAP = """
        with
            "p_service_db_name" as (values(%(service_db_name)s::text)),
            "p_service_schema"  as (values(%(service_schema)s::text)),
            "p_branch_id"       as (values(%(branch_id)s::bigint))
        SELECT
            id, service_db_name, service_schema, branch_id,
            trace_db_name, trace_bu_code, trace_db_params,
            trace_branch_id, trace_fin_year_id,
            acc_purchase, acc_sales, acc_service_income,
            acc_input_cgst, acc_input_sgst, acc_input_igst,
            acc_output_cgst, acc_output_sgst, acc_output_igst,
            acc_debtors, acc_creditors, acc_cash, acc_bank
        FROM public.trace_posting_map
        WHERE service_db_name = (table "p_service_db_name")
          AND service_schema  = (table "p_service_schema")
          AND branch_id       = (table "p_branch_id")
          AND is_active = true
    """

    UPSERT_TRACE_POSTING_LOG = """
        INSERT INTO public.trace_posting_log
            (service_db_name, service_schema, entity_type, entity_id,
             user_ref_no, trace_ref_no, status, message, posted_by)
        VALUES
            (%(service_db_name)s, %(service_schema)s, %(entity_type)s, %(entity_id)s,
             %(user_ref_no)s, %(trace_ref_no)s, %(status)s, %(message)s, %(posted_by)s)
        ON CONFLICT (service_db_name, service_schema, entity_type, entity_id)
        DO UPDATE SET
            status       = EXCLUDED.status,
            trace_ref_no = EXCLUDED.trace_ref_no,
            message      = EXCLUDED.message,
            posted_by    = EXCLUDED.posted_by,
            posted_at    = now()
    """

    UPDATE_IS_POSTED = """
        UPDATE {table_name}
        SET is_posted = %(is_posted)s::boolean,
            updated_at = now()
        WHERE id = %(id)s::bigint
    """

    CHECK_POSTING_LOG_EXISTS = """
        with
            "p_service_db_name" as (values(%(service_db_name)s::text)),
            "p_service_schema"  as (values(%(service_schema)s::text)),
            "p_entity_type"     as (values(%(entity_type)s::text)),
            "p_entity_id"       as (values(%(entity_id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM public.trace_posting_log
            WHERE service_db_name = (table "p_service_db_name")
              AND service_schema  = (table "p_service_schema")
              AND entity_type     = (table "p_entity_type")
              AND entity_id       = (table "p_entity_id")
              AND status = 'posted'
        ) AS exists
    """
```

### Step 2.3 — Add SQL map entries (client-side)

**File:** `dev/service-plus-client/src/constants/sql-map.ts`

Add to the `// Accounts Posting` section:

```typescript
    GET_PURCHASE_INVOICE_DETAIL_FOR_POST: "GET_PURCHASE_INVOICE_DETAIL_FOR_POST",
    GET_SALES_INVOICE_DETAIL_FOR_POST:    "GET_SALES_INVOICE_DETAIL_FOR_POST",
    GET_JOB_INVOICE_DETAIL_FOR_POST:      "GET_JOB_INVOICE_DETAIL_FOR_POST",
    GET_JOB_PAYMENT_DETAIL_FOR_POST:      "GET_JOB_PAYMENT_DETAIL_FOR_POST",
```

---

## Phase 3 — Trace HTTP Client

### Step 3.1 — Create `app/services/trace_client.py`

**File:** `dev/service-plus-server/app/services/trace_client.py`

```python
"""
HTTP client for server-to-server communication with Trace-Plus.
Handles service JWT login, token caching, and posting vouchers.
"""

import asyncio
import json
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings
from app.exceptions import AppMessages
from app.logger import logger


class TraceClient:
    """Client for Trace-Plus server GraphQL API with auto-auth."""

    def __init__(self) -> None:
        self._base_url: str = settings.trace_base_url.rstrip("/")
        self._access_token: str | None = None
        self._token_lock = asyncio.Lock()

    async def _login(self) -> str:
        """Authenticate with Trace server and return a bearer token."""
        login_url = f"{self._base_url}/api/login"
        logger.info("Authenticating with Trace-Plus at %s", login_url)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                login_url,
                json={
                    "username": settings.trace_service_username,
                    "password": settings.trace_service_password,
                },
            )
            if resp.status_code != 200:
                logger.error("Trace login failed: %s %s", resp.status_code, resp.text)
                raise ConnectionError(AppMessages.TRACE_LOGIN_FAILED)
            data = resp.json()
            token = data.get("access_token")
            if not token:
                raise ConnectionError(AppMessages.TRACE_LOGIN_FAILED)
            self._access_token = token
            logger.info("Successfully authenticated with Trace-Plus")
            return token

    async def _get_token(self) -> str:
        """Get a valid token, logging in if necessary."""
        if self._access_token:
            return self._access_token
        async with self._token_lock:
            if self._access_token:
                return self._access_token
            return await self._login()

    async def _refresh_token(self) -> str:
        """Force a new login (e.g. on 401)."""
        async with self._token_lock:
            return await self._login()

    async def post_voucher(self, db_name: str, value: dict) -> dict:
        """Post a voucher to Trace-Plus via validateDebitCreditAndUpdate.
        
        Args:
            db_name: Trace database name.
            value:   The full value payload including buCode, dbParams, sqlObject.
        
        Returns:
            Trace response dict — either { autoRefNo: "..." } or { error: ... }.
        """
        token = await self._get_token()
        query = """
            mutation ValidateDebitCreditAndUpdate($dbName: String!, $value: Generic!) {
                validateDebitCreditAndUpdate(dbName: $dbName, value: $value)
            }
        """
        variables = {
            "dbName": db_name,
            "value": value,
        }
        payload = {
            "query": query,
            "variables": variables,
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        last_error: Exception | None = None
        for attempt in range(1, settings.trace_post_max_retries + 2):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(
                        f"{self._base_url}/graphql/",
                        json=payload,
                        headers=headers,
                    )
            except (httpx.TimeoutException, httpx.ConnectionError) as e:
                logger.warning("Trace connection error (attempt %d/%d): %s",
                               attempt, settings.trace_post_max_retries + 1, e)
                last_error = e
                if attempt <= settings.trace_post_max_retries:
                    delay = settings.trace_post_retry_delay_ms / 1000 * (2 ** (attempt - 1))
                    await asyncio.sleep(delay)
                continue

            if resp.status_code == 401:
                logger.info("Trace token expired — re-authenticating")
                token = await self._refresh_token()
                headers["Authorization"] = f"Bearer {token}"
                continue

            if resp.status_code != 200:
                logger.error("Trace HTTP %d: %s", resp.status_code, resp.text)
                return {
                    "error": {"content": {"detail": f"Trace HTTP {resp.status_code}"}}
                }

            try:
                body = resp.json()
            except json.JSONDecodeError:
                return {
                    "error": {"content": {"detail": "Trace returned invalid JSON"}}
                }

            # Graph-level errors
            if "errors" in body:
                detail = body["errors"][0].get("message", "Unknown GraphQL error")
                return {"error": {"content": {"detail": detail}}}

            # Success
            result = body.get("data", {}).get("validateDebitCreditAndUpdate", {})
            if "error" in result:
                return result  # Trace returned error-as-data
            return result

        # All retries exhausted
        return {
            "error": {
                "content": {
                    "detail": f"{AppMessages.TRACE_CONNECTION_FAILED}: {last_error}"
                }
            }
        }


# Singleton
trace_client = TraceClient()
```

---

## Phase 4 — Voucher Builder

### Step 4.1 — Create `app/services/accounts_posting_builder.py`

**File:** `dev/service-plus-server/app/services/accounts_posting_builder.py`

```python
"""
Pure functions that build balanced double-entry voucher structures
(sql_objects) for each Service-Plus entity type.
"""

from typing import Any


def _user_ref_no(entity_type: str, invoice_no: str) -> str:
    prefix = {"purchase": "PI", "sales": "SI", "job": "JI", "receipt": "MR"}
    return f"{prefix[entity_type]}:{invoice_no}"


def build_purchase_voucher(
    row: dict, trace_map: dict, posted_by: str
) -> dict:
    """Build a Purchase Invoice voucher (tranTypeId=5)."""
    aggregate = float(row["aggregate_amount"])
    cgst = float(row["cgst_amount"])
    sgst = float(row["sgst_amount"])
    igst = float(row["igst_amount"])
    total = float(row["total_amount"])

    tran_d: list[dict] = [
        # Dr: Purchase a/c
        {"accId": trace_map["acc_purchase"], "dc": "D", "amount": aggregate},
    ]
    if cgst > 0:
        tran_d.append({"accId": trace_map["acc_input_cgst"], "dc": "D", "amount": cgst})
    if sgst > 0:
        tran_d.append({"accId": trace_map["acc_input_sgst"], "dc": "D", "amount": sgst})
    if igst > 0:
        tran_d.append({"accId": trace_map["acc_input_igst"], "dc": "D", "amount": igst})
    # Cr: Creditor
    tran_d.append({"accId": trace_map["acc_creditors"], "dc": "C", "amount": total})

    return _voucher(row, trace_map, 5, tran_d, posted_by)


def build_sales_voucher(
    row: dict, trace_map: dict, posted_by: str
) -> dict:
    """Build a Sales Invoice voucher (tranTypeId=4)."""
    aggregate = float(row["aggregate"])
    cgst = float(row["cgst_amount"])
    sgst = float(row["sgst_amount"])
    igst = float(row["igst_amount"])
    total = float(row["amount"])

    tran_d: list[dict] = [
        # Dr: Debtor
        {"accId": trace_map["acc_debtors"], "dc": "D", "amount": total},
        # Cr: Sales a/c
        {"accId": trace_map["acc_sales"], "dc": "C", "amount": aggregate},
    ]
    if cgst > 0:
        tran_d.append({"accId": trace_map["acc_output_cgst"], "dc": "C", "amount": cgst})
    if sgst > 0:
        tran_d.append({"accId": trace_map["acc_output_sgst"], "dc": "C", "amount": sgst})
    if igst > 0:
        tran_d.append({"accId": trace_map["acc_output_igst"], "dc": "C", "amount": igst})

    return _voucher(row, trace_map, 4, tran_d, posted_by)


def build_job_voucher(
    row: dict, trace_map: dict, posted_by: str
) -> dict:
    """Build a Job Invoice voucher (tranTypeId=4 — Sales)."""
    aggregate = float(row["aggregate"])
    cgst = float(row["cgst_amount"])
    sgst = float(row["sgst_amount"])
    igst = float(row["igst_amount"])
    total = float(row["amount"])

    tran_d: list[dict] = [
        # Dr: Debtor
        {"accId": trace_map["acc_debtors"], "dc": "D", "amount": total},
        # Cr: Service Income a/c
        {"accId": trace_map["acc_service_income"], "dc": "C", "amount": aggregate},
    ]
    if cgst > 0:
        tran_d.append({"accId": trace_map["acc_output_cgst"], "dc": "C", "amount": cgst})
    if sgst > 0:
        tran_d.append({"accId": trace_map["acc_output_sgst"], "dc": "C", "amount": sgst})
    if igst > 0:
        tran_d.append({"accId": trace_map["acc_output_igst"], "dc": "C", "amount": igst})

    return _voucher(row, trace_map, 4, tran_d, posted_by)


def build_receipt_voucher(
    row: dict, trace_map: dict, posted_by: str
) -> dict:
    """Build a Money Receipt voucher (tranTypeId=3 — Receipt)."""
    amount = float(row["amount"])
    payment_mode: str = row.get("payment_mode", "Cash")
    acc_cash_or_bank = (
        trace_map["acc_cash"] if payment_mode.lower() == "cash"
        else trace_map["acc_bank"]
    )

    tran_d: list[dict] = [
        # Dr: Cash/Bank
        {"accId": acc_cash_or_bank, "dc": "D", "amount": amount},
        # Cr: Debtor
        {"accId": trace_map["acc_debtors"], "dc": "C", "amount": amount},
    ]

    return _voucher(row, trace_map, 3, tran_d, posted_by)


def _voucher(
    row: dict, trace_map: dict, tran_type_id: int,
    tran_d: list[dict], posted_by: str
) -> dict:
    """Build the final voucher sql_object structure."""
    entity_type = row.get("_entity_type", "purchase")
    invoice_no = row.get("invoice_no") or row.get("receipt_no") or ""
    invoice_date = row.get("invoice_date") or row.get("payment_date") or ""

    # Validate debit == credit
    total_dr = sum(float(l["amount"]) for l in tran_d if l["dc"] == "D")
    total_cr = sum(float(l["amount"]) for l in tran_d if l["dc"] == "C")
    # Round to 2 decimal places for comparison
    if round(total_dr, 2) != round(total_cr, 2):
        raise ValueError(
            f"Debit ({total_dr}) != Credit ({total_cr}) for {entity_type} {row.get('id')}"
        )

    return {
        "tableName": "TranH",
        "xData": {
            "tranDate": str(invoice_date),
            "finYearId": trace_map["trace_fin_year_id"],
            "branchId": trace_map["trace_branch_id"],
            "tranTypeId": tran_type_id,
            "userRefNo": _user_ref_no(entity_type, str(invoice_no)),
            "remarks": f"{entity_type} {invoice_no}",
            "xDetails": [
                {
                    "tableName": "TranD",
                    "xData": tran_d,
                }
            ],
        },
    }
```

---

## Phase 5 — Orchestrator

### Step 5.1 — Add `resolve_post_to_accounts_helper` to `mutation_helper.py`

**File:** `dev/service-plus-server/app/graphql/resolvers/mutation_helper.py`

Add imports at top:

```python
from app.services.trace_client import trace_client
from app.services.accounts_posting_builder import (
    build_purchase_voucher,
    build_sales_voucher,
    build_job_voucher,
    build_receipt_voucher,
)
```

Add helper functions at end of file:

```python
# ── Trace-Plus Accounts Posting ───────────────────────────────────────


async def resolve_post_to_accounts_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Orchestrate posting selected entities to Trace-Plus.
    
    Value payload (URL-encoded JSON):
    {
        "entity_type": "purchase"|"sales"|"job"|"receipt",
        "ids": [1, 2, 3],
        "branch_id": 10,
        "actor": "username"
    }
    """
    payload = _decode_value(value, "postToAccounts")

    entity_type: str = payload.get("entity_type", "")
    ids: list[int] = payload.get("ids", [])
    branch_id: int | None = payload.get("branch_id")
    actor: str = payload.get("actor", "system")

    if not entity_type or not ids or not branch_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["entity_type", "ids", "branch_id"]},
        )

    if entity_type not in ("purchase", "sales", "job", "receipt"):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": f"Unknown entity_type: {entity_type}"},
        )

    logger.info(
        "Posting %d %s items to Trace-Plus (db=%s, schema=%s, branch=%d)",
        len(ids), entity_type, db_name, schema, branch_id,
    )

    # ── 1. Fetch trace posting map ──
    map_rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.GET_TRACE_POSTING_MAP,
        sql_args={
            "service_db_name": db_name,
            "service_schema": schema,
            "branch_id": branch_id,
        },
    )
    if not map_rows:
        raise ValidationException(
            message=AppMessages.TRACE_MAP_NOT_FOUND,
            extensions={"branch_id": branch_id},
        )
    trace_map = map_rows[0]

    # ── 2. Fetch entity detail rows ──
    detail_sql = _get_detail_sql_id(entity_type)
    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=getattr(SqlStore, detail_sql),
        sql_args={"ids": ids},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.TRACE_ENTITY_NOT_FOUND,
            extensions={"entity_type": entity_type, "ids": ids},
        )

    # ── 3. Annotate rows with entity type for builders ──
    for r in rows:
        r["_entity_type"] = entity_type

    # ── 4. Build and post each item ──
    results: list[dict] = []
    posted_count = 0
    skipped_count = 0
    failed_count = 0

    for row in rows:
        entity_id = row["id"]
        user_ref_no = _build_user_ref_no(entity_type, row)

        result: dict = {"id": entity_id, "status": "unknown", "message": ""}

        # Skip if already posted (local guard)
        log_exists = await exec_sql(
            db_name=None,
            schema="public",
            sql=SqlStore.CHECK_POSTING_LOG_EXISTS,
            sql_args={
                "service_db_name": db_name,
                "service_schema": schema,
                "entity_type": entity_type,
                "entity_id": entity_id,
            },
        )
        if log_exists and log_exists[0].get("exists"):
            result["status"] = "skipped"
            result["message"] = "Already posted"
            skipped_count += 1
            results.append(result)
            continue

        # ── 5. Build voucher ──
        try:
            builder = _get_builder(entity_type)
            voucher = builder(row, trace_map, actor)
        except ValueError as e:
            result["status"] = "failed"
            result["message"] = str(e)
            failed_count += 1
            await _upsert_posting_log(
                db_name, schema, entity_type, entity_id,
                user_ref_no, None, "failed", str(e), actor,
            )
            results.append(result)
            continue

        # ── 6. Post to Trace ──
        trace_value = {
            "buCode": trace_map["trace_bu_code"],
            "dbParams": trace_map.get("trace_db_params", {}),
            **voucher,
        }
        trace_resp = await trace_client.post_voucher(
            trace_map["trace_db_name"], trace_value
        )

        if "error" in trace_resp:
            err_detail = (
                trace_resp["error"]
                .get("content", {})
                .get("detail", "Unknown Trace error")
            )
            result["status"] = "failed"
            result["message"] = f"Trace: {err_detail}"
            failed_count += 1
            await _upsert_posting_log(
                db_name, schema, entity_type, entity_id,
                user_ref_no, None, "failed", err_detail, actor,
            )
            results.append(result)
            continue

        # ── 7. Success — flip is_posted and log ──
        trace_ref_no = trace_resp.get("autoRefNo", "")

        table_name = _get_table_name(entity_type)
        await exec_sql(
            db_name=db_name,
            schema=schema,
            sql=SqlStore.UPDATE_IS_POSTED.format(table_name=table_name),
            sql_args={"id": entity_id, "is_posted": True},
        )

        await _upsert_posting_log(
            db_name, schema, entity_type, entity_id,
            user_ref_no, trace_ref_no, "posted", "", actor,
        )

        # Audit log
        await audit_logger.log(
            action=AuditAction.ACCOUNTS_POSTED,
            actor_type="business_user",
            actor_username=actor,
            resource_id=str(entity_id),
            resource_type=entity_type,
            detail=f"Posted {user_ref_no} to Trace → {trace_ref_no}",
        )

        result["status"] = "posted"
        result["trace_ref"] = trace_ref_no
        posted_count += 1
        results.append(result)

    return {
        "requested": len(ids),
        "posted": posted_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "results": results,
    }


def _get_detail_sql_id(entity_type: str) -> str:
    mapping = {
        "purchase": "GET_PURCHASE_INVOICE_DETAIL_FOR_POST",
        "sales": "GET_SALES_INVOICE_DETAIL_FOR_POST",
        "job": "GET_JOB_INVOICE_DETAIL_FOR_POST",
        "receipt": "GET_JOB_PAYMENT_DETAIL_FOR_POST",
    }
    return mapping[entity_type]


def _get_builder(entity_type: str):
    mapping = {
        "purchase": build_purchase_voucher,
        "sales": build_sales_voucher,
        "job": build_job_voucher,
        "receipt": build_receipt_voucher,
    }
    return mapping[entity_type]


def _get_table_name(entity_type: str) -> str:
    mapping = {
        "purchase": "purchase_invoice",
        "sales": "sales_invoice",
        "job": "job_invoice",
        "receipt": "job_payment",
    }
    return mapping[entity_type]


def _build_user_ref_no(entity_type: str, row: dict) -> str:
    invoice_no = row.get("invoice_no") or row.get("receipt_no") or str(row["id"])
    return f"{entity_type}:{invoice_no}"


async def _upsert_posting_log(
    db_name: str, schema: str, entity_type: str, entity_id: int,
    user_ref_no: str, trace_ref_no: str | None,
    status: str, message: str, posted_by: str,
) -> None:
    await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.UPSERT_TRACE_POSTING_LOG,
        sql_args={
            "service_db_name": db_name,
            "service_schema": schema,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_ref_no": user_ref_no,
            "trace_ref_no": trace_ref_no,
            "status": status,
            "message": message,
            "posted_by": posted_by,
        },
    )
```

### Step 5.2 — Add `AuditAction.ACCOUNTS_POSTED`

**File:** `dev/service-plus-server/app/core/audit_log.py`

Add inside `AuditAction` class:

```python
    ACCOUNTS_POSTED = "ACCOUNTS_POSTED"
```

---

## Phase 6 — GraphQL Wiring

### Step 6.1 — Add mutation to schema

**File:** `dev/service-plus-server/app/graphql/schema.graphql`

Add to the `Mutation` type:

```graphql
    postToAccounts(db_name: String!, schema: String, value: String!): Generic
```

### Step 6.2 — Add resolver

**File:** `dev/service-plus-server/app/graphql/resolvers/mutation.py`

Add import:

```python
from app.graphql.resolvers.mutation_helper import (
    ...
    resolve_post_to_accounts_helper,
)
```

Add resolver function (before the closing of the file):

```python
@mutation.field("postToAccounts")
async def resolve_post_to_accounts(
    _, info, db_name: str = "", schema: str = "public", value: str = ""
) -> Any:
    try:
        return await resolve_post_to_accounts_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error posting to accounts: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )
```

---

## Phase 7 — Client Wiring

### Step 7.1 — Add `postToAccounts` to `GRAPHQL_MAP`

**File:** `dev/service-plus-client/src/constants/graphql-map.ts`

Add after the last mutation entry:

```typescript
    postToAccounts: gql`
        mutation PostToAccounts($db_name: String!, $schema: String, $value: String!) {
            postToAccounts(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
```

### Step 7.2 — Create `posting-service.ts`

**File:** `dev/service-plus-client/src/features/client/components/jobs/accounts-posting/posting-service.ts`

```typescript
import { apolloClient } from "@/lib/apollo-client";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { encodeObj } from "@/lib/graphql-utils";

export interface PostResult {
    id: number;
    status: "posted" | "skipped" | "failed";
    trace_ref?: string;
    message?: string;
}

export interface PostToAccountsResponse {
    requested: number;
    posted: number;
    skipped: number;
    failed: number;
    results: PostResult[];
}

export async function postToAccounts(
    dbName: string,
    schema: string,
    entityType: "purchase" | "sales" | "job" | "receipt",
    ids: number[],
    branchId: number,
    actor: string,
): Promise<PostToAccountsResponse> {
    const value = encodeObj({ entity_type: entityType, ids, branch_id: branchId, actor });
    const { data } = await apolloClient.mutate<{ postToAccounts: PostToAccountsResponse }>({
        mutation: GRAPHQL_MAP.postToAccounts,
        variables: { db_name: dbName, schema, value },
    });
    return data!.postToAccounts;
}
```

### Step 7.3 — Wire the "Post Selected" button

**File:** `dev/service-plus-client/src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx`

Replace the current `handlePostAllSelected` placeholder:

```typescript
import { postToAccounts } from "./posting-service";
import { useSelector } from "react-redux";
// ... existing imports

const handlePostAllSelected = useCallback(async () => {
    const actor = useSelector((state: any) => state.auth.user?.username) || "user";
    const { dbName, schema } = useContext(/* DbContext or similar */);

    // Build selection per entity type
    const selections: Array<{
        entityType: "purchase" | "sales" | "job" | "receipt";
        ids: number[];
    }> = [];

    if (selectedPurchaseIds.size > 0) {
        selections.push({ entityType: "purchase", ids: [...selectedPurchaseIds] });
    }
    if (selectedSalesIds.size > 0) {
        selections.push({ entityType: "sales", ids: [...selectedSalesIds] });
    }
    if (selectedJobIds.size > 0) {
        selections.push({ entityType: "job", ids: [...selectedJobIds] });
    }
    if (selectedReceiptIds.size > 0) {
        selections.push({ entityType: "receipt", ids: [...selectedReceiptIds] });
    }

    if (selections.length === 0) return;

    let totalRequested = 0;
    let totalPosted = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const allResults: PostResult[] = [];

    for (const sel of selections) {
        try {
            const resp = await postToAccounts(
                dbName, schema, sel.entityType, sel.ids, branchId, actor
            );
            totalRequested += resp.requested;
            totalPosted += resp.posted;
            totalSkipped += resp.skipped;
            totalFailed += resp.failed;
            allResults.push(...resp.results);
        } catch (err: any) {
            toast.error(`Failed to post ${sel.entityType}: ${err.message}`);
            totalFailed += sel.ids.length;
        }
    }

    // Show summary
    if (totalFailed > 0) {
        toast.error(
            `Posted ${totalPosted}, skipped ${totalSkipped}, failed ${totalFailed}`
        );
    } else if (totalPosted > 0) {
        toast.success(`Successfully posted ${totalPosted} item(s)`);
    } else if (totalSkipped > 0) {
        toast.info(`All ${totalSkipped} item(s) were already posted`);
    }

    // Clear selections
    setSelectedPurchaseIds(new Set());
    setSelectedSalesIds(new Set());
    setSelectedJobIds(new Set());
    setSelectedReceiptIds(new Set());

    // Refresh grids
    refreshAllGrids();
}, [
    selectedPurchaseIds, selectedSalesIds, selectedJobIds, selectedReceiptIds,
    branchId, refreshAllGrids,
]);
```

**Important integration note:** The above code is illustrative. The actual implementation must:
1. Import `useSelector` from `react-redux` and access `rootReducer` shape. Currently the component may already have access to `dbName`, `schema`, `branchId` via props or context.
2. The `refreshAllGrids` function should call `loadData()` on all four grids (or each grid's refresh function). This is already implemented as separate `loadData` calls per grid.
3. For the actual integration, identify the existing props passed down from the parent (check `AccountsPostingSection` component props).

### Step 7.4 — Add `postToAccounts` to SQL map entries (if needed for query-only)

**File:** `dev/service-plus-client/src/constants/sql-map.ts` — already done in Step 2.3.

---

## Phase 8 — Testing

### Step 8.1 — Unit test: voucher builder

**File:** `dev/service-plus-server/tests/test_accounts_posting_builder.py`

```python
"""
Unit tests for accounts_posting_builder — validates debit == credit invariant.
"""

import pytest
from app.services.accounts_posting_builder import (
    build_purchase_voucher,
    build_sales_voucher,
    build_job_voucher,
    build_receipt_voucher,
)


TRACE_MAP = {
    "acc_purchase": 101,
    "acc_sales": 102,
    "acc_service_income": 103,
    "acc_input_cgst": 201,
    "acc_input_sgst": 202,
    "acc_input_igst": 203,
    "acc_output_cgst": 301,
    "acc_output_sgst": 302,
    "acc_output_igst": 303,
    "acc_debtors": 401,
    "acc_creditors": 501,
    "acc_cash": 601,
    "acc_bank": 602,
    "trace_branch_id": 1,
    "trace_fin_year_id": 3,
}


def test_purchase_voucher_balanced():
    row = {
        "id": 1,
        "invoice_no": "PI-001",
        "invoice_date": "2026-06-15",
        "aggregate_amount": 10000.00,
        "cgst_amount": 900.00,
        "sgst_amount": 900.00,
        "igst_amount": 0,
        "total_amount": 11800.00,
        "_entity_type": "purchase",
    }
    voucher = build_purchase_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    dr = sum(l["amount"] for l in tran_d if l["dc"] == "D")
    cr = sum(l["amount"] for l in tran_d if l["dc"] == "C")
    assert round(dr, 2) == round(cr, 2)


def test_sales_voucher_balanced():
    row = {
        "id": 1,
        "invoice_no": "SI-001",
        "invoice_date": "2026-06-15",
        "aggregate": 10000.00,
        "cgst_amount": 900.00,
        "sgst_amount": 900.00,
        "igst_amount": 0,
        "amount": 11800.00,
        "_entity_type": "sales",
    }
    voucher = build_sales_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    dr = sum(l["amount"] for l in tran_d if l["dc"] == "D")
    cr = sum(l["amount"] for l in tran_d if l["dc"] == "C")
    assert round(dr, 2) == round(cr, 2)


def test_job_voucher_balanced():
    row = {
        "id": 1,
        "invoice_no": "JI-001",
        "invoice_date": "2026-06-15",
        "aggregate": 5000.00,
        "cgst_amount": 450.00,
        "sgst_amount": 450.00,
        "igst_amount": 0,
        "amount": 5900.00,
        "_entity_type": "job",
    }
    voucher = build_job_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    dr = sum(l["amount"] for l in tran_d if l["dc"] == "D")
    cr = sum(l["amount"] for l in tran_d if l["dc"] == "C")
    assert round(dr, 2) == round(cr, 2)


def test_receipt_voucher_balanced():
    row = {
        "id": 1,
        "receipt_no": "RCP-001",
        "payment_date": "2026-06-15",
        "payment_mode": "Cash",
        "amount": 5000.00,
        "_entity_type": "receipt",
    }
    voucher = build_receipt_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    dr = sum(l["amount"] for l in tran_d if l["dc"] == "D")
    cr = sum(l["amount"] for l in tran_d if l["dc"] == "C")
    assert round(dr, 2) == round(cr, 2)


def test_receipt_voucher_bank():
    row = {
        "id": 2,
        "receipt_no": "RCP-002",
        "payment_date": "2026-06-15",
        "payment_mode": "Bank Transfer",
        "amount": 10000.00,
        "_entity_type": "receipt",
    }
    voucher = build_receipt_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    # Should use bank a/c (602), not cash (601)
    dr_line = next(l for l in tran_d if l["dc"] == "D")
    assert dr_line["accId"] == TRACE_MAP["acc_bank"]


def test_purchase_voucher_no_gst():
    row = {
        "id": 2,
        "invoice_no": "PI-002",
        "invoice_date": "2026-06-15",
        "aggregate_amount": 5000.00,
        "cgst_amount": 0,
        "sgst_amount": 0,
        "igst_amount": 0,
        "total_amount": 5000.00,
        "_entity_type": "purchase",
    }
    voucher = build_purchase_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    # Only 2 lines: Dr purchase + Cr creditor (no GST lines)
    assert len(tran_d) == 2
    dr = sum(l["amount"] for l in tran_d if l["dc"] == "D")
    cr = sum(l["amount"] for l in tran_d if l["dc"] == "C")
    assert round(dr, 2) == round(cr, 2)


def test_purchase_voucher_igst_only():
    row = {
        "id": 3,
        "invoice_no": "PI-003",
        "invoice_date": "2026-06-15",
        "aggregate_amount": 10000.00,
        "cgst_amount": 0,
        "sgst_amount": 0,
        "igst_amount": 1800.00,
        "total_amount": 11800.00,
        "_entity_type": "purchase",
    }
    voucher = build_purchase_voucher(row, TRACE_MAP, "testuser")
    tran_d = voucher["xData"]["xDetails"][0]["xData"]
    # 3 lines: Dr purchase + Dr IGST + Cr creditor
    assert len(tran_d) == 3
    dr = sum(l["amount"] for l in tran_d if l["dc"] == "D")
    cr = sum(l["amount"] for l in tran_d if l["dc"] == "C")
    assert round(dr, 2) == round(cr, 2)
```

---

## Execution Order

| Step | File(s) | What to do |
|------|---------|------------|
| 0.1 | `app/config.py` | Add Trace settings |
| 0.2 | `app/exceptions.py` | Add Trace messages |
| 1.1 | `app/db/sql_bu.py` | Add DDL for `trace_posting_map`, `trace_posting_log` |
| 1.2 | Run DDL against client DB | Execute via migration script |
| 2.1 | `app/db/sql_store.py` | Add 4 detail-for-post queries |
| 2.2 | `app/db/sql_store.py` | Add map + log + update queries |
| 2.3 | `src/constants/sql-map.ts` | Add 4 SQL map keys |
| 3.1 | `app/services/trace_client.py` | Create Trace HTTP client |
| 4.1 | `app/services/accounts_posting_builder.py` | Create voucher builder |
| 5.1 | `app/graphql/resolvers/mutation_helper.py` | Add orchestrator helper |
| 5.2 | `app/core/audit_log.py` | Add `ACCOUNTS_POSTED` action |
| 6.1 | `app/graphql/schema.graphql` | Add `postToAccounts` mutation |
| 6.2 | `app/graphql/resolvers/mutation.py` | Add resolver |
| 7.1 | `src/constants/graphql-map.ts` | Add `postToAccounts` gql |
| 7.2 | Create `posting-service.ts` | Client-side posting service |
| 7.3 | `accounts-posting-section.tsx` | Wire Post Selected button |
| 8.1 | `tests/test_accounts_posting_builder.py` | Unit tests |

---

## Verification

After each phase:
- **Phase 0:** `print(settings.trace_base_url)` loads without error
- **Phase 1:** `SELECT * FROM public.trace_posting_map` returns seeded row
- **Phase 2:** Run each new SQL query against a test DB — verify correct data shape
- **Phase 3:** `await trace_client._login()` returns a valid token
- **Phase 4:** `pytest tests/test_accounts_posting_builder.py -v` — all 6 tests pass
- **Phase 5:** Manual test with one item via playground
- **Phase 6:** GraphQL playground shows `postToAccounts` mutation
- **Phase 7:** Click "Post Selected" → success toast; rows move to Posted tab
- **Phase 8:** `pytest tests/ -v` — all tests pass including new unit tests
