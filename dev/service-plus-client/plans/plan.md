# Manual Test Plan — Inventory Module (Service+ Client)

## Context
This is a systematic, exhaustive manual test plan for **every item under the Inventory
menu**. The Inventory menu (`client-explorer-panel.tsx` → `InventoryExplorer`) contains
10 items, routed through `client-inventory-page.tsx`:

1. Stock Overview
2. Purchase Entry
3. Sales Entry
4. Stock Adjustment
5. Branch Transfer
6. Loan Entry
7. Opening Stock
8. Part Finder
9. Set Part Location
10. Stock Snapshot *(Admin group — visible only to userType `A`/`S`)*

Six of these (Purchase, Sales, Stock Adjustment, Branch Transfer, Loan Entry, Opening
Stock) are **entry screens** sharing a common New/View pattern, a shared line-item editor
(`part-code-input.tsx`, `brand-select.tsx`, `line-add-delete-actions.tsx`,
`view-mode-toggle.tsx`) and a common list/filter/paginate/export/edit/delete flow. The plan
therefore defines the shared behaviour once (Sections A–C) and then lists screen-specific
cases so nothing is duplicated but nothing is missed.

Legend: **TC** = Test Case. Each TC = numbered steps + expected result. Run every screen in
**both GST and non-GST divisions** and on **at least 2 branches** unless noted.

---

## 0. Test environment preconditions
0.1 Seed a client DB with: ≥2 branches; each branch ≥2 divisions (one **GST-registered**
    with a `gstin`+state code, one **non-GST**); ≥2 brands; ≥20 spare parts across brands
    (with part_code, part_name, uom, hsn, gst_rate, cost_price); ≥2 vendors/suppliers;
    ≥2 customers (one with GSTIN + state, one walk-in); ≥2 storage locations per branch;
    all stock-transaction-type rows present (ADJUSTMENT_IN/OUT, BRANCH_TRANSFER_IN/OUT,
    LOAN_IN/OUT, OPENING_STOCK, PURCHASE, SALE).
0.2 Prepare one **admin** user (userType A/S) and one **non-admin** business user.
0.3 Confirm the "Post data to accounts" client setting can be toggled on/off (affects the
    Posted/Not-Posted badges).
0.4 Note the current financial year (entry list default date range = current FY).

---

## A. Global / cross-cutting behaviours (verify on every screen)
A1. **Menu navigation** — From the Inventory explorer, click each of the 10 items; the
    correct section renders; the selected item is highlighted; no console errors.
A2. **Admin-only gating** — As non-admin, confirm the "Admin" group and **Stock Snapshot**
    are hidden; as admin they appear.
A3. **Global branch switch** — Change the global branch (top bar); every list re-fetches for
    the new branch; entry screens reset appropriately; totals recompute.
A4. **No branch selected** — Screens show a sensible empty/prompt state, no crash.
A5. **Loading state** — Each list shows skeleton rows while fetching; controls disabled during
    load.
A6. **Empty state** — With filters that match nothing, the correct "No … found" message shows.
A7. **Network/server error** — Simulate a failed query (offline/kill server); an error toast
    appears (per-screen message), UI stays usable, no infinite spinner.
A8. **Currency/number formatting** — Amounts render via `formatCurrency`; negative/zero stock
    is colour-coded (orange negative, amber zero, green positive) on Stock Overview.
A9. **Responsiveness** — Resize to narrow/mobile; toolbars wrap, tables scroll horizontally,
    sticky headers/footers/action column stay pinned.
A10. **Keyboard/focus** — Tab order is logical; dialogs trap focus; Esc closes dialogs when not
    mid-submit.
A11. **Concurrent/stale** — Open the same record in two tabs; edit/delete in one; the other
    reports failure gracefully on save/delete.

---

## B. Shared entry-screen chrome (Purchase, Sales, Stock Adjustment, Branch Transfer, Loan, Opening Stock)
B1. **Mode toggle (New ⇄ View)** — `ViewModeToggle` switches between the entry form and the
    list; switching resets the form; "New" is disabled while editing an existing record.
