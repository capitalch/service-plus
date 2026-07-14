# Manual Testing Plan — Jobs Menu (Service+ Client)

Concise, step-by-step manual test steps for **every item** in the Jobs menu. Execute
top-to-bottom. Each item lists its core happy path plus the key validations, gates, and
edge cases to confirm.

## Jobs menu items (explorer order)
1. New Job → **Single Job**
2. New Job → **Batch Jobs**
3. **Job Control**
4. **Job Pipeline**
5. **Final a Job**
6. **Deliver Job** *(role-gated: `JOBS_DELIVER_JOB`)*
7. **Accounts Posting** *(visible only when "post data to accounts" is ON; role-gated: `JOBS_ACCOUNTS_POSTING`)*
8. **Opening Jobs** *(role-gated: `JOBS_OPENING_JOBS`)*
9. **Receipts** *(role-gated: `JOBS_RECEIPTS`)*
10. **Part Used (Job)**

---

## 0. Preconditions (do once)
1. Log in as a client user with Jobs access; the left **Jobs** explorer renders.
2. A **Branch** is selected in the global header; note its code.
3. At least one **Division** exists; if multiple, note which are **GST** vs **Non-GST**.
4. Master data exists: Customers, Technicians, Brands, Products, Models, Additional
   Charges, and Parts with stock.
5. **Document Sequence** for `JOB_SHEET` is configured with a non-empty prefix (job
   creation is blocked without it).
6. Note the current **Financial Year** range (default filter in several grids).
7. Note whether "post data to accounts" is **ON** (Accounts Posting item appears) or OFF.

### Global checks — repeat on every section
- Correct header icon + title; count `(N)` matches the grid footer total.
- **No branch selected** → forms show empty/prompt state; actions disable, no crash.
- Success and failure both raise a **toast**.
- Search inputs are **debounced (~1.6s)**; the **✕** clears query and returns to page 1.
- **Refresh** reloads current page/filters; disabled while loading and when no branch.
- Loading shows skeleton rows; empty shows the "No … found" message.
- **Role gating**: for each gated item, confirm a role lacking the access right sees the
  item **disabled** with the "does not have access" tooltip.

---

