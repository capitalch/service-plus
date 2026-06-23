# Division Strategy — Analysis, Advantages, Pitfalls, and Codebase Adherence

---

## 1. The Strategy (from tran.md)

1. One branch can have many divisions.
2. Each division can post data to a specific accounts database, based on its `account_setting`.
3. User can receive a job in any available division.
4. A division is GST if it has a `gstin` number (stored in the `division.gstin` column); non-GST otherwise.
5. GST aspects of an invoice must depend on whether the division is GST or non-GST.
6. Invoicing must be done GST or non-GST, based on the division's GST status (`division.gstin`).
7. User can change the division **anytime before the job is finalized** — GST aspects must update accordingly.
8. User **cannot change the division once the job is finalized** (`is_final = true`).

---

## 2. Advantages of the Strategy

### 2.1 Clean separation of GST and non-GST billing
A single branch may serve both registered (B2B) and unregistered (B2C) customers, or may operate in both inter-state and intra-state contexts. By anchoring GST treatment to the division and not to the customer or job type, the strategy provides a deterministic, auditable rule: the invoice's GST character is always derivable from the division at the time of creation.

### 2.2 Accounts isolation per division
`account_setting` (a JSONB column on the `division` table) stores separate debit/credit account IDs for job invoices, sales invoices, purchase invoices, and receipts. This allows one branch to route different revenue streams to different GL accounts without any shared-state ambiguity.

### 2.3 Division change flexibility before finalization
The strategy consciously allows division change before `is_final = true`. This is correct business logic: before a job is finalized, the scope of work (and hence whether GST applies) can genuinely change. Allowing this with automatic recalculation of tax rates (CGST/SGST vs IGST vs no tax) avoids the need to cancel and re-receive the job.

### 2.4 Hard stop at finalization
Once a job is finalized (`is_final = true`), the division is locked. This protects the integrity of the invoice and its GST computation. An invoice already sent to a customer cannot have its supply state, GSTIN, or tax split retroactively altered.

### 2.5 IGST vs CGST/SGST handled at the job level
The `is_igst` flag on the `job` table lets users declare inter-state supply per job, not per invoice line. This simplifies the UI and ensures a single invoice does not mix IGST and CGST/SGST lines for the same transaction, which is a GST compliance requirement.

---

## 3. Pitfalls of the Strategy

### 3.1 `gstin` is a direct column on `division` — not in `account_setting`
The strategy document says "A division is GST if `gstin` is in `account_setting`," but this wording is misleading. The correct and final design decision is:

- `gstin` is stored **only** as a direct column on the `division` table — single source of truth, no duplication.
- `account_setting` (JSONB) is purely for accounts routing (GL account IDs, client/BU codes for Trace+ integration). It has no GST fields.
- `isGstDivision` (`division.ts:48`) correctly reads `d?.gstin` from the DB column.
- The Add Division and Edit Division forms collect GSTIN in the **Details tab** as a standalone field, which is written directly to `division.gstin` in the DB.
- All PDFs, the division list, and the search filter read `division.gstin` directly — one place, zero duplication.

The strategy document should be read as: "A division is GST if it has a `gstin` number," with the storage location being the `division.gstin` column, not inside the `account_setting` JSONB.

### 3.2 `supply_state_code` snapshotted at invoice creation, not re-derived
When an invoice is created (`delivery-modal.tsx:334`):
```typescript
supply_state_code: division?.gst_state_code ?? "",
```
The `gst_state_code` is copied from the division at that moment and stored in `job_invoice.supply_state_code`. If the division's state is ever corrected, existing invoices are not updated. This is correct for finalized jobs (the strategy mandates locking), but creates an inconsistency if a job's invoice is regenerated after a division data fix.

### 3.3 The strategy does not address `is_igst` locking
`is_igst` is set on the job at finalization time (`final-a-job-section.tsx:607`) and is part of the `is_final` snapshot. However, the strategy document does not mention this flag at all. If a user incorrectly marks a job as IGST before finalization, there is no way to correct it without reopening the job (unfinalize), which the UI must separately support.

### ~~3.4 Division change before finalization does not update in-flight invoice lines~~ **FIXED**
**Previously:** If a job had charges/parts recorded under division A (GST), and the user then changed to division B (non-GST) before finalization, the existing `job_part_used` and `job_additional_charge` records retained their original `gst_rate` values in the database. Reopening the job before finalization would show stale rates loaded from DB.