B2. **Header status label** — Header shows "— New" / "— Edit" (amber) / "— View"; View shows a
    record count.
B3. **Brand select** — Required in New mode; when only one brand exists it auto-selects; Save is
    blocked until a brand is chosen (empty brand is highlighted); brand is hidden/greyed in View.
B4. **Reset button** — Clears all header fields + line items back to defaults, exits edit mode,
    clears validation flags; spinner shows while submitting.
B5. **Save enablement** — Save is disabled until the form is valid (schema), brand chosen, lines
    valid, and no blocking duplicate check running.
B6. **Save success** — On create: success toast, form resets for the next entry; on edit: success
    toast, returns to View and the list refreshes.
B7. **Save failure** — Force a failure (e.g. missing txn-type / server error); correct error toast;
    the record is **not** partially saved; form remains for retry.
B8. **View-mode filters** — Date range (`from`/`to`, default = current FY) and search box filter the
    list; changing a filter resets to page 1.
B9. **Debounced search** — Typing in the list search debounces before firing (Purchase ≈1600ms);
    the clear (✕) button empties the search and reloads.
B10. **Pagination** — First/Prev/Next/Last buttons; disabled at bounds; page counter text correct;
    page size 50; footer "Showing X–Y of N".
B11. **Row actions menu** — View Details, Show PDF, Download Excel (where present), Edit, Delete.
B12. **Delete confirm** — Delete opens a confirm dialog warning it also removes stock transactions;
    Cancel aborts; Confirm deletes, toasts success, refreshes list; dialog can't be dismissed
    mid-delete.
B13. **Edit round-trip** — Edit loads the record into the form (brand preselected, lines populated,
    toggles set); modifying and saving updates it; the list reflects changes.
B14. **Posted badge** — When "post to accounts" is enabled, list rows show Posted/Not-Posted; a
    posted record's editability/deletion behaves per business rule (verify allowed or blocked).

---

## C. Shared line-item editor (used by all 6 entry screens)
C1. **Add row** — "Add row below" inserts a new empty line beneath the current one.
C2. **Delete row** — "Remove line" deletes a line; delete is disabled when only one line remains.
C3. **Part code — inline dropdown** — Typing in Part Code shows a debounced (≈1200ms) dropdown of
    matching parts (scoped to the selected brand); selecting one fills part_id, part_name, uom, hsn,
    rates.
C4. **Part code — Enter search** — Pressing Enter with a typed code opens/searches the part picker;
    exact match auto-fills; clear (✕) empties the field.
C5. **No brand guard** — Attempting a part search before choosing a brand shows the warning "Please
    select a brand before searching parts."
C6. **Part not found** — Searching a non-existent code shows a "no results / could not retrieve"
    message and does not fill the line.
C7. **Quantity** — Accepts positive numbers; rejects/zeros negatives (min 0); non-numeric ignored;
    line totals recompute on change.
C8. **Duplicate part** — Add the same part on two lines; verify the app's intended behaviour
    (merge, warn, or allow) and that stock math is still correct.
C9. **Line validity gate** — A line missing a part or with qty 0 marks lines invalid and blocks
    Save (screen-specific "line fields required" toast).

---

## 1. Stock Overview (read-only)
1.1 Open Stock Overview; table lists parts with Part Code, Part Name, Category, UOM, Current
    Stock, Unit Cost, Value for the current branch.
1.2 **Search** — Type name/code/category; results filter after ≈500ms debounce; ✕ clears.
1.3 **Brand filter** — Select a brand; list narrows; "All" option shows every brand.
1.4 **Sorting** — Click each sortable header (Part Code, Part Name, Category, Current Stock, Unit
    Cost); toggles asc/desc; sort icon reflects state; nulls sort last.
1.5 **Stock colour coding** — Confirm negative (orange), zero (amber), positive (green) stock.
1.6 **Value column** — Value = current_stock × cost_price; footer "Total Value" sums the page;
    "Records" count matches total.
