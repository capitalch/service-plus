# Manual Testing Plan — Jobs Menu (Client App)

Systematic, exhaustive manual test steps covering **every item** in the Jobs menu and
**every user-facing action, validation, and edge case** within each. Execute top-to-bottom.

## Jobs menu items (in explorer order)
1. **New Job → Single Job**
2. **New Job → Batch Jobs**
3. **Job Control**
4. **Job Pipeline**
5. **Final a Job**
6. **Deliver Job**
7. **Accounts Posting** *(only visible when the "post data to accounts" setting is ON)*
8. **Opening Jobs**
9. **Receipts**
10. **Part Used (Job)**

---

## 0. Pre-conditions & Global Setup (do once before all sections)
1. Log in as a client user with access to Jobs; confirm the left **Jobs** activity bar/explorer renders.
2. Confirm a **Branch** is selected in the global header. Note its code.
3. Confirm at least one **Division** exists. If multiple divisions exist, note which are **GST** and which are **Non-GST** (division dropdowns show "(GST)"/"(Non-GST)").
4. Verify master data exists (needed by forms): Customers, Technicians, Brands, Products, Models, Customer Types, States, Additional Charges, Parts with stock.
5. Confirm **Document Sequence** for `JOB_SHEET` is configured with a non-empty prefix (job creation blocks without it).
6. Note the current **Financial Year** date range (used as default filters in some grids).
7. Identify whether the **"post data to accounts"** setting is ON (Accounts Posting menu item appears) or OFF.
8. Note app settings that affect Jobs: `markup_percent_over_cost`, `show_parts_in_job_invoice`, `no_of_job_sheets_per_print`, default GST rate, default HSN (spare part / service charge).

### Global checks to repeat on EVERY section
- Section header shows correct icon + title.
- With **no branch selected**, forms show the "No Branch Selected" empty state / actions disable.
- Toast messages appear for success and failure paths.
- Grid pagination footer shows correct "Showing X–Y of N (Page p of t)".
- Search inputs are **debounced (~1.6s)**; typing does not fire per-keystroke.
- The **X** clear button inside search boxes resets the query and returns to page 1.
- **Refresh** button reloads the current page/filters and disables while loading and when no branch.
- Loading state renders skeleton rows; empty state renders the "No … found" message.

---

## 1. Single Job  (Jobs → New Job → Single Job)

### 1A. New mode — layout & metadata
1. Open Single Job. Confirm mode defaults to **New** (title shows "— New").
2. Confirm the **Quick Info Card** renders at top (recent jobs shortcut).
3. Confirm **Job No** field shows `AUTO` and is read-only.
4. Confirm **Division** selector appears **only** when >1 division exists; if shown it is required (red border until chosen).
5. Confirm required-field markers (*) on: Customer, Receive Manner, Job Type, Product/Model, Qty (+ Division if shown).

### 1B. New mode — field validation
6. Attempt **Save Job** with an empty form → Save button is **disabled** (form invalid).
7. Fill Customer via the customer combobox: search, select a customer → name, mobile, address snapshot, and GSTIN auto-populate.
8. Clear the customer (clear button) → customer_id, GSTIN, mobile, address reset; Save disables again.
9. Enter an **invalid GSTIN** (wrong length/format) → inline red error; valid 15-char GSTIN → error clears. Field auto-uppercases and caps at 15 chars.
10. Select **Job Type = Under Warranty** → **Warranty Card No** enables. Select any other job type → Warranty Card No disables/clears.
11. **Qty**: enter 0 or negative → validation error (min 1). Enter a valid positive number → ok.
12. **Job Date**: change to a valid date; confirm it persists.
13. **Product/Model**: open combobox, filter, select a model. Click the green **+** to open **Add Model** dialog; add a new model → on success the model list refreshes and is selectable.
14. Optional fields: Alt Job No, Serial No, Receive Condition (None allowed), Problem Reported, Remarks — all accept input.