**Fix applied (`final-a-job-section.tsx:handleDivisionChange`):** When the GST status of the new division differs from the current one, `handleDivisionChange` now fires a `genericUpdate` mutation immediately after updating local state. The mutation writes `division_id` to the `job` row (anchoring the xDetails nesting) and bulk-updates `gst_rate`, `hsn_code`, `cost_price`, and `selling_price` on all existing `job_part_used` and `job_additional_charge` records for that job. New (unsaved) lines have no DB id and are skipped — they already hold the correct values in local state and are written at finalization. The finalization step's own write remains unchanged.

### ~~3.5 No enforcement of "one invoice per job" at the DB level~~ **FIXED**
**Previously:** The `job_invoice` table had a FK to `job.id` but no UNIQUE constraint on `job_id`. Two concurrent invoice-creation requests for the same job could both pass the client-side `if (job.invoice_id)` guard (stale data), claim separate sequence numbers, and insert duplicate rows — both succeeding because only `invoice_no` was unique, not `job_id`.

**Fix applied (two layers):**
- **Layer 1 — DB constraint (implemented in DB directly):** `UNIQUE (job_id)` added to `job_invoice`. Makes duplicate insertion physically impossible regardless of application behaviour.
- **Layer 2 — Server idempotency guard (`mutation_helper.py:resolve_create_job_invoice_helper`):** Before claiming a sequence number, executes `GET_JOB_INVOICE_ID_BY_JOB_FOR_UPDATE` (`sql_store.py`) — a `SELECT id … FOR UPDATE` on the job's existing invoice row. If a row is found, the existing invoice id is returned immediately without consuming a sequence number or inserting anything. The `FOR UPDATE` lock serialises concurrent transactions: the second caller blocks until the first commits, then finds the newly inserted row and exits cleanly.

---

## 4. Codebase Adherence

### ✅ RULE 1: One branch → many divisions
**Adhered.**
- `division` table has `branch_id` FK: `sql_bu.py:80`
- Index `idx_division_branch_active` on `(branch_id, is_active)`: `sql_bu.py`
- UI fetches divisions filtered by `branch_id` via `GET_DIVISIONS_BY_BRANCH` query

---

### ✅ RULE 2: Each division posts to accounts via `account_setting`
**Adhered.**
- `account_setting` is a JSONB column on the `division` table, containing per-document-type debit/credit account mappings.
- `resolve_accounts_posting_helper` in `mutation_helper.py` fetches all divisions, reads each one's `account_setting`, and posts invoices/receipts per division to the accounts system.
- Divisions without a valid `account_setting` are silently skipped.

---

### ✅ RULE 3: User can receive a job in any available division
**Adhered.**
- `new-single-job-form.tsx:178` renders a division selector when `divisions.length > 1`.
- `job.division_id` is set at job creation and is a NOT NULL FK.

---

### ✅ RULE 4: Division is GST if `gstin` is present
**Adhered.**
- `gstin` lives solely in the `division.gstin` DB column — single source of truth.
- `isGstDivision` in `division.ts:48` reads it directly:
  ```typescript
  export const isGstDivision = (d: DivisionContextType | null) => !!d?.gstin;
  ```
- The Add/Edit Division forms (Details tab) are the only place where GSTIN is entered and saved. `account_setting` has no GSTIN field.

---

### ✅ RULE 5 & 6: Invoice GST aspects follow division's GST status
**Adhered.**
- `buildInvoiceLines` in `delivery-modal.tsx:83–159` is the central invoicing function. It takes `isGst: boolean` (derived from `isGstDivision(division)`) and `forceIgst: boolean` (from `job.is_igst`).
- The internal `computeTax` function (`delivery-modal.tsx:89–94`):
  ```typescript
  function computeTax(taxable: number, gstRate: number) {
      if (!isGst || gstRate === 0) return { cgst: 0, sgst: 0, igst: 0 };
      if (forceIgst) return { cgst: 0, sgst: 0, igst: Math.round(taxable * gstRate) / 100 };
      const half = Math.round(taxable * gstRate / 2) / 100;
      return { cgst: half, sgst: half, igst: 0 };
  }
  ```
  - Non-GST division → all taxes zero.
  - GST + IGST flag → only IGST computed.
  - GST + no IGST → CGST and SGST split equally.