1.7 **Pagination** — 50/page; First/Prev/Next/Last; disabled at bounds; page-of-N correct.
1.8 **Branch switch** — Stock recomputes for the new branch (same part may differ).
1.9 **Empty/error** — No stock → "No stock data found."; server error → load-failed toast.
1.10 Confirm there are **no create/edit/delete** affordances (this screen is read-only).

## 2. Purchase Entry
2.1 **GST indicator** — Selecting a GST-registered division shows the green "GST" badge; a
    non-GST division shows amber "Non-GST".
2.2 **Header fields** — Supplier (required), Division (required), Invoice No (required), Invoice
    Date (required, defaults today), Remarks (optional). Empty required fields block Save.
2.3 **Duplicate invoice check** — Enter an invoice_no that already exists for the supplier; the
    duplicate check flags it and disables Save while checking / when it exists.
2.4 **IGST toggle** — Toggle IGST; line tax splits between IGST vs CGST+SGST accordingly; totals
    stay consistent.
2.5 **Return toggle** — Toggle "Return"; the invoice is marked as a return (RTN badge in the
    list); when editing a non-return invoice the Return toggle is disabled.
2.6 **Under-warranty flag** — Set a line under_warranty; verify it persists and shows in
    View/PDF/Excel.
2.7 **Line pricing** — Enter qty & unit_price & gst_rate; per-line CGST/SGST/IGST and totals
    compute; header aggregate/CGST/SGST/IGST/total sum correctly.
2.8 **Master-data diff** — If a chosen part's HSN/cost/GST differs from master (`_orig_*`), the
    master-data-diff modal surfaces the difference; verify accept/ignore behaviour.
2.9 **Physical invoice modal** — Open the physical-invoice attachment/entry modal; verify its
    fields save/round-trip.
2.10 **Save create** — Save a valid invoice → success toast, form resets, stock increases for
    each part (verify in Stock Overview).
2.11 **View Details dialog** — Row → View Details shows header + all lines + tax breakup.
2.12 **Show PDF** — Row → Show PDF opens the PDF preview (branch + vendor details, line table,
    totals); verify layout and download.
2.13 **Download Excel (row)** — Downloads a per-invoice `.xlsx` with header block + line rows +
    tax columns; filename includes supplier + invoice no.
2.14 **Export list** — "Save as PDF" and "Export Excel" export the whole filtered list with
    company/branch/date-range header and totals row; disabled when list empty.
2.15 **Edit** — Edit an invoice; brand preselects; lines/toggles load; change qty and save →
    stock adjusts by the delta; list updates.
2.16 **Delete** — Delete → confirm warns about removing stock transactions → stock decreases
    accordingly.
2.17 **Posted invoice** — With posting enabled, a posted invoice shows "Posted"; verify
    edit/delete rules for posted rows.
2.18 **Return stock effect** — A purchase return reduces stock (opposite of a normal purchase).

## 3. Sales Entry
3.1 **Customer select** — Choose an existing customer → name, GSTIN, state code auto-populate;
    or type a walk-in name (empty name is flagged red / blocks Save).
3.2 **Auto IGST by state** — When customer state ≠ division GST state → IGST auto-on; same state
    → CGST+SGST; user can still override the toggle.
3.3 **GST vs normal invoice** — GST division creates a GST invoice (tax columns); non-GST
    division creates a normal invoice (no GST).
3.4 **GST price entry / back-calculation** — In GST mode, editing the GST-inclusive price
    back-calculates the base price; verify rounding.
3.5 **Target Amount back-calc** — Enter a footer Target Amount and trigger back-calculation;
    line prices scale so the grand total equals the target (mirrors "Final a Job"); verify with
    0, exact, and rounding-edge targets.
3.6 **Line totalling** — Footer sums Amount, GST Amount, Total Amount across lines correctly as
    lines/qty/price change.