### 1C. New mode — save
15. With all required fields valid, click **Save Job** → success toast ("job created"), form resets, Quick Info Card refreshes; new job gets status **RECEIVED**.
16. Save a job **without a configured JOB_SHEET sequence** (if testable) → blocked with "doc sequence not configured" error.
17. Click **Reset** → clears the form back to defaults and drops any edit target.
18. Save a **warranty** job and later verify part selling prices are forced to 0 in downstream flows (see §10/§5).

### 1D. View mode — grid
19. Toggle to **View**. Confirm grid columns: #, Date (+division code chip), Job (+CLOSED badge, Batch chip, file-count chip), Customer (+GSTIN), Mobile, Device Details, Job Type badge, Status badge, Technician, Amount (₹), Actions.
20. Confirm the count `(N)` in the header matches the footer total.
21. **Search** by job no, customer, mobile, model, brand, serial → results filter (debounced).
22. Paginate: First/Prev/Next/Last enable/disable correctly at boundaries.
23. Rows belonging to a batch show a colored left border + "Batch #" chip.

### 1E. View mode — row actions (⋯ menu)
24. **Edit Job**: on a non-final, non-batch job → switches to edit form pre-filled with job detail; title shows "— Edit" (amber). Change a field, Save → update toast; returns to prior view.
25. Edit a job whose **is_final = true** → Edit item is **disabled** with tooltip "Job is finalized — edit not allowed".
26. Edit a **batch** job → navigates to Batch Jobs edit for that batch (not single edit).
27. **Edit + change Division** across GST↔Non-GST when an invoice already exists → blocked with "void the existing invoice first".
28. **View Job**: opens Job Details modal (read-only). Close returns to grid.
29. **Print PDF**: loads job detail, opens PDF preview modal titled "Job Sheet #<no>". Change **print copies** → preview regenerates with new copy count. Download filename includes date + customer.
30. **Attach Files**: opens attach dialog; upload a file → file-count chip updates on the row and Quick Info Card; grid reloads.
31. **Delete Job**: allowed only when `transaction_count ≤ 1`; otherwise disabled with "Cannot delete: job has activity". For a fresh job, confirm dialog → Delete → success toast, attached files deleted first, row removed.
32. Cancel the delete dialog → no change.

---

## 2. Batch Jobs  (Jobs → New Job → Batch Jobs)

### 2A. New mode — batch form
1. Open Batch Jobs (title "— New"). Confirm Quick Info Card + batch form render.
2. Confirm shared header fields: Division (if >1), Batch Date, Customer, Receive Manner, GSTIN.
3. Confirm the **rows** grid: each row has Job Type, Product/Model, Alt Job No, Serial No, Receive Condition, Warranty Card No (enabled only for warranty type), Qty, Problem, Remarks.
4. **Add row** / **remove row** controls work. Enforce a batch must have **≥2 jobs**: Save disabled with <2 valid rows.
5. Validate each row like Single Job (required job type, model, qty ≥ 1; warranty card gating).
6. **Save Batch** → success toast "Batch #N created with M jobs"; form resets; a **post-save Attach Files** dialog lists each created job with an uploader. Attach files per job, then **Done**.

