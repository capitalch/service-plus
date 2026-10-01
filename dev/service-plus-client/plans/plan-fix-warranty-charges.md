# Plan — Warranty jobs can carry real charges, consistently, everywhere

## Goal

A warranty job (job type `UNDER_WARRANTY`) is free by default, but staff sometimes take a real
charge on one — a visit fee, a part the warranty does not cover. Today the app treats warranty
as "always ₹0" in most screens but not all, and never invoices a warranty job. So when a real
charge does get saved, its cost reaches the profit reports but its revenue does not, and the
report shows a loss on a job that made money.

Outcomes:
- Every part or charge line on a warranty job starts at ₹0 selling price.
- Staff can change that to a real amount on any screen, and it is saved as entered.
- A line with a real price follows normal GST rules (HSN and GST rate in a GST division).
  A line left at ₹0 needs neither, as today.
- Every screen that shows a warranty job's prices shows the real figures.
- A warranty job can take money receipts like any other job.
- At delivery, a warranty job gets an invoice exactly when its amount is above ₹0.
- Warranty jobs already delivered with a real amount but no invoice get one through a one-time
  maintenance screen. These invoices carry the job's delivery date and a separate number
  series, so the running invoice numbers are not disturbed.

Decisions already made:
- Backfill invoices are dated with the job's delivery date.
- Backfill invoices use their own number series: the division's normal prefix and separator,
  then the letter `W`, then a running number (e.g. `SI/W00001`).
- The backfill is a one-time maintenance screen, removed after use.
- Warranty jobs follow the normal receipt rules; the warranty block is removed.

## Present context and current design

### Screens that edit a warranty job's prices

- **Final a Job** (`final-a-job-section.tsx`, form `final-job-form.tsx`, save
  `finalize-job-save.ts`): fully locked. Save forces selling price, GST rate and HSN to 0/empty
  and the job amount to ₹0. The form hides the Sale, Sale+GST, Lock, HSN and GST% columns,
  shows cost in place of amount, shows a fixed "Final Amount ₹0.00" panel and a banner saying
  selling prices and final amount are ₹0. The HSN/GST-required check and the
  target-must-match-lines check are skipped.
- **Job Control → Final** (`final-job-dialog.tsx`, same form and save): the dialog builds its
  row with an empty job type code, so the lock never engages here. Real amounts have reached
  the database through this path.
- **Job Pipeline → Job Charges** (`job-charges-modal.tsx`): selling price inputs disabled and
  forced to ₹0 at save. Changing cost resets the selling price to ₹0. Header badge says
  "Warranty — cost only, selling ₹0". GST and HSN are not touched. A named charge at ₹0 is
  allowed for warranty (blocked for other job types).
- **Part Used** (`part-used-section.tsx`, `new-part-used-form.tsx`): input disabled; save
  forces ₹0; changing cost resets selling price to ₹0.
- **Opening Job** (`opening-job-form.tsx`): a free Amount field, no lock, and no part or
  charge lines.
- **Batch Warranty Transactions** (`batch-warranty-transactions/batch-execute.ts`): finalizes
  and delivers several warranty jobs at once with the amount hard-set to ₹0. It only lists
  warranty jobs with no parts used, but does not look at charges.

### Price defaulting

The ₹0 starting price already exists where a part is picked in Job Charges and Part Used, and
where cost is edited in Final a Job / Job Control. It is missing in
`computePartPricesOnSelect()`, which exists as two identical copies (in
`final-a-job-section.tsx` and `final-job-dialog.tsx`) and is called from three places in each:
part select, division change and Reset Prices. Without a warranty check it falls back to the
markup price.

### Screens that only display a warranty job's prices

`job-charges-readonly-modal.tsx`, opened from Final a Job, Job Control and the Job Pipeline
drilldown, hides the Sale and GST columns for warranty, shows cost as the amount and always
shows "Final Amount ₹0.00".

### Receipts

`receiptJobRestrictionReason()` in `receipts/job-lookup-combobox.tsx` refuses every warranty
job ("Under warranty — no payment required").

### Delivery and invoicing

- `isJobInvoiceable()` in `deliver-job/deliver-job-helpers.ts` refuses every warranty job,
  whatever its amount. It is called from `delivery-modal.tsx` and
  `delivery-modal-invoices-section.tsx`.
- `delivery-modal.tsx` builds the invoice inline: `buildInvoiceLines()` turns parts and
  charges into lines with GST, `reconcileLineAmounts()` moves any rounding difference into the
  last line so the lines add up to the job amount, and `doCreateInvoices()` sends
  `createJobInvoice` dated today with the branch from the screen.