3.7 **Return toggle** — Mark as sale return; list shows return; stock **increases** on a return
    vs decreases on a sale.
3.8 **Save create** — Save a valid sale → invoice number generated, success toast, stock reduces;
    verify in Stock Overview.
3.9 **Edit** — Edit a sale (originalLineIds tracked); change lines/customer; save; stock adjusts
    by delta; return flag preserved.
3.10 **View / PDF / Excel** — View Details, Show PDF preview, per-row Excel, and list PDF/Excel
    exports all render customer + GST details and correct totals.
3.11 **Delete** — Delete → confirm → stock restored.
3.12 **Negative stock sale** — Sell more than in stock; verify the intended guard (block or warn)
    and resulting stock value.
3.13 **Posted badge** — Verify Posted/Not-Posted when posting enabled.

## 4. Stock Adjustment
4.1 **Header** — Adjustment Date (required, default today), Adjustment Reason (required), Ref No
    (optional), Remarks (optional). Missing reason/date blocks Save.
4.2 **Dr/Cr per line** — Each line has a D (increase/in) or C (decrease/out) direction; verify
    D maps to ADJUSTMENT_IN and C to ADJUSTMENT_OUT txn types.
4.3 **Save create** — Mixed D/C lines save; stock increases for D lines and decreases for C
    lines (verify in Stock Overview).
4.4 **Line validity** — A line missing part/qty triggers "line fields required" toast and blocks
    Save.
4.5 **Edit** — Edit an adjustment; change a line direction/qty; save; net stock reflects the
    delta correctly.
4.6 **Delete** — Delete → confirm → stock transactions reversed.
4.7 **View / list / filters / pagination / export** — per Sections B8–B11.

## 5. Branch Transfer
5.1 **Header** — Transfer Date (required, default today), Destination Branch (required, must
    differ from source), Ref No / Remarks optional.
5.2 **Same-branch guard** — Selecting the current branch as destination is rejected/blocked.
5.3 **Dual stock effect** — On save, source branch gets an OUT (C / BRANCH_TRANSFER_OUT) and the
    destination gets an IN (D / BRANCH_TRANSFER_IN) for each line; verify stock on **both**
    branches (switch branch to confirm the IN side).
5.4 **Missing txn types** — If BRANCH_TRANSFER_IN/OUT types are absent, Save shows the specific
    error and nothing is written.
5.5 **Save create / edit / delete** — success/failure toasts; edit adjusts both branches by delta;
    delete reverses both sides.
5.6 **List / filters / pagination** — per Sections B8–B11 (transfers listed for source branch).

## 6. Loan Entry
6.1 **Header** — Loan Date (required, default today; missing → specific required message), Ref
    No / Remarks optional.
6.2 **Loan To** — Per-line "loan_to" party captured and shown in View/list.
6.3 **Dr/Cr direction** — D vs C maps to LOAN_IN vs LOAN_OUT; a loan-out reduces stock, a
    loan-return (in) increases it; verify both.
6.4 **Save create / edit / delete** — success/failure toasts; stock effects correct; delete
    reverses.
6.5 **Line validity gate** — missing fields → "loan line fields required" toast blocks Save.
6.6 **List / filters / pagination** — per Sections B8–B11.

## 7. Opening Stock
7.1 **Header** — Entry Date (required, default today), Ref No / Remarks optional.
7.2 **Per-line unit cost** — Each line has qty + unit_cost; verify unit_cost persists and feeds
    stock valuation (Stock Overview value).
7.3 **Direction** — Opening stock is always an IN (D / OPENING_STOCK type); stock increases by qty.
7.4 **Missing txn type** — If OPENING_STOCK type is missing, the specific error toast fires and
    nothing saves.
7.5 **Save create / edit / delete** — success/failure toasts; edit changes qty/cost and stock &
    valuation adjust; delete reverses.
7.6 **List / filters / pagination** — per Sections B8–B11.
7.7 **Duplicate opening stock** — Enter opening stock for a part that already has some; verify the
    intended behaviour (adds vs warns).