- `supply_state_code` written to `job_invoice` from `division.gst_state_code` at creation time (`delivery-modal.tsx:334`).
- HSN codes included only for GST divisions (`delivery-modal.tsx:108, 127`).

---

### ✅ RULE 7: Division change allowed before finalization, GST updates accordingly
**Partially adhered — the recalculation is deferred to invoice generation.**
- `final-a-job-section.tsx` contains `handleDivisionChange` which updates `selectedDivisionId` and recalculates GST rates on displayed part lines.
- The division change is persisted to `job.division_id` when the job is saved.
- At invoice generation, `buildInvoiceLines` re-reads the current division's GST status and recomputes all taxes from scratch — so the final invoice is always correct regardless of intermediate division changes.
- **Caveat:** The intermediate view of parts (before delivery/invoicing) may show stale `gst_rate` values from before the division change, since `job_part.gst_rate` is not retroactively updated when division changes.

---

### ❌ RULE 8: Division cannot be changed after finalization — **NOT ENFORCED**

This is the primary deviation from the strategy. There are three layers where this guard should exist and none of them implement it.

#### Layer 1 — Client-side UI guard: MISSING
**File:** `final-a-job-section.tsx`, edit mode condition (lines 462–475):
```typescript
// Edit mode is enabled if invoice is NOT posted
!row.is_posted && (!row.invoice_id || !row.invoice_is_posted)
```
The edit gate checks `invoice_is_posted`, not `is_final`. A finalized job without a posted invoice can have its division changed from the UI.

**File:** `new-single-job-form.tsx:178` — the division selector in the job creation/edit form has no `disabled` condition tied to `is_final`.

#### Layer 2 — Server-side mutation guard: MISSING
**File:** `mutation_helper.py`, `resolve_update_job_helper` (lines 1147–1214):
```python
async def resolve_update_job_helper(db_name, schema, value):
    payload = _decode_value(value, "updateJob")
    job_id = payload.pop("job_id")
    x_data = payload.get("xData", {})
    # ... directly calls process_data to update the job row
    # NO check: if x_data contains division_id, is_final is not queried
```
The server blindly applies whatever `xData` is sent. If `division_id` is included in the payload, it is updated with no validation of the current `is_final` state.

#### Layer 3 — Database constraint: MISSING
The `job` table DDL (`sql_bu.py:154–188`) has no CHECK constraint or trigger that prevents `division_id` from being changed when `is_final = true`. The FK constraint only ensures referential integrity (the division must exist), not business-rule integrity.

---

## 5. Summary Table

| Strategy Rule | Status | Where |
|---|---|---|
| One branch → many divisions | ✅ Adhered | `sql_bu.py`, `GET_DIVISIONS_BY_BRANCH` |
| Division posts via `account_setting` | ✅ Adhered | `mutation_helper.py`, `division.ts` |
| Job received in any division | ✅ Adhered | `new-single-job-form.tsx:178` |
| GST = `division.gstin` column present | ✅ Adhered | `division.ts:48`, Details tab in forms |
| Invoice GST follows division | ✅ Adhered | `delivery-modal.tsx:89–94` |
| Invoicing GST/non-GST by `division.gstin` | ✅ Adhered | `delivery-modal.tsx:89–94`, `buildInvoiceLines` |
| Division change before final, GST updates | ✅ Partially | `final-a-job-section.tsx`, deferred to invoice generation |
| Division locked after `is_final = true` | ❌ Not enforced | Missing at UI, server, and DB layers |

---

## 6. Recommended Fixes for the Deviation

### Fix A — Server guard (highest priority)
In `resolve_update_job_helper` (`mutation_helper.py`), before applying the update, if `division_id` is in `xData`, fetch the current job and reject if `is_final = true`:
```python
if "division_id" in x_data:
    row = await cur.execute("SELECT is_final FROM job WHERE id = %(id)s", {"id": job_id})
    if row and row["is_final"]:
        raise ValidationException("Cannot change division after job is finalized.")
```

### Fix B — Client guard
In `final-a-job-section.tsx`, disable the division selector when `job.is_final = true`. This is the UI equivalent of the server guard and provides immediate feedback.

### Fix C — Database constraint (optional, defensive)
Add a trigger on the `job` table that raises an exception if `division_id` is changed while `is_final = true`. This makes the rule enforceable even if the application layer is bypassed.