- If the job amount is above ₹0 but every line is priced ₹0, reconciliation moves the whole
  amount into the last line as taxable value with zero GST — a wrong invoice.
- A job with no lines is skipped with a warning; the server also refuses an invoice without
  lines.
- On the server, `createJobInvoice` (gated by `JOBS_DELIVER_JOB`) checks the job is delivered,
  returns the existing invoice if there is one, and takes the next number from the branch +
  division `SERVICE_INVOICE` sequence. `job_invoice.invoice_no` and `job_invoice.job_id` are
  both unique.
- New invoices start unposted and are posted to accounts later through Accounts Posting.

### Reports

Profit reports (`GET_PROFIT_RANGE` and those built the same way) take revenue from
`job_invoice.aggregate`, filtered by `invoice_date`, and cost from the parts and charges. No
invoice means zero revenue against real cost. These queries are correct once the invoice
exists, and need no change.

### Affected data (read-only check, 1 Oct 2026)

Delivered warranty jobs with amount above ₹0 and no invoice:
- navtechnology: 6 jobs — N/00086, N/00154, N/00155, N/00161, N/00162, N/00173 — delivered
  15–30 Sep 2026, ₹12,450 in total. All have priced lines, none is an Opening Job, all are
  fully paid.
- capitalelectronics: none.
- demo1: 2 demo jobs.

October invoices already exist (`SI/00128`, `SI/00129` dated 1 Oct). Numbering September
invoices from the normal sequence would put them after October ones.

## Key constraints

1. **The ₹0 default must survive removing the locks.** Resolution: `computePartPricesOnSelect()`
   gets a warranty flag, and all three callers pass it in both files (Step 2).
2. **The HSN/GST check would block free warranty jobs.** It checks every line, so removing the
   warranty skip would demand HSN and GST rate on ₹0 lines. Resolution: on a warranty job the
   check covers only lines priced above ₹0; other job types are unchanged (Step 1).
3. **Hidden HSN/GST columns would make that check impossible to satisfy.** Resolution: the form
   shows every column for warranty jobs, including HSN and GST% (Step 3).
4. **Job Control does not know the job type.** Resolution: fill the job type code and name from
   the job it already loads, defaulting to an empty string when missing (Step 2).
5. **Cost edits must not overwrite a typed warranty price.** Resolution: in Part Used and Job
   Charges, editing cost on a warranty line leaves the selling price alone (Step 5).
6. **A named warranty charge may stay at ₹0.** Resolution: keep the existing Job Charges
   exemption (Step 5).
7. **Read-only views must show real prices.** Resolution: the read-only charges view stops
   treating warranty specially (Step 4).
8. **A warranty job with a real amount must be able to take a receipt.** Resolution: remove the
   warranty block; the other receipt rules stay (Step 6).
9. **Batch Warranty would wipe a real charge.** Resolution: Batch Warranty lists only jobs with
   no parts and no charge priced above ₹0 (Step 7).
10. **A ₹0 warranty job must still get no invoice.** Resolution: the warranty refusal stays, but
    only when the amount is ₹0 (Step 8).
11. **Amount above ₹0 with all lines at ₹0 gives a wrong invoice.** Resolution: delivery and
    backfill skip such a job with a clear message. Final a Job already prevents it, because the
    target-must-match-lines check now applies to warranty too (Steps 1, 8).
12. **Backfill invoices must land in the right period.** Resolution: the server sets the invoice
    date to the job's delivery date itself; the screen cannot choose it (Step 9).
13. **Backfill invoices must not disturb the running numbers.** Resolution: a separate `W`
    series per branch + division, worked out by the server; the normal sequence counter is never
    touched. Normal numbers never contain `W` after the separator, so the two cannot collide
    (Step 9).
14. **The branch must be the job's own.** Resolution: the server takes the branch from the job,
    not from the screen (Step 9).
15. **Jobs without lines cannot be invoiced.** Resolution: the backfill list shows them with the
    reason and no button. None exist today (Step 10).
16. **Creating backdated invoices is a sensitive action.** Resolution: the backfill mutation and
    screen are for admin users only, checked on the server (Steps 9, 10).
17. **September's GST return and accounts.** Resolution: run the backfill before September's
    GSTR-1 is filed (due 11 Oct 2026), then post the invoices through Accounts Posting
    (Step 12).

## New design brief