## 8. Part Finder (read-only lookup)
8.1 **Focus & load** — On open, the search box auto-focuses; brands and this branch's active
    locations load; single brand auto-selects.
8.2 **Search** — Debounced (≈1200ms) search by code/name/model/category; results table populates.
8.3 **Stock filter** — Toggle "All" vs "In Stock"; In-Stock hides zero/negative-stock parts.
8.4 **Sorting** — Sort by brand, category, model, part_code, part_name, location, qty (asc/desc).
8.5 **Location column** — Shows primary location; "+N" indicates additional locations.
8.6 **Select part → detail panel** — Selecting a row opens the detail panel: stock-by-location
    breakdown, cross-branch stock, and part-location history/chart.
8.7 **Stock chart** — The stock/movement chart renders for the selected part; empty history shows
    an empty state.
8.8 **Close/refresh** — Detail panel Close and Refresh work; refresh re-pulls stock/history.
8.9 **Branch switch** — Results and detail recompute for the new branch.
8.10 **No brand / empty** — Verify prompts when no brand chosen and when search yields nothing.

## 9. Set Part Location
9.1 **List load** — Shows in-stock parts for this branch with their current location; brand's
    active locations loaded; "no locations" state handled (blocks assignment with a message).
9.2 **Search** — Filters by part code/name/current location (client-side).
9.3 **Row selection** — Select individual rows (checkbox); "select all" header checkbox selects/
    clears the visible/filtered set; indeterminate state when partial; selected count is correct.
9.4 **Single-part assign** — Use the per-row Set-Location dialog to assign a location to one part;
    success toast; the row's location updates.
9.5 **Bulk assign — global** — Open "Set Location for Selected"; pick a global location → it
    applies to every selected row; Save is blocked until **all** selected rows have a location.
9.6 **Bulk assign — per-row override** — In the dialog, override individual rows to different
    locations; save applies each row's chosen location.
9.7 **Save success/failure** — Success toast + list refresh; on failure, error toast and no
    partial assignment.
9.8 **Selection reset** — After a successful save (and on branch change) the selection clears.
9.9 **Branch switch** — List reloads for the new branch's stock and locations.

## 10. Stock Snapshot (Admin only)
10.1 **Access** — Visible/reachable only for admin (userType A/S); non-admin cannot reach it.
10.2 **Month/Year picker** — Year decrement/increment; month grid; **future and current month are
     disabled** ("up to last month only"); the note is shown.
10.3 **Generate** — Click "Generate Snapshot" → confirmation dialog naming the period and warning
     it **overwrites** any existing snapshot.
10.4 **Confirm** — Confirm → success toast ("snapshot generated"); button shows "Generating…" and
     is disabled during the run.
10.5 **Cancel** — Cancelling the dialog aborts with no change.
10.6 **Overwrite** — Regenerate for a period that already has a snapshot; verify it overwrites and
     the values reflect current (including back-dated) transactions.
10.7 **Failure** — Simulate a server error → error toast; no partial snapshot.
10.8 **Back-dated correctness** — Enter a back-dated transaction, regenerate the affected month,
     and confirm the snapshot's closing stock updates accordingly.

---

## Regression touchpoints (run after any Inventory change)
R1. Every stock-moving screen (Purchase, Sales, Adjustment, Transfer, Loan, Opening) → confirm
    Stock Overview and Part Finder reflect the movement immediately after save/edit/delete.
R2. GST maths consistency across Purchase and Sales in GST vs non-GST divisions and IGST vs
    CGST/SGST.
R3. Accounts-posting badges (Posted/Not-Posted) update after posting runs; posted-record edit/
    delete rules hold.
R4. Snapshot values remain consistent after back-dated edits + regeneration.

## Verification / sign-off
- Execute every TC on Chrome + one other browser, in both light/dark themes.
- Record pass/fail with screenshots for each failed TC.
- Re-run Section R after fixes.