## 1. Single Job (New Job → Single Job)

   ### New mode
               1. Opens in **New** mode (title "— New"); **Job No** shows `AUTO` (read-only); Quick Info
                  Card renders at top.
               2. **Division** selector appears only when >1 division exists; required (red until chosen).
               3. Required markers (*) on: Customer, Receive Manner, Job Type, Product/Model, Qty.
               4. **Save Job** is disabled on an empty form.
               5. Pick a Customer via combobox → name, mobile, address, GSTIN auto-populate; clear button
                  resets them and re-disables Save.
               6. Invalid **GSTIN** → inline error; valid 15-char clears it (auto-uppercase, capped at 15).
               7. **Job Type = Under Warranty** → Warranty Card No enables; other types disable/clear it.
               8. **Qty** 0 or negative → error (min 1).
               9. Product/Model combobox filters and selects; green **+** opens Add Model dialog → on
                  success the list refreshes and the new model is selectable.
               10. Fill all required fields → **Save Job** → success toast, form resets, Quick Info Card
                  refreshes; new job status = **RECEIVED**.
               11. **Reset** clears the form and drops any edit target.

   ### View mode
               12. Toggle **View**. Columns: #, Date (+division chip), Job (+CLOSED/Batch/file-count
                  chips), Customer (+GSTIN), Mobile, Device, Job Type, Status, Technician, Amount, Actions.
               13. Search by job no / customer / mobile / model / brand / serial (debounced); paginate
                  (First/Prev/Next/Last enable/disable at bounds).
               14. Batch jobs show a colored left border + "Batch #" chip.

   ### Row actions (⋯)
               15. **Edit Job** (non-final, non-batch) → edit form pre-filled, title "— Edit" (amber);
                  change a field, Save → update toast, returns to prior view.
               16. Edit a **finalized** job → Edit disabled ("edit not allowed").
               17. Edit a **batch** job → routes to Batch Jobs edit.
               18. Edit + change Division across GST↔Non-GST with an existing invoice → blocked ("void
                  the existing invoice first").
               19. **View Job** → read-only details modal.
               20. **Print PDF** → PDF preview "Job Sheet #<no>"; changing print copies regenerates;
                  download filename includes date + customer.
               21. **Attach Files** → upload → file-count chip updates on row + Quick Info Card.
               22. **Delete Job** → allowed only when `transaction_count ≤ 1`; else disabled ("has
                  activity"). Confirm → deletes (files first), row removed; Cancel → no change.

---

## 2. Batch Jobs (New Job → Batch Jobs)

   ### New mode
               1. Opens "— New"; shared header (Division, Batch Date, Customer, Receive Manner, GSTIN)
                  + rows grid.
               2. Each row: Job Type, Product/Model, Alt Job No, Serial, Receive Condition, Warranty Card
                  (warranty only), Qty, Problem, Remarks. Validate each row like Single Job.
               3. **Add/remove row** works; a batch requires **≥2 valid rows** (Save disabled otherwise).
               4. **Save Batch** → toast "Batch #N created with M jobs"; form resets; a post-save Attach
                 Files dialog lists each created job → attach per job → **Done**.

   ### View mode
               5. Toggle **View** → batches render as **grouped** blocks (header row + indented `batch.N`
                  job rows). Search by batch no / customer / mobile; paginate.

   ### Batch actions (⋯ on header)
               6. **View Batch** → modal listing all jobs (print + per-job file counts).
               7. **Print PDF** → combined batch job-sheet PDF; copy-count change regenerates.
               8. **Edit Batch** → loads into New form "— Edit #N"; modify shared fields / add / remove /
                  update jobs; Save → "Batch #N updated".
               9. **Delete Batch** → enabled only when every job has `transaction_count ≤ 1`; confirm →
                  "Batch #N deleted".

   ### Job-level actions inside a batch
               10. **Attach Files** per job updates that job's count immediately.
               11. **Delete single job** shown only when batch has **>2 jobs** and that job
                   `transaction_count ≤ 1`; dropping below 2 is blocked ("must have at least 2 jobs").
               12. From **Single Job** view, editing a batch job routes here, opens that batch in edit,
                   and returns to Single Job after saving.

---

   ## 3. Job Control
               Operational hub: status transitions, charges, finalize, deliver, undo.

   ### List & filters
               1. Opens with default filter **Open** (non-closed). Status cell shows badges: status,
                  FINAL, GST/Non-GST, Invoice Posted/Unposted.
               2. Filter tabs **Open / Delivered / All** switch the list; **Status** button opens a
                  colored status-chip filter bar (+ "All Statuses" + Back).
               3. Search job no / customer / mobile / product / brand / model / serial; paginate.
               4. Clicking a row selects (highlights) it; selection is restored after a mutation/reload.

   ### Row actions — non-delivered
               5. **View** (eye) → details modal.
               6. **Status actions** (⇄) list valid transitions for status+type → pick target → Status
                  Transition modal (division, technician, estimate amount when needed, remarks, date) →
                  Submit → "Job → <target>"; grid refreshes, row stays selected.
               7. No-action statuses (COMPLETED_OK, RETURN, DELIVERED_*) show no move list; a job with no
                  available action shows a **lock** icon.
               8. **Undo Last Transaction** (when `transaction_count ≥ 1`, not delivered) → confirm →
                  restores previous status.
               9. **Parts & Charges** (RECEIVED/ASSIGNED/ESTIMATE_APPROVED/IN_PROGRESS, non-DEMO/
                  INSPECTION) → Job Charges modal to add/edit parts & charges.
               10. **Final the Job** (COMPLETED_OK, not final) → full-screen Final flow (see §5).
               11. **Revise Final / Undo Final** (COMPLETED_OK, already final) → both **disabled when
                  `invoice_is_posted`**. Undo Final → "moved back to pending".
               12. **Deliver Job** (`is_final && !is_closed`) → Delivery modal (§6). **Proforma Invoice**
                  (final, non-closed, amount > 0) → proforma modal. **Charges (read-only)** view.

   ### Row actions — delivered (⋮)
               13. DELIVERED_* rows: View, Delivery Note, Invoice + Receipts (if invoice exists),
                  Print/Save PDF, **Undo Delivery** (disabled when `invoice_is_posted`).

   ### Top bar & lifecycle
               14. Row **file-count** chip → Attach dialog. Top-bar **Undo Final** / **Undo Delivery**
                  open Final-a-Job / Deliver-Job sub-views with a **Back** button. **Refresh** reloads.
15. **End-to-end**: take a RECEIVED job through Assigned → In Progress → Completed OK
    (adding parts/charges), then **Final**, then **Deliver**; confirm badges and available
    actions change at each step.

---

## 4. Job Pipeline

   ### Landing (bar chart)
               1. Opens to a horizontal **bar list** of statuses with counts; header "N total jobs".
               2. Order: **All** bar, actionable statuses, dashed divider, read-only statuses
                  (COMPLETED_OK, RETURN, DELIVERED_*).
               3. Count = 0 bars are dimmed and **not clickable**; non-zero bars are clickable.
               4. Bar widths scale to the max; hover tooltip "<status>: N jobs". **Refresh** spins.

   ### Drill-down
               5. Click **All** → all jobs; click a status bar → filtered to that status.
               6. Drill-down list count matches the landing bar's count; technician data loads.
               7. **Back** returns to the landing bar list.

---

   ## 5. Final a Job
               Tabs: **Final a Job** (pending = COMPLETED_OK) and **Finalized Jobs**.

   ### Pending tab
               1. Lists completed jobs pending finalization; search / paginate / Refresh.
               2. Row actions: View Job, Attach Files, **Open Final** (loads detail).

   ### Final detail form
               1. Full-screen form: job header, Division, GSTIN, parts grid, charges grid, Back-Calc
                  target, "show parts in invoice" toggle, IGST toggle.
               2. **Parts**: add via part-code lookup → cost/selling/GST/HSN auto-fill (master + markup%).
                  Editing cost cascades selling = cost×(1+markup%). Non-GST division inflates cost to
                  absorb supplier GST.
               3. **Warranty job** → selling prices and GST rate force to 0; amount = 0.
               6. **Charges**: add/edit/remove lines (name, ref no, description, qty, cost, selling, GST,
                  HSN). Removing a part/charge marks it deleted; totals resync.
               7. **Change Division** (GST↔Non-GST) → rates/HSN recompute and persist to DB immediately.
               8. **Reset prices** → recomputes all lines fresh from master.
               9. **Back Calculate / Target amount** → set target → allocation applied; target with no
                  parts/charges → blocked; target vs computed total differing **> ₹0.50** → "Amount
                  Difference Too Large" blocks save.
               10. **GST guards** (GST division, non-warranty): missing HSN or GST rate = 0 on any line →
                  blocked. Invalid non-empty GSTIN → blocked.
               11. **Save (finalize)** → "Job marked as final"; parts create stock **CONSUMPTION**
                  transactions; customer GSTIN saved; returns to list, both tabs refresh.
               12. **Back** discards without saving.

   ### Finalized tab
               13. Separate list/search/pagination. Row actions: View Job, Attach Files, View Charges,
                  Deliver, Proforma, Print/Save PDF, **Revise Final**, **Undo Final**.
               14. **Undo Final** → confirm → "moved back to pending"; both lists refresh. Delivering from
                  here removes the row and reloads.

---

   ## 6. Deliver Job *(role-gated)*
               Tabs: **Deliver Job** (deliverable) and **Delivered Jobs**.

   ### Deliverable tab
               1. Lists final, non-closed jobs; search / paginate / Refresh.
               2. **Row checkboxes + Select All** enable multi-delivery.
               3. **Deliver single** (no multi-selection) → loads that job → Delivery Modal.
               4. **Deliver selected (multi)** (≥1 checkbox) → modal loads all selected jobs.
               5. In the Delivery Modal: jobs table, invoices, receipts (add receipt), delivery manner,
                  parts-in-invoice setting, PDF generation → complete → success; grid refreshes; selection
                  clears; job moves to Delivered.
               6. **View Job** and **Attach Files** work per row.

### Delivered tab
               7. Lists delivered jobs; posted/unposted indicator when "post to accounts" is ON.
               8. Row actions: View Job, Attach Files, Print Invoice + Receipts, Delivery Note, **Undo
                  Delivery**.
               9. **Undo Delivery** with a **posted invoice** → blocked ("invoice #… is already posted");
                  otherwise confirm → job returns to deliverable.
               10. From Job Control, the "Undo Delivery" button opens this section on the Delivered tab
                  with a Back button.

---

   ## 7. Accounts Posting *(only when "post to accounts" is ON; role-gated)*
               1. Item **appears only** when the setting is ON; confirm it is absent when OFF.
               2. Per-division table of unposted counts: Money Receipts, Purchase Invoices, Sales
                  Invoices, Job Invoices, with a Totals footer.
               3. No branch → "Select a branch"; no active divisions → "No active divisions".
               4. **Refresh** reloads counts (spins).
               5. All totals 0 → "Everything is posted" (green); Post button **disabled**.
               6. Postable records exist → "N records ready to post"; **Post data to Trace Plus** enabled.
               7. **Post** → button "Posting…"; live **progress bar** (processed/total, current division,
                  %, failed) via subscription; re-click prevented while posting.
               8. Success → toast + counts reload to 0. Server error → error toast.

---

   ## 8. Opening Jobs *(role-gated)*
               Legacy/pre-existing jobs with a **manual job no** and full lifecycle fields.

   ### New mode
1. Opens "— New" with: manual **Job No**, Job Date, Customer, Job Type, Receive Manner/
   Condition, Status, Technician, Product/Model, Serial, Qty, **Problem Reported (required)**,
   Diagnosis, Work Done, Amount, Delivery Date, **is_closed**, **is_final**, Warranty Card,
   Remarks.
2. Job No normalized on save; requires configured `JOB_SHEET` sequence (blocks otherwise).
3. Warranty type sets `is_warranty`. Model **+Add** and **Reset** behave like Single Job.
4. **Save Job** → success; form resets.

   ### View mode
               5. Toggle **View** → **date-range** filters (default current FY) + search (job no / customer
                  / mobile); changing dates resets to page 1.
               6. Columns: #, Date, Job No (+CLOSED), Customer, Mobile, Job Type, Status, Technician, Amount.
               7. **Edit** (⋯): disabled when `is_final`; else loads edit form → Save → update toast.
               8. **Delete** (⋯): confirm → permanently deletes → grid reloads.

               ---

   ## 9. Receipts *(role-gated)*
               Customer payments against jobs.

   ### List
               1. Columns: #, Date, Receipt No (+Posted/Not-Posted when accounts ON), Job No (+date+status),
                  Customer (+mobile), Mode (colored badge), Amount, Ref No, Actions.
               2. Footer shows **page total** of amounts. Search (job/receipt no/customer/mode/ref);
                  paginate; Refresh; default date range = current FY.

   ### New / Edit
               3. **+ New Receipt** → dialog: select job (lookup), payment date, mode, amount, ref no,
                  remarks; Save disabled until valid → "receipt created"; list reloads.
               4. **Edit** (⋯): disabled when the job is **restricted** (closed/final/ON_HOLD); else edit
                  → "receipt updated". Dialog can't be dismissed by outside click / while submitting.

   ### Print, view, delete
               5. **Print Receipt** → PDF (spinner on the menu button) → preview. **View Job** → modal.
               6. Delete when job **restricted** → blocked dialog. Delete when **posted** → blocked dialog.
                  Delete a normal receipt → confirm (names amount/mode/job) → "receipt deleted".

---

## 10. Part Used (Job)
Records spare parts consumed on a job (creates stock CONSUMPTION transactions).

### New mode
1. Opens "— New"; select a **job** via lookup → job details (type/status/date) show; parts
   grid enables.
2. Add lines: each needs a **part** and **qty > 0**; cost auto-fills, markup% applies to
   selling.
3. **Warranty job** → selling price forced to **0** for all lines.
4. Save enabled only with ≥1 valid new line OR ≥1 deleted line → "part used saved"; creates
   CONSUMPTION transactions (dr_cr = "C") dated to the job date; form resets.
5. **Reset** clears job + lines.

### View mode
6. Toggle **View** → rows grouped by **job** (first row shows job no + badges + Final/Closed
   flags + date; continuation rows show ╰). Columns: Date, Job, Part Code, Part Name, UOM,
   Qty Used, Remarks, Actions. Search job no / part code / part name; paginate; Refresh.

### Row actions
7. **View Job** (first row of a group) → details modal.
8. **Edit**: disabled when job closed/final; else Edit dialog → change qty/prices/remarks →
   reloads.
9. **Delete**: disabled when job closed/final; else confirm → deletes consumption (reverses
   stock) → reloads.

---

## 11. Cross-cutting regression (after the above)
1. **Branch switch** on each section → data reloads for the new branch.
2. **GST vs Non-GST division**: repeat Final-a-Job / Delivery for each; GST columns/HSN
   requirements apply only to GST.
3. **Warranty**: selling prices = 0 and amount = 0 across Part Used and Final.
4. **File-attachment counts** stay consistent for the same job across Single Job, Batch,
   Job Control, Final, and Deliver views.
5. **Invoice-posted lock**: once posted, Undo Final / Revise Final / Undo Delivery / receipt
   delete are blocked everywhere they appear.
6. **Transaction-count lock**: a job with activity can't be deleted from Single Job or Batch.
7. **Empty/loading/error states**: force each and confirm skeletons, empty messages, toasts.
8. **Responsive**: sticky headers/action columns and horizontal scroll on narrow widths.
9. **Print copies**: `no_of_job_sheets_per_print` default is respected and adjustable.
10. **Dark mode**: badges, dialogs, and grids render correctly.