- Warranty is no longer a lock on the save path; it only sets the ₹0 starting price → Steps 1, 2.
- Final a Job and Job Control show and save the same full pricing grid for every job type → Steps 2, 3.
- Read-only charge views show real figures → Step 4.
- Job Charges and Part Used become editable for warranty, keeping the ₹0 start → Step 5.
- Warranty jobs take receipts normally → Step 6.
- Batch Warranty only handles truly free jobs → Step 7.
- Delivery invoices a warranty job with a real amount, through one shared invoice builder → Step 8.
- Server: list affected jobs and create backfill invoices dated by delivery, `W`-numbered,
  admin-only → Step 9.
- One-time admin screen to review and create the backfill invoices → Step 10.
- Both help files updated → Step 11.
- Run the backfill and check reports → Step 12.

## Steps

### Step 1 — Save path: remove the warranty lock
Needs: none.
- File: `src/features/client/components/jobs/final-a-job/finalize-job-save.ts`.
- Selling price, GST rate, HSN and the job amount are saved the same way for every job type.
  Remove every warranty condition on them.
- HSN/GST-required check: runs for warranty jobs too, but on a warranty job only for lines whose
  selling price is above ₹0. Other job types unchanged.
- Target-must-match-lines check: applies to warranty jobs too.
- Done when: `pnpm exec tsc -b --noEmit` passes, and a warranty job in a GST division with all
  lines at ₹0 saves without asking for HSN or GST rate.

### Step 2 — ₹0 default in price calculation, and Job Control job type
Needs: Step 1.
- `computePartPricesOnSelect()` in `final-a-job-section.tsx` and `final-job-dialog.tsx` gets a
  warranty flag. When the line has no price yet: ₹0 for warranty, markup price otherwise. A
  price already on the line is kept, as today.
- Pass the flag from all three callers in each file: part select, division change, Reset Prices.
- `final-job-dialog.tsx` `loadJobData()`: fill `job_type_code` and `job_type_name` from the
  loaded job (empty string if missing) instead of hard-coded empty strings.
- Done when: type check passes; picking a part, changing division, or Reset Prices on a warranty
  job gives ₹0 in both Final a Job and Job Control.

### Step 3 — Final job form: same grid for every job type
Needs: Steps 1, 2.
- File: `src/features/client/components/jobs/final-a-job/final-job-form.tsx`.
- Show Sale, Sale+GST, Lock, HSN and GST% columns and cells for warranty jobs (remove every
  warranty condition, including those combined with the GST check).
- Line amounts and part/charge totals use selling figures, not cost.
- Final amount is worked out the same way as for other jobs; always show the
  Tallied / Calculated / Diff / Total panel, and remove the fixed "₹0.00" panel.
- Banner text becomes: warranty job — prices start at ₹0; enter an amount only if the customer
  is being charged. Text goes in `constants/messages.ts`.
- Warranty Card No and other non-pricing warranty logic stay.
- Done when: a warranty job shows the full grid and its total matches what Step 1 saves.

### Step 4 — Read-only charges view
Needs: Step 3.
- File: `src/features/client/components/jobs/final-a-job/job-charges-readonly-modal.tsx`.
- Remove the warranty special cases on columns, amounts, totals and the "Final Amount ₹0.00"
  display. The view renders the same for every job type. Callers may keep passing the warranty
  flag only if it is still used for a badge; otherwise drop the prop and update the three callers
  (`final-a-job-section.tsx`, `job-control-section.tsx`, `job-pipeline-status-drilldown.tsx`).
- Done when: a warranty job with a priced line shows that price and the job amount in all three
  places.

### Step 5 — Job Charges modal and Part Used
Needs: Step 1.
- `job-pipeline/job-charges-modal.tsx`:
  - Save the entered selling price for parts and charges (remove the four forced ₹0s).
  - Inputs enabled; no forced ₹0 display.
  - Keep the ₹0 start when a part is picked.
  - Cost change: on a warranty line, leave the selling price alone; other job types unchanged.
  - Keep the "named charge may stay at ₹0" exemption for warranty.
  - Header badge text becomes "Warranty — prices start at ₹0".
- `part-used/part-used-section.tsx`: save the entered selling price.
- `part-used/new-part-used-form.tsx`: input enabled, no forced ₹0 display; keep the ₹0 start
  when a part is picked; cost change on a warranty line leaves the selling price alone.
- Done when: in both screens a typed warranty price survives a cost edit and is saved.

### Step 6 — Receipts
Needs: none.
- File: `src/features/client/components/jobs/receipts/job-lookup-combobox.tsx`.
- Remove the warranty line from `receiptJobRestrictionReason()`. Closed, fully-paid final,
  On Hold and Estimate Rejected rules stay.
