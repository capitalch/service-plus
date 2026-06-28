# Plan — GSTIN capture across the Job lifecycle (customer-only model)

Source spec: `plans/tran.md`

## Context
The spec asks for a customer GSTIN to be captured, edited, and validated at job
**creation**, **finalize**, and **delivery**, and used when the job invoice is posted to
Trace Plus (`ExtGstTranD.gstin`).

The spec originally proposed storing GSTIN in **both** the `job` table and the
`customer_contact` table. On review, that duplication isn't justified for this app — the
only thing a `job.gstin` column buys is a per-job snapshot/override, and GSTIN belongs to
the customer. **Decision: store GSTIN solely on `customer_contact.gstin`.** Every stage
reads/writes that one column; posting reads it live (the server already does). This
intentionally overrides the "save at both" wording in `tran.md` bullets 3/6.

Net effect: a single source of truth, no snapshot, last-write-wins. The work is mostly
**client-side UI + validation + a customer-update call**; the server posting path is
already correct.

## Key findings (verified)
- Posting query `GET_UNPOSTED_JOB_INVOICES` already selects `cc.gstin AS customer_gstin`
  and `mutation_helper.py:2209-2210` copies it into `ExtGstTranD.gstin`. **No server
  posting change required.**
- The deliverable-jobs query already returns `cc.gstin AS customer_gstin`
  (`sql_store.py:4969`); `deliver-job-schema.ts:133` already has `customer_gstin`.
- `GET_JOB_DETAIL` (`sql_store.py:3657`) returns `j.*` + customer fields but does **not**
  alias `cc.gstin`; finalize/edit prefill needs `cc.gstin AS customer_gstin` added.
- Customer picker rows (`CustomerSearchRow`) already carry `gstin`
  (`customer-select.tsx`, `customer-search-modal.tsx`).
- GSTIN regex is duplicated inline in `add-customer-dialog.tsx:49`.
- `job.gstin` has **already been removed** from the client types
  (`db-schema-service.ts`) and server DDL (`service_plus_service.sql`). Only verify the
  seed `db/service_plus_demo.sql` no longer adds it.

---

## Step 0 — Shared GSTIN validator (reuse, remove duplication)
New `src/lib/gstin.ts`:
- `GSTIN_REGEX` = `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/`
- `isValidGstin(v)` — empty/null ⇒ valid (optional); else must match.
- `normalizeGstin(v)` — `trim().toUpperCase()`.
Refactor `add-customer-dialog.tsx` (and any other inline copy) to import from here.

## Step 1 — `job.gstin` removal (already done)
The `job.gstin` column has already been removed from the client types
(`src/types/db-schema-service.ts`) and the server DDL
(`app/db/service_plus_service.sql`). Remaining check: ensure the seed
`db/service_plus_demo.sql` no longer adds `job.gstin`, and grep for any stray `job`
`gstin` reads/writes in client/server code.

## Step 2 — Shared "save GSTIN to customer" helper
A small client helper reused by Steps 3–5 — `saveCustomerGstin(customerId, raw)`:
- normalize; if empty or unchanged vs current ⇒ no-op (never overwrite with blank);
- `genericUpdate` on `customer_contact` (`xData: { id, gstin }`) via `GRAPHQL_MAP.genericUpdate`;
- surface failures via toast without aborting the primary job action.
Hard-block validation is done by the caller before invoking; the helper assumes a valid
value.

## Step 3 — Job creation: GSTIN field bound to the customer
Files: `jobs/single-job/new-single-job-form.tsx` + `single-job-schema.ts` +
`single-job-section.tsx`; mirror in `jobs/batch-job/*` (confirm how batch associates
customers — single vs per-row — and apply per customer).
- Add `gstin` to the form schema (optional, `isValidGstin`-validated), uppercase-normalized.
- Prefill from the selected customer's `gstin` on `onSelect` (`new-single-job-form.tsx:245`);
  blank on clear. New customers use the existing add-customer dialog (already has GSTIN).
- Edit-mode prefill via `GET_JOB_DETAIL` — add `cc.gstin AS customer_gstin` to the SQL and
  read it in the edit-load `form.reset` (`new-single-job-form.tsx:106`).
- Inline error on malformed; reject save when non-empty & invalid.
- On submit (`single-job-section.tsx onSubmit`, create ~line 195 and edit ~line 166):
  **no `job` xData change**; call `saveCustomerGstin(values.customer_id, values.gstin)`.

## Step 4 — Finalize: validated GSTIN field
Files: `jobs/final-a-job/final-job-form.tsx`, `final-a-job-schema.ts`,
`final-a-job-section.tsx`.
- Prefill from the customer's GSTIN (via the `GET_JOB_DETAIL` `customer_gstin` alias from
  Step 3); falls back to empty.
- Add a validated, uppercase-normalized GSTIN input to the finalize header/summary.
- Hard block: if non-empty & `!isValidGstin`, `toast.error` and abort finalize.
- On successful finalize, call `saveCustomerGstin(...)`. No `job`/`job_invoice` gstin write.

## Step 5 — Delivery: validated GSTIN field
Files: `jobs/deliver-job/delivery-modal.tsx`, `deliver-job-helpers.ts`.
- `customer_gstin` is already loaded (`cc.gstin`). Render an editable, validated,
  uppercase-normalized field prefilled from it.
- Hard block on malformed non-empty GSTIN.
- On successful delivery, call `saveCustomerGstin(...)`.

## Step 6 — Posting to Trace Plus
No change. `GET_UNPOSTED_JOB_INVOICES` already reads `cc.gstin` live and
`mutation_helper.py` already writes it to `ExtGstTranD.gstin`. Whatever was last saved to
the customer at creation/finalize/delivery flows through automatically. Verify only.

---

## Verification
1. **Creation** — existing customer with GSTIN ⇒ field prefills; editing it updates
   `customer_contact.gstin`. Malformed ⇒ inline error, save blocked. New customer via add
   dialog ⇒ GSTIN saved.
2. **Finalize** — field prefills from customer GSTIN; invalid blocks finalize; valid
   updates the customer.
3. **Delivery** — field prefills; invalid blocks delivery; valid updates the customer.
4. **Posting** — post a finalized job invoice ⇒ Trace Plus `ExtGstTranD.gstin` equals the
   customer's current GSTIN.
5. `npm run lint` + `tsc` clean (client); server unchanged functionally. No inline GSTIN
   regex copies remain (all import `src/lib/gstin.ts`). `job.gstin` absent from
   types/DDL/seed (already removed; just confirm the seed).

## File touch list
Client: `src/lib/gstin.ts` (new);
`jobs/single-job/{new-single-job-form,single-job-schema,single-job-section}.tsx`;
`jobs/batch-job/*` (mirror);
`jobs/final-a-job/{final-job-form,final-a-job-schema,final-a-job-section}.tsx`;
`jobs/deliver-job/{delivery-modal,deliver-job-helpers}.tsx`;
`masters/customer/add-customer-dialog.tsx`.
Server: `app/db/sql_store.py` (add `cc.gstin AS customer_gstin` to `GET_JOB_DETAIL`).
(`job.gstin` already removed from types/DDL; just confirm `db/service_plus_demo.sql`.)
