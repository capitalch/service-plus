# Fix: "date too large (after year 10K)" crash on job reads

## Goal
- Stop a single bad date in the database from breaking every screen that reads it.
- Stop job forms from accepting impossible years (5-digit years, years like 0006).
- Correct the bad rows already saved.

## Context — what happened (verified against the live DB, read-only)
- psycopg cannot turn a Postgres date with a year above 9999 into a Python `date`. Our `_IsoDateLoader` (`service-plus-server/app/db/connection/psycopg_driver.py:23`) calls `super().load(data)`, which raises `DataError`. Because this happens in `fetchall()`, the **whole query** fails, not just one row. Any job list that includes the row errors out.
- A scan of every date/timestamp column in `service_plus_capitalgroup` found three bad values, all in `job.purchase_date`:
  - `navtechnology.job` id 220 (`N/00219`, created today) → `12024-01-10` ← **this is the crash**
  - `navtechnology.job` id 168 (`N/00167`) → `0006-04-24` (loads fine, but the year is wrong)
  - `capitalelectronics.job` id 145 (`J/00145`) → `0025-02-26` (loads fine, but the year is wrong)
- How it got in: the purchase date on the job forms is a plain `<input type="date">` with no `min`/`max`. Chrome lets you type up to 6 digits in the year, so typing `1` + `2024` gives `12024`; typing just `6` or `25` gives `0006` / `0025`. The zod schemas only check `z.string()` (`single-job-schema.ts:23`, `opening-job-schema.ts:13`, `batch-job-schema.ts:13`), and the DB has no CHECK constraint, so nothing stops it.
- `components/ui/locale-date-input.tsx` is already safe (4-digit year, ≥ 1900). Only the raw `type="date"` inputs are affected.

## New design brief
- Server returns the raw text for out-of-range dates instead of failing the query → Step 1
- One shared zod rule for "real date" and a shared max for date inputs → Step 2
- Job purchase-date fields use the rule and the min/max → Step 3
- Other write forms with raw date inputs get the min/max → Step 4
- Bad rows corrected → Step 5
- Help articles updated → Step 6

## Key constraints
1. The loader fix must not change the output of valid dates. Resolution: only catch `DataError`; otherwise behaviour is identical.
2. Purchase date is optional. Resolution: the rule passes an empty string; it only checks when a value is present.
3. Data correction needs the real dates, which only the user knows. Resolution: Your Part A.

## Steps

### Step 0 — Your Part
- **A** (before Step 5): tell me the correct purchase dates for `N/00219` (probably `2024-01-10`), `N/00167` and `J/00145` — or say "set them empty". ✅ (done by user)

### Step 1 — Server: don't let one bad date fail the query ✅
- Needs: nothing.
- Path: `dev/service-plus-server/app/db/connection/psycopg_driver.py`
- In `_IsoDateLoader`, `_IsoTimestampLoader`, `_IsoTimestamptzLoader`: wrap `super().load(data)` in `try/except psycopg.DataError` and return `bytes(data).decode()` (the raw Postgres text, e.g. `"12024-01-10"`). Log a warning once with the value.
  ```python
  def load(self, data: bytes) -> str:
      try:
          return super().load(data).isoformat()
      except psycopg.DataError:
          return bytes(data).decode()
  ```
- Effect: the job list loads again; the bad row shows its odd date so staff can see and fix it. (Only applies to `text_dates=True` reads, which is what `genericQuery` uses.)

### Step 2 — Client: shared date rule and limits ✅
- Needs: nothing.
- Path: new `src/lib/date-utils.ts` with
  - `DATE_INPUT_MAX = "9999-12-31"`, `DATE_INPUT_MIN = "1900-01-01"`
  - `function isValidIsoDate(value: string): boolean` — empty → true; otherwise matches `^\d{4}-\d{2}-\d{2}$`, year 1900–9999, real calendar date.
  - `function todayIso(): string` (local date) for purchase-date `max`.
- Path: `src/constants/messages.ts` — add `ERROR_INVALID_DATE: "Enter a valid date (year 1900 or later)"` and `ERROR_PURCHASE_DATE_FUTURE: "Purchase date cannot be in the future"`.

### Step 3 — Job forms: validate purchase date ✅
- Needs: Step 2.
- Schemas: `single-job-schema.ts`, `opening-job-schema.ts`, `batch-job-schema.ts` — `purchase_date` gets `.refine(isValidIsoDate, MESSAGES.ERROR_INVALID_DATE).refine(v => !v || v <= todayIso(), MESSAGES.ERROR_PURCHASE_DATE_FUTURE)`. Validation already shows immediately and disables submit via the existing form wiring.
- Inputs: add `min={DATE_INPUT_MIN} max={todayIso()}` to the purchase-date inputs in `new-single-job-form.tsx:260`, `opening-job-form.tsx:467`, `new-batch-job-form.tsx:380` and `:513`. With a 4-digit `max`, Chrome also limits the year box to 4 digits, which blocks the `12024` typo at the keyboard.
- Also check the extended-warranty purchase date (`extended-warranty-schema.ts:57`) and add the same rule.

### Step 4 — Other write forms: cap the year ✅
- Needs: Step 2.
- Pattern: every raw `<Input type="date">` in a form that saves data gets `max={DATE_INPUT_MAX}` (and `min={DATE_INPUT_MIN}`). Representative paths: `jobs/receipts/new-receipt-form.tsx`, `jobs/deliver-job/delivery-modal.tsx`, `jobs/job-pipeline/status-transition-modal.tsx`, `inventory/purchase-entry/new-purchase-invoice.tsx`, `inventory/sales-entry/new-sales-invoice.tsx`, `masters/financial-year/*-dialog.tsx`. Report range pickers/audit-log filters only query, so they are left alone.

### Step 5 — Correct the bad rows ✅
- Needs: Your Part A, Step 1.
- One-off `UPDATE ... SET purchase_date = ... WHERE id = ...` on `navtechnology.job` (220, 168) and `capitalelectronics.job` (145) in `service_plus_capitalgroup`, run via the server venv. Re-run the scan to confirm zero rows with year < 1900 or > 9999 (also scan `service_plus_demo`, which the first scan did not finish).

### Step 6 — Help content ✅
- Needs: Steps 1–4.
- `help-content.ts`: in the job-entry article, note that purchase date must be a real date, not in the future.
- `dev-help-content.ts`: new article "Date input limits" — `lib/date-utils.ts`, the 4-digit-year reason (psycopg cannot load years > 9999), the loader fallback in `psycopg_driver.py`, and the rule that new raw date inputs must carry `min`/`max`.

## Verification
- Before Step 5: open the jobs screen for navtechnology — after Step 1 it loads instead of erroring; the row shows `12024-01-10`.
- In a job form, try typing a 5-digit year and a year like `25` → inline error, submit disabled.
- `pnpm exec tsc -b --noEmit` and `pnpm format` on touched files (eslint is broken repo-wide).
- After Step 5: rerun the read-only scan → no rows.
- `graphify update .` after code changes.
- On approval, also save this plan to `plans/plan.md` per the project planning protocol.