### 2B. View mode — grouped grid
7. Toggle **View**. Confirm batches render as **grouped** blocks: a batch header row (#batch, date, division code, customer, mobile, job count) followed by indented job rows numbered `batch.N`.
8. Search by batch no / customer / mobile (debounced). Paginate.

### 2C. Batch-level actions (⋯ on batch header)
9. **View Batch** → opens Batch View modal listing all jobs; supports print + per-job file count changes.
10. **Print PDF** → loads batch detail, opens combined batch job-sheet PDF; copy-count change regenerates.
11. **Edit Batch** → loads batch into the New form in edit mode ("— Edit #N"); modify shared fields, add/remove/update jobs, Save → "Batch #N updated". Deleted rows are removed, new rows inserted.
12. **Delete Batch** → enabled only when **every** job has `transaction_count ≤ 1`; else disabled with tooltip. Confirm dialog states job count; Delete → "Batch #N deleted".

### 2D. Individual job actions inside a batch (view grid)
13. **Attach Files** (paperclip) per job → dialog; upload updates that job's file count immediately.
14. **Delete single job**: only shown when batch has **>2 jobs** AND that job `transaction_count ≤ 1`. Deleting when batch would drop below 2 → blocked with "A batch must have at least 2 jobs".
15. Confirm files are deleted before the job when deleting a single job.

### 2E. Cross-navigation
16. From **Single Job** view, editing a batch job routes here and auto-opens that batch in edit; after saving, confirm it returns to Single Job ("return to single job" path).

---

## 3. Job Control  (Jobs → Job Control)
The operational hub: status transitions, charges, finalize, deliver, undo.

### 3A. List & filters
1. Open Job Control. Default filter = **Open** (non-closed jobs). Confirm columns incl. Status cell showing badges: status, FINAL, GST/Non-GST, Invoice Posted/Unposted.
2. Filter tabs: **Open / Delivered / All** switch the list; **Status** button opens a status-chip filter bar with per-status colored chips + "All Statuses" + **Back**.
3. Search across job no, customer, mobile, product, brand, model, serial (debounced). Paginate.
4. Click a row → it becomes **selected** (highlighted); selection is restored after a mutation/reload.
5. Batch jobs render with per-batch colored left borders and a start divider.

### 3B. Row actions — non-delivered jobs
6. **View** (eye) → Job Details modal.
7. **Status actions** (⇄ dropdown) lists valid **transitions** for the job's current status+type ("Move job to …"). Pick a target → **Status Transition modal** opens.
   - Modal collects: division, technician, estimate amount (only when the transition needs "E"), remarks, transaction date.
   - Submit → success toast "Job → <target>"; grid refreshes; row stays selected.
8. Confirm **no-action** statuses (COMPLETED_OK, RETURN, DELIVERED_OK/NOT_OK) show no "move" list; if a job has no available action at all, a **lock** icon shows instead of the menu.
9. **Undo Last Transaction**: available when `transaction_count ≥ 1` and status is not a delivered code. Confirm dialog → undo restores previous status; error surfaces server message.
10. **Parts & Charges**: shown for RECEIVED/ASSIGNED/ESTIMATE_APPROVED/IN_PROGRESS and job type not DEMO/INSPECTION → opens Job Charges modal to add/edit parts & charges.
11. **Final the Job**: shown when status = COMPLETED_OK and not yet final → opens the full-screen Final Job flow (same as §5 detail). On finalize, returns and restores the row.
12. **Revise Final / Undo Final**: shown when COMPLETED_OK and already final. Both are **disabled when `invoice_is_posted = true`** (tooltips: "Cannot revise/undo a posted job"). Undo Final → "moved back to pending".
13. **Deliver Job**: shown when `is_final && !is_closed` → opens Delivery modal (§6).
14. **Proforma Invoice**: shown for final, non-closed jobs with `amount > 0` → opens proforma modal.
15. **Charges (read-only)**: opens read-only charges view for a final job.

### 3C. Row actions — delivered jobs (⋮ menu)
16. For DELIVERED_OK/NOT_OK rows: **View**, **Delivery Note**, **Invoice + Receipts** (only if invoice exists), **Print / Save as PDF**, and **Undo Delivery**.
17. **Undo Delivery** disabled when `invoice_is_posted = true` (tooltip "Cannot undo: invoice is already posted").

### 3D. Attachments & top-bar sub-views
18. Click a row's **file-count** chip → opens Attach dialog; uploads update the chip.
19. Top bar **Undo Final** button → opens Final-a-Job in "finalized" tab with a Back button; **Back** returns to Job Control list.
20. Top bar **Undo Delivery** button → opens Deliver Job in "delivered" tab with Back; Back returns.
21. **Refresh** reloads current filter/page.

### 3E. Full status lifecycle (end-to-end)
22. Take a fresh RECEIVED job and walk it through the allowed transitions (Assigned → In Progress → Completed OK), adding parts/charges where enabled, then **Final**, then **Deliver**; verify at each step the badges (FINAL, Invoice) and available actions change appropriately.

---

## 4. Job Pipeline  (Jobs → Job Pipeline)

### 4A. Landing (bar chart)
1. Open Job Pipeline. Confirm a horizontal **bar list** of statuses with counts; header shows "N total jobs".
2. Confirm an **All** bar at top, then **actionable** statuses, a dashed divider, then **read-only** statuses (COMPLETED_OK, RETURN, DELIVERED_OK/NOT_OK).
3. Bars with **count = 0** are dimmed and **not clickable**; non-zero bars are clickable.
4. Bar widths scale relative to the max count; hover shows tooltip "<status>: N jobs".
5. **Refresh** icon reloads counts (spins while loading).

### 4B. Drill-down
6. Click the **All** bar → drill-down showing all jobs.
7. Click a specific status bar → drill-down filtered to that status.
8. In drill-down, verify the **Back** control returns to the landing bar list.
9. Verify drill-down list content matches the count shown on the landing bar.
10. Verify technician data loads (used for display/filter in drill-down).

---

## 5. Final a Job  (Jobs → Final a Job)
Two tabs: **Final a Job** (pending = COMPLETED_OK jobs) and **Finalized Jobs**.

### 5A. Pending tab (list)
1. Open Final a Job → **Final a Job** tab active. Grid lists completed jobs pending finalization; count shown.
2. Search (debounced), paginate, Refresh.
3. Row actions: **View Job**, **Attach Files**, **Open Final** (loads detail).

### 5B. Final detail form
4. Open a pending job. Confirm the full-screen final form loads with: job header, Division selector, GSTIN, parts grid, additional charges grid, Back-Calc target, "show parts in invoice" toggle, IGST toggle.
5. **Parts**: add a line via part-code lookup → cost/selling/GST/HSN auto-fill using master + markup%. Non-GST division inflates cost to absorb supplier GST. Editing **cost** cascades selling = cost×(1+markup%) and sale-price-with-GST.
6. **Warranty job**: selling prices force to 0 and GST rate 0; confirm amount computes to 0.
7. **Charges**: add/edit/remove additional charge lines (name from combobox, ref no, description, qty, cost, selling, GST, HSN).
8. Remove a part/charge line → tracked as deleted; totals resync.
9. **Change Division** (GST↔Non-GST): part & charge rates/HSN recompute; the change persists to DB immediately so reopening shows correct values.
10. **Reset prices** → recomputes all lines fresh from master (drops custom overrides).
11. **Back Calculate / Target amount**: set a target → confirm allocation; setting a target with **no** parts/charges → blocked. Target vs computed line total differing by **> ₹0.50** → "Amount Difference Too Large" dialog blocks save.
12. **GST invoice guards** (GST division, non-warranty): missing **HSN** on any part/charge → blocked; **GST rate = 0** on any line → blocked.
13. **GSTIN**: invalid non-empty GSTIN → blocked ("enter a valid 15-char GSTIN or clear").
14. **Save (finalize)** with valid data → "Job marked as final"; parts create stock CONSUMPTION transactions; customer GSTIN saved; returns to list; both tabs refresh.
15. **Back** button discards the detail and returns to the list without saving.

### 5C. Finalized tab
16. Switch to **Finalized Jobs** tab → separate list/search/pagination.
17. Row actions: **View Job**, **Attach Files**, **View Charges** (read-only modal), **Deliver** (opens delivery modal), **Proforma**, **Print/Save PDF**, **Revise Final** (reopens final detail), **Undo Final**.
18. **Undo Final** → confirm dialog → "moved back to pending"; both lists refresh and row position restored.
19. Confirm delivering from here removes it from finalized and reloads.

---

## 6. Deliver Job  (Jobs → Deliver Job)
Two tabs: **Deliver Job** (deliverable) and **Delivered Jobs**.

### 6A. Deliverable tab
1. Open Deliver Job → deliverable list (final, non-closed jobs). Count shown; search/paginate/Refresh.
2. **Row select checkboxes** + **Select All**: selecting rows enables multi-delivery.
3. **Deliver single**: click deliver on a row (with no multi-selection) → loads that job's delivery detail and opens **Delivery Modal**.
4. **Deliver selected (multi)**: with ≥1 checkbox selected, trigger multi-deliver → modal loads all selected jobs.
5. In the Delivery Modal, verify: jobs table, invoices section, receipts section (add receipt), delivery manner selection, parts-in-invoice setting applied, PDF generation. Complete delivery → success; grid refreshes; selection clears; job moves to Delivered.
6. **View Job** (eye) and **Attach Files** work per row.

### 6B. Delivered tab
7. Switch to **Delivered Jobs** → list of delivered jobs; if `post data to accounts` is ON, a posted/unposted indicator shows.
8. Row actions: **View Job**, **Attach Files**, **Print Invoice + Receipts**, **Delivery Note**, **Undo Delivery**.
9. **Undo Delivery** on a job whose **invoice is posted** → blocked with toast "Cannot undo delivery — invoice #… is already posted". Otherwise → confirm and undo; job returns to deliverable.

### 6C. Entry from Job Control
10. Confirm the "Undo Delivery" button in Job Control opens this section on the Delivered tab with a **Back** button.

---

## 7. Accounts Posting  (Jobs → Accounts Posting)  *(only when setting ON)*
1. Confirm the menu item **only appears** when "post data to accounts" is ON. If OFF, confirm it is absent.
2. Open Accounts Posting. Confirm per-division table of unposted counts: Money Receipts, Purchase Invoices, Sales Invoices, Job Invoices, with a Totals footer.
3. With **no branch** → "Select a branch" message. With no active divisions → "No active divisions" message.
4. **Refresh** reloads counts (spins while loading).
5. When all totals are 0 → "Everything is posted" (green) and the post button is **disabled**.
6. When postable records exist → "N records ready to post"; **Post data to Trace Plus** button enabled.
7. Click **Post** → button shows "Posting…"; a **progress bar** updates live (processed of total, current division, % , failed count) via subscription.
8. On success → success toast + counts reload (should drop to 0). On server error → the returned error is shown as a toast.
9. Re-clicking Post while posting is prevented (button disabled during posting).

---

## 8. Opening Jobs  (Jobs → Opening Jobs)
For entering pre-existing/legacy jobs with a **manual job no** and full lifecycle fields.

### 8A. New mode
1. Open Opening Jobs (title "— New"). Confirm form fields incl. **manual Job No**, Job Date, Customer, Job Type, Receive Manner/Condition, Status, Technician, Product/Model, Serial No, Qty, Problem Reported (required), Diagnosis, Work Done, Amount, Delivery Date, **is_closed**, **is_final**, Warranty Card No, Remarks.
2. Job No is normalized on save (confirm formatting). Problem Reported is required.
3. Requires configured JOB_SHEET sequence (blocks otherwise, same as Single Job).
4. Warranty job type → warranty handling (`is_warranty` flag) set.
5. **Save Job** → success; form resets. Model +Add and Reset behave like Single Job.

### 8B. View mode
6. Toggle **View**. Confirm **date-range** filters (default = current financial year) + search (job no/customer/mobile). Changing dates resets to page 1.
7. Grid columns: #, Date, Job No (+CLOSED badge), Customer, Mobile, Job Type, Status, Technician, Amount.
8. **Edit** (⋯): disabled when `is_final` (tooltip); else loads job into edit form ("— Edit"). Save → update toast; returns to view.
9. **Delete** (⋯): confirm dialog → permanently deletes; success toast; grid reloads.

---

## 9. Receipts  (Jobs → Receipts)
Customer payments against jobs.

### 9A. List
1. Open Receipts. Grid columns: #, Date, Receipt No (+Posted/Not-Posted when accounts ON), Job No (+date+status badge), Customer (+mobile), Mode (colored badge), Amount (₹), Ref No, Actions.
2. Footer shows **Page total** of amounts. Search (job no/receipt no/customer/mode/ref); paginate; Refresh. Default date range = current financial year.

### 9B. New / Edit receipt
3. **+ New Receipt** → dialog. Select a job (job lookup), enter payment date, mode, amount, ref no, remarks. Save disabled until valid.
4. Save new → "receipt created"; list reloads.
5. **Edit** (⋯): disabled when the job is **restricted** (closed / final / ON_HOLD). Editable otherwise → change values → "receipt updated".
6. Confirm dialog cannot be dismissed by outside click / while submitting.

### 9C. Print & view
7. **Print Receipt** (⋯) → generates receipt PDF (spinner on the row's menu button while loading); opens preview.
8. **View Job** (⋯) → Job Details modal.

### 9D. Delete (three branches)
9. Delete a receipt whose **job is restricted** → blocked AlertDialog ("job is in a restricted status").
10. Delete a receipt that is **posted to accounts** (`is_posted`) → blocked AlertDialog (posted message).
11. Delete a normal receipt → confirmation dialog naming amount/mode/job → Delete → "receipt deleted"; list reloads.

---

## 10. Part Used (Job)  (Jobs → Part Used (Job))
Record spare parts consumed on a job (creates stock CONSUMPTION transactions).

### 10A. New mode
1. Open Part Used (title "— New"). Select a **job** via job lookup → job details (type/status/date) show; parts entry grid enables.
2. Add part lines: each needs a **part** and **qty > 0**. Cost auto-fills from master; markup% applies to selling.
3. **Warranty job**: selling price is forced to **0** for all lines.
4. Save is enabled only when there is ≥1 valid new line OR ≥1 deleted line. Click **Save** → "part used saved"; stock CONSUMPTION transactions created (dr_cr = "C") dated to the job date; form resets.
5. **Reset** clears the selected job and lines (remounts the form).

### 10B. View mode
6. Toggle **View**. Grid groups rows by **job** (first row per job shows job no + type/status badges + Final/Closed flags + date; subsequent rows show the ╰ continuation marker). Alternating group backgrounds.
7. Columns: Date (created_at date+time), Job, Part Code, Part Name, UOM, Qty Used, Remarks, Actions. Search by job no / part code / part name (debounced); paginate; Refresh.

### 10C. Row actions
8. **View Job** (eye, first row of group only) → Job Details modal.
9. **Edit**: disabled when the job is **closed or final** (tooltip); else opens Edit Part Used dialog → change qty/prices/remarks → save → grid reloads.
10. **Delete**: disabled when job closed/final; else Delete Part Used dialog → confirm → deletes the consumption (and reverses stock) → grid reloads.

---

## 11. Cross-cutting regression checks (run after the above)
1. **Branch switch**: change branch in the global header on each section → data reloads for the new branch; forms respect the new branch.
2. **Division GST vs Non-GST**: repeat Final-a-Job / Delivery for both a GST and a Non-GST division; verify GST columns/HSN requirements only apply to GST.
3. **Warranty vs paid** jobs: verify selling prices = 0 and amount = 0 for warranty across Part Used and Final.
4. **File attachments** count stays consistent across Single Job, Batch, Job Control, Final, Deliver views for the same job.
5. **Invoice posted lock**: once a job's invoice is posted, confirm Undo Final / Revise Final / Undo Delivery / receipt delete are all blocked in every place they appear.
6. **Transaction-count lock**: a job with activity cannot be deleted from Single Job or Batch.
7. **Empty/loading/error states**: force each (no data, slow network, server error) and confirm skeletons, empty messages, and error toasts.
8. **Responsive**: verify sticky headers/action columns and horizontal scroll on narrow widths; Actions column hides on small screens in Job Control.
9. **Print copies**: `no_of_job_sheets_per_print` default is respected in job-sheet PDFs and adjustable in the preview.
10. **Dark mode**: toggle theme and confirm badges/dialogs/grids render correctly.
```