- Done when: a warranty job can be picked for a new receipt; a closed one still cannot.

### Step 7 — Batch Warranty eligibility (server)
Needs: none.
- `service-plus-server/app/db/sql/sql_jobs.py`: in the Batch Warranty queries that list
  warranty jobs with no parts used, also require no additional charge with a selling price
  above ₹0.
- Done when: a warranty job with a priced charge no longer appears in Batch Warranty; jobs with
  only ₹0 charges still do.

### Step 8 — Delivery: invoice warranty jobs with a real amount
Needs: Steps 1–5.
- New file `src/features/client/components/jobs/deliver-job/job-invoice-builder.ts`: move
  `buildInvoiceLines()` and `reconcileLineAmounts()` out of `delivery-modal.tsx`, and add one
  function that builds the full invoice payload (lines, GST totals, header amount) for a job.
  Delivery and the backfill screen both use it.
- `isJobInvoiceable()` takes the job amount; it refuses a warranty job only when the amount is
  ₹0. Update both callers to pass `job.amount`.
- Before sending an invoice, skip a job whose amount is above ₹0 but whose lines total ₹0, with
  a warning message in `constants/messages.ts`.
- Normal delivery still dates the invoice today and uses the normal number sequence.
- Done when: delivering a priced warranty job creates a correct invoice; a ₹0 warranty job gets
  none; ordinary jobs invoice exactly as before.

### Step 9 — Server: affected-job query and backfill invoice mutation
Needs: Step 8.
- Read query `GET_WARRANTY_JOBS_MISSING_INVOICE` (server SQL store and `src/constants/sql-map.ts`):
  warranty jobs with status Delivered OK or Delivered Not OK, amount above ₹0 and no invoice.
  Returns job id, job no, customer name, delivery date, amount, branch, division, number of
  lines and the lines' selling total. Ordered by delivery date.
- New mutation `createBackfillJobInvoice` (GraphQL schema, resolver, `src/constants/graphql-map.ts`),
  reusing the existing job-invoice creation code with these differences:
  - Admin users only, enforced on the server.
  - Refuses unless the job is warranty, delivered, amount above ₹0 and has no invoice
    (existing lock-and-return-existing check stays, so a repeat is harmless).
  - Invoice date = job's delivery date, and branch = job's branch, both read from the job on
    the server.
  - Invoice number = division's `SERVICE_INVOICE` prefix + separator + `W` + next number in the
    W series for that branch and division, padded like the normal series. The next number is
    found from existing W-series invoices while holding a lock on that sequence row, so two
    requests cannot get the same number. The sequence's own counter is not changed.
- Done when: the query returns the 6 navtechnology jobs; a test call on a demo1 job creates
  `<prefix>/W00001` dated with its delivery date, and a second call returns the same invoice.

### Step 10 — One-time backfill screen
Needs: Step 9.
- New folder `src/features/client/components/jobs/warranty-invoice-backfill/`, with a Jobs
  sidebar item shown only to admin users.
- Loads `GET_WARRANTY_JOBS_MISSING_INVOICE` and shows: job no, customer, delivery date, amount,
  lines total, and a status — Ready, "No lines — cannot invoice" or "Lines total ₹0 — fix the
  job first".
- Ready rows have a Create Invoice button with a confirm dialog; a Create All button handles all
  Ready rows one by one. Each builds the payload with the Step 8 builder (loading the job's
  lines the same way the Deliver Job screen does) and calls `createBackfillJobInvoice`.
- After each invoice the list reloads; created jobs drop out.
- Texts longer than two words go in `constants/messages.ts`. Responsive layout.
- Done when: on demo1 both demo jobs can be invoiced from the screen and the list ends empty.

### Step 11 — Help content
Needs: Steps 1–10.
- `features/client/components/help/help-content.ts`: rewrite every statement that warranty
  prices are fixed, hidden or ₹0, or that warranty jobs are never invoiced or cannot take
  receipts (job type description, Lock column note, Final a Job, Final job FAQ, column notes,
  Part Used, invoice eligibility, receipts, and the FAQ saying warranty invoices carry ₹0).
  New wording: warranty jobs start at ₹0; enter a real amount if the customer is charged; GST
  applies normally to priced lines; a priced warranty job is invoiced at delivery and can take
  receipts. Add a short article on the backfill screen.
- `features/super-admin/components/help/dev-help-content.ts`: one new article covering the
  warranty pricing rule, the HSN/GST check for ₹0 warranty lines, `isJobInvoiceable`'s amount
  rule, the shared invoice builder, `GET_WARRANTY_JOBS_MISSING_INVOICE`,
  `createBackfillJobInvoice` and the W number series, the Batch Warranty eligibility change and
  the Job Control job-type fix. Re-check sibling articles that describe these for stale wording.
- Done when: a search of both files finds no remaining "always ₹0" style claims about warranty.

### Step 12 — Your Part
Needs: Steps 1–11 deployed.
- Ask the accountant to confirm that a separate `W` invoice series is acceptable for the GST
  return (it is reported as its own series in the document summary).
- Before 11 Oct 2026, open the backfill screen for navtechnology, review the 6 jobs, and create
  their invoices.
- Post the new invoices through Accounts Posting; confirm September is still open in the books.
- Check September's Profit Summary for navtechnology now shows warranty revenue for these jobs.
- Once every tenant is done, remove the backfill screen and its sidebar item (the server
  mutation can stay or be removed in the same change).

## Files touched

Client — modified
- `src/features/client/components/jobs/final-a-job/finalize-job-save.ts`
- `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx`
- `src/features/client/components/jobs/final-a-job/final-job-form.tsx`
- `src/features/client/components/jobs/final-a-job/job-charges-readonly-modal.tsx`
- `src/features/client/components/jobs/job-control/final-job-dialog.tsx`
- `src/features/client/components/jobs/job-control/job-control-section.tsx` (only if the read-only prop changes)
- `src/features/client/components/jobs/job-pipeline/job-pipeline-status-drilldown.tsx` (same)
- `src/features/client/components/jobs/job-pipeline/job-charges-modal.tsx`
- `src/features/client/components/jobs/part-used/part-used-section.tsx`
- `src/features/client/components/jobs/part-used/new-part-used-form.tsx`
- `src/features/client/components/jobs/receipts/job-lookup-combobox.tsx`
- `src/features/client/components/jobs/deliver-job/deliver-job-helpers.ts`
- `src/features/client/components/jobs/deliver-job/delivery-modal.tsx`
- `src/features/client/components/jobs/deliver-job/delivery-modal-invoices-section.tsx`
- `src/constants/sql-map.ts`, `src/constants/graphql-map.ts`, `src/constants/messages.ts`
- Jobs sidebar/menu file and page (for the backfill item)
- `src/features/client/components/help/help-content.ts`
- `src/features/super-admin/components/help/dev-help-content.ts`

Client — new
- `src/features/client/components/jobs/deliver-job/job-invoice-builder.ts`
- `src/features/client/components/jobs/warranty-invoice-backfill/` (screen)

Server
- `app/db/sql/sql_jobs.py` — Batch Warranty eligibility.
- SQL store — `GET_WARRANTY_JOBS_MISSING_INVOICE` and the W-series number query.
- GraphQL schema, `app/graphql/resolvers/mutation.py`, `app/graphql/resolvers/jobs/invoicing.py`
  — `createBackfillJobInvoice`.
- Unchanged: profit and report queries.

## Testing

End-to-end, on demo1:
1. New warranty job: add parts and charges in Job Charges, Part Used, Final a Job and Job Control
   — each starts at ₹0; Reset Prices and division change keep ₹0.
2. Enter real prices in each screen and save — values persist; editing cost does not wipe them.
3. GST division: a priced warranty line needs HSN and GST rate; a ₹0 warranty line does not.
4. Read-only charges view in Final a Job, Job Control and Pipeline shows the real figures.
5. Take a receipt on the priced warranty job.
6. Deliver it — invoice created with correct lines, GST and amount, normal number, today's date.
   Deliver a ₹0 warranty job — no invoice.
7. Batch Warranty: the priced job is not listed; a free one is, and processes as before.
8. Backfill screen: lists remaining affected jobs; create one, then all; numbers are W-series,
   dated by delivery date, branch matches the job; running it again creates nothing.
9. Profit Summary for the delivery dates shows the revenue.
10. Ordinary (non-warranty) job: pricing, checks, delivery invoicing and numbering unchanged.
11. `pnpm exec tsc -b --noEmit` and `pnpm build` pass; `pnpm format` on touched files.

## Flags

Decided
- Backfill dated by delivery date; separate `W` number series; one-time admin screen; warranty
  jobs follow normal receipt rules.
- The HSN/GST check skips ₹0 lines only on warranty jobs.
- Profit and report SQL need no change.

Open
- Accountant to confirm the separate `W` series for GST reporting (Step 12).
- Whether the server backfill mutation is removed along with the screen.
- The September GSTR-1 deadline (11 Oct 2026) sets the latest sensible date to run the backfill.
