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
Stock) are **entry screens**, but they are **not uniformly featured**. Purchase and Sales
are the "full chrome" pair — New/View toggle, brand-scoped line editor, date filters,
pagination, **and** View Details / PDF / Excel / list-export / Posted-badge gating.
Stock Adjustment, Branch Transfer, Loan Entry, and Opening Stock share the New/View
toggle and line editor, but **have no View Details, no PDF, no Excel, and no list export
— only Edit and Delete row actions**. Opening Stock further lacks a date-range filter
and uses a different (text-button, auto-hiding) pagination control. Sections A–C define
the shared behaviour once and flag exactly where each screen diverges.

Legend: **TC** = Test Case. Each TC = numbered steps + expected result. Run every screen in
**both GST and non-GST divisions** and on **at least 2 branches** unless noted — **Stock
Snapshot is the one exception: it is a global, non-branch-scoped operation** (see §10).

---

## 0. Test environment preconditions
0.1 Seed a client DB with: ≥2 branches; each branch ≥2 divisions (one **GST-registered**
    with a `gstin`+state code, one **non-GST**); ≥2 brands; ≥20 spare parts across brands
    (with part_code, part_name, uom, hsn, gst_rate, cost_price); ≥2 vendors/suppliers;
    ≥2 customers (one with GSTIN + state, one walk-in); ≥2 storage locations per branch;
    all stock-transaction-type rows present with these **exact** `code` values:
    `ADJUSTMENT_IN`/`ADJUSTMENT_OUT`, `BRANCH_TRANSFER_IN`/`BRANCH_TRANSFER_OUT`,
    `LOAN_IN`/`LOAN_OUT`, **`OPENING`** (not `OPENING_STOCK` — the app looks up this exact
    code; seeding it wrong silently breaks Opening Stock saves, see §7.3–7.4), `PURCHASE`,
    `SALE`.
0.2 Prepare one **admin** user (userType A/S) and one **non-admin** business user.
0.3 Confirm the "Post data to accounts" client setting can be toggled on/off (affects the
    Posted/Not-Posted badges on Purchase and Sales only — the other four entry screens have
    no posting concept at all).
0.4 Note the current financial year (entry list default date range = current FY, where
    applicable — Opening Stock has no date filter at all, see §7.6).

---

## A. Global / cross-cutting behaviours (verify on every screen)
A1. **Menu navigation** — From the Inventory explorer, click each of the 10 items; the
    correct section renders (`client-inventory-page.tsx`'s switch maps every label 1:1);
    the selected item is highlighted (`bg-(--cl-accent) text-white font-bold`); no console
    errors.
A2. **Admin-only gating** — As non-admin, confirm the "Admin" group and **Stock Snapshot**
    are hidden from the menu; as admin they appear. Note: this gating is **menu-only** —
    `client-inventory-page.tsx`'s content switch has no admin check of its own, so it
    renders `StockSnapshotTrigger` unconditionally for whatever `selected` value is active.
    If time allows, check whether a non-admin session can reach it by any means other than
    the menu click (e.g. a persisted/forced selection).
A3. **Global branch switch** — Every **View-mode** list re-fetches for the new branch and
    totals recompute. **New-mode forms do NOT reset on a branch switch** — a half-typed
    invoice/entry survives the switch untouched unless the user manually clicks Reset;
    verify this doesn't let a user accidentally save an entry for the wrong branch context.
A4. **No branch selected** — **New mode** shows a clear "No Branch Selected" placeholder
    card (verified on Purchase Entry). **View mode has no distinct message** — the list
    query simply no-ops and the screen falls back to the generic empty-filter message
    ("No … found"), not a branch-specific prompt. Confirm this is at least not a crash.
A5. **Loading state** — Lists show skeleton rows (`animate-pulse`) while fetching. Date
    filters and the division dropdown are disabled during load, but **the search input is
    not** — verify it stays typable (a known inconsistency) without breaking anything.
A6. **Empty state** — With filters that match nothing, the correct "No … found" message
    shows (exact text differs per screen, e.g. Purchase: "No purchase invoices found for
    the selected filters."; Stock Overview: "No stock data found."; Part Finder: "No parts
    found — Try adjusting your filters or search term").
A7. **Network/server error** — Simulate a failed query (offline/kill server); an error toast
    appears (per-screen `MESSAGES.ERROR_*` constant, see each section), UI stays usable
    (`finally` always clears the loading flag), no infinite spinner.
A8. **Currency/number formatting** — Amounts render via `formatCurrency`. Stock-quantity
    colour coding (confirmed on Stock Overview, `stock-overview-section.tsx`): negative =
    `text-orange-600`, zero = `text-amber-500`, positive = `text-emerald-600`.
A9. **Responsiveness** — Resize to narrow/mobile; toolbars wrap (`flex flex-wrap`), tables
    scroll horizontally (`overflow-x-auto`), sticky header/footer/action column stay pinned
    (`sticky top-0`/`sticky bottom-0`/`sticky right-0`). Verify visually — can't be confirmed
    from code alone.
A10. **Keyboard/focus** — Delete-confirmation dialogs cannot be dismissed (Esc/outside-click)
    while a delete is in progress (`onOpenChange` guards on the `deleting` flag) — confirmed
    on Purchase Entry, same pattern expected elsewhere. General tab order — verify visually.
A11. **Concurrent/stale** — Open the same record in two tabs; edit/delete in one. There is
    **no optimistic-locking/version check anywhere client-side** — whether the other tab's
    save fails gracefully depends entirely on backend behavior when it targets a row that no
    longer exists; verify at least that the client shows *some* error rather than a false
    "success."

---

## B. Shared entry-screen chrome
Applies to Purchase, Sales, Stock Adjustment, Branch Transfer, Loan Entry, Opening Stock
unless a TC says otherwise. **B11 (row actions) and list-export are full-featured only on
Purchase and Sales** — see the note under B11.

B1. **Mode toggle (New ⇄ View)** — `ViewModeToggle` switches between the entry form and the
    list; switching calls a `handleReset()` that clears the form first; "New" is disabled
    (`disableNew`) while an existing record is open for edit.
B2. **Header status label** — Header shows "— New" / "— Edit" (amber) / "— View"; View shows
    a record count (`(${total})`, or "Loading…" while fetching).
B3. **Brand select** — Required in New mode (`highlightEmpty` draws a red border when unset
    in New mode); a single brand auto-selects; Save is blocked until chosen. In View mode the
    brand selector isn't just "greyed" — on desktop it's fully `invisible` (space-preserving,
    non-interactive), and on mobile it's `hidden` entirely.
B4. **Reset button** — Clears all header fields + line items back to defaults, exits edit
    mode, clears validation/duplicate-check flags; the Reset icon spins (`animate-spin`) and
    the button disables while the form is submitting.
B5. **Save enablement** — Save is disabled until the form is schema-valid, a brand is chosen,
    lines are valid, and (Purchase only) no blocking duplicate-invoice check is running.
B6. **Save success** — Create: success toast, form resets and stays in New mode for the next
    entry. Edit: success toast, returns to View mode and the list refreshes.
B7. **Save failure** — A forced failure (e.g. missing required stock-transaction-type row, or
    a killed server) shows the screen's specific error toast; the form is only reset inside
    the `try` block on success, so a failed save leaves your data in place for retry. Whether
    the record is atomically *not* partially saved is a backend guarantee, not verifiable
    from the client alone.
B8. **View-mode filters** — Date range (`from`/`to`, default = current FY via
    `currentFinancialYearRange()`) and search filter the list; changing a filter resets to
    page 1. **Opening Stock has no date-range filter at all** — its View-mode state is only
    search + brand (see §7.6).
B9. **Debounced search** — The **list search** box debounces ≈1600ms before firing (confirmed
    `DEBOUNCE_MS = 1600` on Purchase). Clicking the clear (✕) button empties the visible text
    instantly, but the actual reload still waits out the same 1600ms debounce — it is not
    instantaneous. (Note: this is a different, separate debounce from the **duplicate-invoice
    check**, which is ≈600ms — see §2.3 — and from the **inline part-code dropdown**, which is
    ≈800ms — see §C3.)
B10. **Pagination** — First/Prev/Next/Last icon buttons; disabled at bounds; page size 50;
    footer text: `Showing X–Y of N invoices (Page P of T)`. **Opening Stock instead uses
    plain text "Prev"/"Next" buttons, and its pagination bar is hidden entirely when there's
    only one page** (unlike the other screens, which always render it) — see §7.6.
B11. **Row actions menu — only on Purchase and Sales.** Confirmed exact labels on Purchase:
    "View Details", **"Invoice PDF"** (not "Show PDF"), "Download Excel", **"Edit Invoice"**,
    **"Delete Invoice"**. **Stock Adjustment, Branch Transfer, Loan Entry, and Opening Stock
    have only "Edit" and "Delete" in their row menu — no View Details, no PDF, no Excel, and
    no list-level export button in the toolbar at all.** Do not expect B11's full richness on
    those four screens (their own sections say "per B8–B10" only, not B8–B11, for this
    reason).
B12. **Delete confirm** — Dialog warns it also removes stock transactions; exact wording
    varies slightly per screen (Purchase/Loan/Opening: "...delete the X and all associated
    stock transactions..."; Branch Transfer: "...and **reverse** all associated stock
    transactions..." — the only screen whose dialog uses "reverse"). Cancel/Confirm both
    disable while deleting; the dialog can't be dismissed mid-delete.
B13. **Edit round-trip** — Edit loads the record into the form (brand preselected, lines
    populated, toggles set). **All six screens implement edit as delete-all-original-lines +
    insert-all-new-lines** (`deletedIds: originalLineIds`), not a computed line-by-line delta
    — so "net stock reflects the delta correctly" is really testing a full
    remove-then-recreate round-trip, and its correctness is entirely a backend/trigger
    concern, not visible in the client code.
B14. **Posted badge — Purchase and Sales only.** When "post to accounts" is enabled, rows
    show Posted/Not-Posted. The Edit/Delete block for a posted row uses **hardcoded strings**
    ("Posted invoices cannot be edited."/"...deleted."), not `MESSAGES` constants, and — more
    importantly — that block is **unconditional on `is_posted`, regardless of whether the
    "post to accounts" setting is currently on or off**. If a row is `is_posted=true` from
    when posting was enabled, it stays locked even after posting is disabled again.

---

## C. Shared line-item editor
Verified in detail against Purchase Entry (`part-code-input.tsx`, `line-add-delete-actions.tsx`);
the other five entry screens use the same qty/part-line pattern with screen-specific extra
fields (e.g. Loan Entry's `loan_to`, Stock Adjustment/Loan's Dr-Cr direction — see their own
sections for line-validity specifics).

C1. **Add row** — "Add row below" inserts a new empty line beneath the current one.
C2. **Delete row** — "Remove line" deletes a line; disabled when only one line remains.
C3. **Part code — inline dropdown** — Debounce is **≈800ms**, not 1200ms. More importantly,
    this inline-as-you-type dropdown (`doInlineSearch`) does **not scope results to the
    selected brand at all** — no `brand_id` is sent, only `{search, limit, offset}`. (The
    separate Enter-key / magnifying-glass search paths below *do* pass `brand_id`.) Selecting
    a result correctly fills part_id/part_name/uom/hsn/rates.
C4. **Part code — Enter search** — Pressing Enter is a 3-way branch, not a single behavior:
    (1) exactly 1 match → auto-fills directly, no dialog; (2) >1 match → opens the "Search
    Part" picker dialog pre-populated with those results; (3) **0 matches → silently opens
    the "Add New Part" creation dialog**, prefilled with the typed code — there is no error
    toast for a not-found code on this path (contrast with C6). Clear (✕) empties part_id/
    part_name/hsn/rates correctly.
C5. **No brand guard** — The exact string `"Please select a brand before searching parts."`
    is real and confirmed (`part-code-input.tsx`), **but it only fires from the
    magnifying-glass "Browse all parts" icon** (`openPartPick()`). The Enter-key typed search
    has **no such guard** — it will run with `brand_id: null` if no brand is selected.
C6. **Part not found** — There is **no unified "no results / could not retrieve" toast** for
    a not-found code. Enter-key search with 0 matches silently opens the Add-New-Part dialog
    (see C4) — no toast at all. The literal string "Could not retrieve part details. Please
    try searching again." only fires from the pencil "Edit part details" action when
    re-fetching an already-selected part fails — unrelated to a not-found search. Inside the
    "Search Part" browse dialog, zero matches show inline text "No parts found." (not a
    toast).
C7. **Quantity** — The input is `type="number" min={0} step="0.01"`; there is **no JS-side
    clamping/rejection of negative values** — `min` is just an HTML hint. A qty ≤ 0 line is
    instead caught later by the line-validity gate (C9), not specially rejected or zeroed in
    real time. Line totals do recompute reactively as qty changes.
C8. **Duplicate part** — Confirmed intended behavior: **allowed, no merge, no warning.** No
    duplicate-part-id check exists in the entry-screen line editors (contrast: the Set Part
    Location dialog *does* implement a "Part already added" duplicate check for its own
    lines — proving duplicate-detection is a deliberate, screen-by-screen choice, not a
    universal omission). Each duplicate line posts its own stock-transaction row, so totals
    stay additively correct even though the UI shows two rows for the same part.
C9. **Line validity gate** — On Purchase, the gate is actually: part missing, OR qty ≤ 0, OR
    (GST-registered division AND price/GST > 0 AND HSN missing) — not just "missing part or
    qty 0." Each of the other four screens has its own gate (see their sections) — and on all
    four of them (Adjustment/Transfer/Loan/Opening), **the "line fields required" toast lives
    inside the same disabled-Save-button condition it's meant to report**, so a normal mouse
    click can't actually trigger it — in practice, testers will only ever see Save stay
    greyed out, not a toast. Purchase (and presumably Sales) may differ since Save there
    isn't gated on lines in quite the same way — verify directly.

---

## 1. Stock Overview (read-only)
                    File: `stock-overview-section.tsx`.
                    1.1 Open Stock Overview; table lists Part Code, Part Name, Category, UOM, Current Stock,
                        Unit Cost, Value, for the current branch — confirmed exact column order.
                    1.2 **Search** — Debounce is confirmed **≈500ms** (`setTimeout(..., 500)`); ✕ clears.
                    1.3 **Brand filter** — Select a brand; list narrows. The "all" option's visible label is
                        **"All Brands"**, not just "All".
                    1.4 **Sorting** — Sortable columns are exactly Part Code, Part Name, Category, Current
                        Stock, Unit Cost (UOM and Value are NOT sortable). **Important**: sorting is client-side
                        over only the currently-loaded 50-row page (data comes from a server-paged query) — it
                        does not re-sort the full filtered result set across pages. Nulls sort last
                        **unconditionally**, regardless of asc/desc direction (the null-check runs before the
                        direction flip).
                    1.5 **Stock colour coding** — Confirmed: negative = orange, zero = amber, positive = green.
                    1.6 **Value column** — Value = current_stock × cost_price; footer "Total Value" and
                        "Records" both explicitly sum/count only the current page (matches — no correction
                        needed here, unlike 1.4's sort scope, but worth testing together).
                    1.7 **Pagination** — 50/page; First/Prev/Next/Last; disabled at bounds; "Page P of T".
                    1.8 **Branch switch** — Re-fetches on `currentBranch.id` change.
                    1.9 **Empty/error** — Empty message is exactly "No stock data found."; error toast is
                        `MESSAGES.ERROR_STOCK_OVERVIEW_LOAD_FAILED` = 'Failed to load stock overview. Please try
                        again.' Note: the separate brand-list failure uses a hardcoded, non-`MESSAGES` string
                        "Failed to load brands" — different code path, different wording, if you're testing
                        that specific failure.
                    1.10 Confirm there are **no create/edit/delete** affordances (this screen is read-only).

## 2. Purchase Entry
                    2.1 **GST indicator** — Green "GST" badge for a GST-registered division (has a `gstin`);
                        amber "Non-GST" otherwise. Only shown in New mode.
                    2.2 **Header fields** — Supplier (required), Division (required, **disabled while
                        editing**), Invoice No (required), Invoice Date (required, defaults today), Remarks
                        (optional). Empty required fields block Save via `form.formState.isValid`.
                    2.3 **Duplicate invoice check** — Debounce is **≈600ms** — distinct from the 1600ms list
                        search debounce (don't confuse the two while timing this). Existing invoice_no shows a
                        red border + "Already exists" text and disables Save while checking / when found.
                    2.4 **IGST toggle** — Splits line tax between IGST vs CGST+SGST; totals stay consistent.
                        The IGST checkbox itself is **disabled when the division is non-GST**.
                    2.5 **Return toggle** — RTN badge shows in the list; the toggle is disabled when editing an
                        existing **non**-return invoice (can't flip a normal invoice into a return via edit).
                    2.6 **Under-warranty flag** — WRONG AS PREVIOUSLY WRITTEN: the flag persists to the DB but
                        **does not appear anywhere in View Details, PDF, or Excel** — no warranty column in any
                        of the three. It's only visible as an icon in the New/Edit line-item grid itself. Test
                        that it persists correctly across edits, but don't expect to see it downstream.
                    2.7 **Line pricing** — Per-line CGST/SGST/IGST/totals compute correctly client-side
                        (`calcLine`). Header aggregate/CGST/SGST/IGST/Total shown in the *list* come from a
                        server totals query, not a client recomputation — their correctness is a backend
                        concern.
                    2.8 **Master-data diff** — Modal correctly triggers only for GST-registered divisions when a
                        line's `_orig_hsn_code`/`_orig_cost_price`/`_orig_gst_rate` differs from the part master.
                        **There is no accept/ignore choice** — only **Proceed** (overwrites the master AND saves
                        the invoice) or **Cancel** (aborts the *entire* save, invoice included — you can't keep
                        the invoice while skipping the master update). **Known real bug to verify**: the modal's
                        diff-detection doesn't exclude Return or under-warranty lines, but the actual
                        master-update payload silently skips those lines even if you click Proceed — so the
                        modal can prompt you to update the master for a line whose master will not actually
                        change. Worth its own dedicated test.
                    2.9 **Physical invoice modal** — Not a file-attachment step: it's a **mandatory** manual
                        re-entry/cross-check of Qty/CGST/SGST/IGST/Total against computed values (tolerance ~2%
                        or ₹0.20 min for tax fields, ~0.2% for total), shown on every Save including edits.
                        **Fields do NOT round-trip** — the modal always resets to zero every time it opens, even
                        when editing a record that was saved with physical values before. You must re-key these
                        numbers from scratch on every single save.
                    2.10 **Save create** — Success toast (`SUCCESS_PURCHASE_CREATED`), form resets, stock
                        increases per part server-side.
                    2.11 **View Details dialog** — Header + all lines + tax breakup incl. computed-vs-physical
                        total and the difference.
                    2.12 **Show PDF** — Row menu label is **"Invoice PDF"**, not "Show PDF" — opens a PDF preview
                        (Billed-From/vendor, Billed-To/division, line table, totals).
                    2.13 **Download Excel (row)** — `.xlsx`, filename `purchase-invoice-{first-10-chars-of-
                        supplier-name-hyphenated}-{invoice_no}.xlsx`.
                    2.14 **Export list** — "Save as PDF"/"Export Excel" include company/branch/date-range header
                        + totals row; disabled when the list is empty.
                    2.15 **Edit** — Brand preselects; lines/toggles load; delete-then-recreate line strategy (see
                        B13); stock delta correctness is backend.
                    2.16 **Delete** — Confirm dialog: "This will permanently delete the invoice and all
                        associated stock transactions. This action cannot be undone."
                    2.17 **Posted invoice** — Posted/Not-Posted label is gated by the "post to accounts" setting,
                        but **Edit/Delete blocking on a posted row is unconditional** regardless of that setting
                        (see B14) — a row that got posted while the setting was on stays locked even after the
                        setting is turned off.
                    2.18 **Return stock effect** — Client sends `dr_cr: "C"` for a return line (vs "D" normally);
                        actual quantity math is server-side.

                **Additional Purchase-only behaviors not previously covered — worth their own test cases:**
                    2.19 **Division change wipes the form** — Changing Division in New mode resets vendor, all
                        lines, IGST, Return, and the physical-invoice values. Verify this is expected/acceptable,
                        not an accidental data-loss trap.
                    2.20 **"Was ₹X" price-changed indicator** — Selecting a part whose entered unit price differs
                        from the master cost shows an inline amber indicator — distinct from (and earlier than)
                        the master-diff modal in 2.8. Verify it shows/hides correctly as price is edited.
                    2.21 **Non-GST auto price gross-up** — In a non-GST division, selecting a part grosses up the
                        master cost by the part's (or a default) GST rate to derive the displayed unit price.
                        Verify the math against the part's actual GST rate.
                    2.22 **View-mode "All Divisions" filter** — In View mode, an "All Divisions" option shows
                        invoices across every division for the branch, with a per-row division-code badge.
                    2.23 **Save-flow modal sequencing** — Full sequence on a GST invoice with a master diff:
                        Save → validation → Physical Invoice modal → "Validate & Save" → Master-Diff modal
                        (reusing the already-entered physical values) → Proceed executes the real save.
                        Cancelling the Master-Diff modal at this point returns you to the plain form, and — per
                        2.9 — your physical-invoice numbers are gone (the modal resets next time). Verify you
                        don't lose an otherwise-valid save by cancelling at this step.

## 3. Sales Entry
                    3.1 **Customer select** — Existing customer auto-populates name/GSTIN/state/mobile/address;
                        empty walk-in name shows a red border and blocks Save.
                    3.2 **Auto IGST by state** — Customer state ≠ division GST state → IGST auto-on; same state
                        → CGST+SGST. The checkbox has no `disabled` attribute, so you *can* override it manually
                        — **but the auto-sync effect re-fires and silently overwrites your manual override**
                        whenever the customer or division changes again. Verify this doesn't surprise a tester
                        who toggles IGST manually mid-edit.
                    3.3 **GST vs normal invoice** — GST division shows tax columns (HSN/GST%/GST-price); non-GST
                        hides them entirely.
                    3.4 **GST price entry / back-calculation** — Editing the GST-inclusive price back-calculates
                        the base unit price on blur (only rendered in GST mode). Verify rounding to 2 decimals.
3.5 **Target Amount back-calc — CORRECTED, this does NOT mirror "Final a Job".** Sales
Entry's `computeBackCalcLines` is still the **old naive proportional-scale-and-dump
algorithm**: every line's price is multiplied by `target/current`, with **no floor at
cost price (or 0)**, and any small rounding residual (only if between ₹0.005–₹0.10) is
dumped entirely into the **last line**. This is a materially different, less safe
algorithm than Jobs' Final-a-Job `allocateFloored` (which iteratively pins lines at their
floor and redistributes the remainder). A low enough target here can drive a line's
selling price arbitrarily low, including toward ₹0, with no floor protection. Also test:
- Typing exactly **"0" as the target is ignored** — the Back Calculate button stays
    disabled for a zero target.
- If a target is typed but Back Calculate is never clicked, Save still adopts it directly
    into the header total as long as it's within ₹0.50 of the calculated line total;
    beyond that, a dialog titled "Amount Difference Too Large" blocks Save with the exact
    message: `Invoice total (₹X) differs from the calculated line total (₹Y) by ₹Z.
    Maximum allowed difference is ₹0.50. Please adjust the target amount or use Back
    Calculate.`
3.6 **Line totalling** — Footer sums Qty/Aggregate/tax/Total/Profit correctly, but **there is
    no combined "GST Amount" column** — CGST/SGST or IGST are only ever shown separately,
    never summed into one figure (correct the plan's earlier wording).
3.7 **Return toggle** — RTN badge; `dr_cr` is "D" for a return (inverse of Purchase's
    convention, where return is "C") — worth noting since the two screens' conventions
    differ.
3.8 **Save create** — Invoice number is server-generated, gated on a configured doc
    sequence; missing prefix shows `ERROR_DOC_SEQ_SINV_NOT_CONFIGURED` ("Sales Invoice
    document sequence is not configured or has no prefix...").
3.9 **Edit** — `originalLineIds` tracked and sent as `deletedIds` (delete-then-recreate, see
    B13); return flag preserved on edit-load.
3.10 **View / PDF / Excel** — All render Customer/GSTIN/State Code/Remarks + lines + tax
    breakup with a computed-vs-invoice difference.
3.11 **Delete** — Stock-restoration correctness is server-side; client just sends the delete.
3.12 **Negative stock sale — CORRECTED, there is no guard at all.** Grepped every Sales Entry
    file: no negative/insufficient-stock check exists anywhere client-side. A sale for more
    units than are on hand is **always silently allowed** and will drive stock negative with
    zero warning or block. Test this as a confirmed gap, not as "verify the guard behaves
    correctly" — there isn't one to verify (unless the backend independently enforces it,
    which wasn't visible from this client-side pass).
3.13 **Posted badge** — Same unconditional-lock pattern as Purchase (see B14/2.17).

**Additional Sales-only behaviors not previously covered — worth their own test cases:**
3.14 **Line-level Profit indicator** — `(unit_price − cost_price) × qty` shown per line and
    totalled in the footer, turning red when negative. Verify it updates live as price/qty
    change.
3.15 **Round-off button** — A dedicated icon next to Total rounds the invoice total to the
    nearest rupee and immediately re-runs back-calculation (§3.5) using that rounded figure
    as the new target. Verify it composes correctly with 3.5's known lack of a price floor.
3.16 **MRP-based price derivation on part select** — In GST mode, unit price is back-derived
    from a GST-inclusive MRP, falling back to selling_price then a markup; in non-GST mode it
    uses `part.mrp` directly, else grossed selling price, else markup. Verify each fallback
    tier with parts missing different combinations of MRP/selling_price.

## 4. Stock Adjustment
4.1 **Header** — Adjustment Date, Adjustment Reason required (zod messages exist but are
    **never rendered** — no `formState.errors` used anywhere in this screen); the only
    visible feedback for a missing field is an ad-hoc red border on Reason/Date and Save
    staying disabled. Don't expect a text error message to appear.
4.2 **Dr/Cr per line** — UI buttons are literally labeled **"IN"/"OUT"**; IN → `dr_cr: "D"` →
    looked up against transaction-type code `ADJUSTMENT_IN`; OUT → `dr_cr: "C"` →
    `ADJUSTMENT_OUT`. Confirmed exact code names.
4.3 **Save create** — Mixed IN/OUT lines save with correct type-id pairing sent to the
    backend; actual quantity change is server-side.
4.4 **Line validity** — The "each line needs a part and quantity > 0" toast
    (`ERROR_ADJUSTMENT_LINE_FIELDS_REQUIRED`) exists in code, but it's gated by the very same
    condition that disables the Save button — **in practice a mouse-click tester will never
    see this toast fire; Save just stays greyed out.** Test the disabled-button behavior, not
    the toast.
4.5 **Edit** — Delete-then-recreate line strategy (see B13); net-stock correctness is
    backend.
4.6 **Delete** — Confirm dialog: "This will permanently delete the adjustment and all
    associated stock transactions. This action cannot be undone."
4.7 **View / list / filters / pagination** — Per B8–B10 **only** — this screen has **no**
    View Details, PDF, Excel, or list-export (see B11's note). Row menu is Edit/Delete only.

## 5. Branch Transfer
5.1 **Header** — Transfer Date, Destination Branch required; Destination Branch's zod
    message is "Destination branch is required."
5.2 **Same-branch guard** — Implemented by **excluding the current branch from the
    destination dropdown's options entirely** — there's no post-selection error, the current
    branch is simply never offered as a choice. Functionally equivalent to "blocked" but
    don't expect a validation message if you're specifically probing for one.
5.3 **Dual stock effect** — Source line gets `dr_cr:"C"` against `BRANCH_TRANSFER_OUT`;
    destination gets `dr_cr:"D"` against `BRANCH_TRANSFER_IN`. Confirmed exact codes; verify
    stock on both branches (switch branch to confirm the destination side).
5.4 **Missing txn types** — If either type id is missing, Save shows a **hardcoded** (not
    `MESSAGES`-sourced) toast: exactly "Required stock transaction types
    (BRANCH_TRANSFER_IN/OUT) not found." — nothing is written.
5.5 **Save create / edit / delete** — Success/failure toasts present. Delete dialog is the
    **only one of the four screens whose wording uses "reverse"**: "This will permanently
    delete the transfer and reverse all associated stock transactions." Edit uses
    delete-then-recreate (see B13).
5.6 **List / filters / pagination** — Per B8–B10 **only** (no View/PDF/Excel/export, same as
    §4.7). List is correctly scoped to the current branch as the transfer's *source*.

## 6. Loan Entry
6.1 **Header** — Loan Date is required and its zod message (`ERROR_LOAN_DATE_REQUIRED` =
    "Loan date is required.") is correctly wired to the constant — **but it's never
    rendered, and unlike the other three screens, the Loan Date input doesn't even get a red
    border when empty.** A tester leaving it blank sees zero visible feedback — Save just
    stays disabled. Ref No/Remarks optional.
6.2 **Loan To** — Required per-line field, red-bordered when empty; persists across edit.
6.3 **Dr/Cr direction** — "IN" → `dr_cr:"D"` → `LOAN_IN` (loan returned, stock increases);
    "OUT" → `dr_cr:"C"` → `LOAN_OUT` (loan given out, stock decreases). Confirmed exact
    codes; stock math itself is backend.
6.4 **Save create / edit / delete** — Toasts present; delete dialog: "This will permanently
    delete the loan entry and all associated stock transactions." (does not say "reverse",
    unlike Branch Transfer).
6.5 **Line validity gate** — Confirmed exact string still in use:
    `ERROR_LOAN_LINE_FIELDS_REQUIRED` = "Each line needs a part, recipient (Loan To) and
    quantity > 0." Same caveat as §4.4 applies — this toast is gated behind the same
    condition that disables Save, so it won't fire from a normal click; you'll just see Save
    stay disabled.
6.6 **List / filters / pagination** — Per B8–B10 **only** (no View/PDF/Excel/export, same
    pattern as §4.7/§5.6).

## 7. Opening Stock
7.1 **Header** — Entry Date required (default today), Ref No/Remarks optional.
7.2 **Per-line unit cost** — qty + unit_cost per line; a computed "Total Value" column in the
    list confirms it feeds stock valuation.
7.3 **Direction** — Always an IN (`dr_cr: "D"` hardcoded for every line — confirmed). **The
    actual transaction-type code looked up is `"OPENING"`, not `"OPENING_STOCK"`** — this is
    a real naming detail: if your seed data (§0.1) uses `OPENING_STOCK` instead, this feature
    will silently fail to find the type and block every save (see 7.4). Correct any test data
    or documentation using the old name.
7.4 **Missing txn type** — Confirmed: blocks save with `ERROR_OPENING_STOCK_TXN_TYPE_MISSING`
    = "Opening Balance transaction type not found. Please check configuration." (note the
    message itself says "Opening Balance," reflecting the underlying `OPENING` code — not
    "Opening Stock").
7.5 **Save create / edit / delete** — Toasts present; edit uses delete-then-recreate (B13);
    stock & valuation math is backend.
7.6 **View / list / filters / pagination — this is the outlier of the six entry screens on
    multiple fronts:**
    - No View Details/PDF/Excel/export (same as §4.7/§5.6/§6.6) — Edit/Delete only.
    - **No date-range filter at all** — unlike Adjustment/Transfer/Loan, which all use
      `currentFinancialYearRange()`; Opening Stock's filter state is search + brand only.
    - **Different pagination UI** — plain text "Prev"/"Next" buttons instead of the
      First/Prev/Next/Last icon bar used elsewhere, and the pagination bar is **hidden
      entirely when there's only one page** (the other screens always render theirs).
7.7 **Duplicate opening stock** — No client-side duplicate-detection exists for entering
    opening stock against a part that already has a balance — it's silently allowed to add
    another opening-stock line. Whether the backend enforces any uniqueness independently
    wasn't visible from the client code; test whichever behavior actually occurs and record
    it.

## 8. Part Finder (read-only lookup)
8.1 **Focus & load** — On open, the search box auto-focuses; brands and this branch's active
    locations load in the background; a single brand auto-selects. Nothing is queried yet —
    the results area shows a "Start typing to search" prompt until a search term is entered.
8.2 **Search** — Debounced (≈1600ms) search by part code, name, description, category, or
    model; results populate once the debounce fires; clearing the search (✕) empties results
    and shows the pre-search prompt again.
8.3 **Stock filter** — Toggle "All" vs "In Stock"; In-Stock hides zero/negative-stock parts.
8.4 **View toggle** — Switch between Table and Card view (icons in the toolbar); both reflect
    the same result set, selection, and sort/filter state.
8.5 **Sorting (table view)** — Sort by Brand, Category, Model, Part Code, Part Name,
    Location, Qty (asc/desc), via clickable column headers with a sort-direction icon.
8.6 **Location column** — Shows primary location; a "+N" badge indicates additional
    locations (N = total locations − 1).
8.7 **Select part → detail panel** — Selecting a row opens a 3-tab detail panel:
    - **Overview** — stock-status badge (Out of Stock/Low Stock/In Stock) + qty, Part
      Identity (code, name, description, brand, category, model, UOM), Pricing & Tax (cost
      price, MRP, HSN, GST rate), and Storage (primary location, location count).
    - **Stock** — current stock + a "Set Location" button (opens the Set Part Location
      dialog); a since-last-snapshot movement summary (last snapshot date/balance, then
      Purchase In/Return, Sales Return/Out, Adjustment In/Out, and Net since snapshot — or
      "No snapshot yet" if none exists); and a stock-by-location table (or "No location data
      available").
    - **History** — a timeline of the part's location-change history (location, date, ref
      no, remarks per entry), or "No location history yet" when empty.
    Note: there is **no cross-branch stock view and no stock/movement chart** — the History
    tab is a location-change timeline, not a chart.
8.8 **Tab data loading** — Stock and History tab data lazy-load once per selected part (first
    visit to each tab); re-selecting the same part does not needlessly re-fetch. Saving a new
    location via "Set Location" refreshes the Stock tab's location table and the main list.
8.9 **Close** — The detail panel's Close (✕) clears the selection. There is no per-panel
    refresh control; the toolbar's "Refresh" button (visible once a search is active) reloads
    the main result list and locations, not the open panel's tabs directly.
8.10 **Branch switch** — Changing the current branch reloads brands, locations, and (if a
    search is active) the result list for the new branch. The detail panel does not
    auto-clear on branch change — verify it doesn't show stale data for a part from the
    previous branch until reselected.
8.11 **Empty states** — Verify the pre-search prompt ("Start typing to search…") and the
    no-results state ("No parts found — Try adjusting your filters or search term"). There is
    no required-brand guard on this screen — the brand filter defaults to "All Brands" and
    searching without picking one is allowed.

## 9. Set Part Location
9.1 **List load** — Shows in-stock parts for this branch with their current location
    (`GET_STOCK_BALANCE_WITH_LOCATION`, branch-scoped only). **There is no brand concept on
    this screen at all** — no brand selector, no brand-scoped location loading (correcting
    the earlier plan text). Active locations for the branch load via
    `GET_ACTIVE_LOCATIONS_BY_BRANCH` (despite the SQL name, it's called with only
    `branch_id`). The "no locations" state is confirmed: it disables both "Set Locations" and
    "Set Location for Selected" and shows the exact message "No active locations found for
    this branch. Add locations under Masters > Part Location before using this feature."
9.2 **Search** — Client-side filter on part code/name/current location.
9.3 **Row selection** — Individual checkboxes; header "select all" toggles/clears the
    visible/filtered set with correct indeterminate state; selected-count badge shown when
    >0.
9.4 **Single-part assign — CORRECTED, there is no per-row Set-Location button/dialog.** The
    table has no actions column at all. To assign a location to exactly one part, either (a)
    check that one row and use "Set Location for Selected (1)", or (b) use the separate
    generic "Set Locations" toolbar button, which is a manual part-code-entry form unrelated
    to table row selection. Update any test steps that assumed a per-row dialog.
9.5 **Bulk assign — global** — "Set Location for Selected" + choosing a global location
    applies it to every selected row; Save is blocked until **all** selected rows have a
    location (`allRowsHaveLocation` check).
9.6 **Bulk assign — per-row override** — Each row in the dialog has its own location select
    that can override the globally-applied choice.
9.7 **Save success/failure** — Success toast ("Part location(s) set successfully.") + list
    refresh; failure toast ("Failed to set part locations. Please try again."); no-partial-
    assignment beyond a single mutation call — backend-dependent for true atomicity.
9.8 **Selection reset** — Confirmed: selection clears both at the start of every `loadData()`
    call and explicitly again after a successful bulk save.
9.9 **Branch switch** — List reloads (stock + locations) for the new branch.

## 10. Stock Snapshot (Admin only)
10.1 **Access** — The menu entry is correctly hidden for non-admins. **However, gating is
    menu-only** — the page-content switch statement has no admin check of its own and would
    render the trigger for any `selected` value reaching it. Confirmed also: **generation is
    NOT branch-scoped at all** — the mutation sends only `{month, year}`, no `branch_id` —
    unlike every other inventory screen. Don't run this one "per branch" per the Legend's
    general instruction; it's a single global operation per period.
10.2 **Month/Year picker** — Year decrement/increment (min year 2020, can't exceed current
    year); future and current month are disabled directly in the picker (can't even be
    clicked). The warning text "Snapshots can only be generated up to last month." exists but
    is effectively unreachable through normal navigation, since the UI prevents selecting a
    disabled month in the first place and auto-clamps the month when the year advances —
    don't be surprised if you can't get this message to actually appear via clicking.
10.3 **Generate** — Confirmation dialog exact wording: "Regenerate the stock snapshot for
    {Month} {Year}? This will overwrite any existing snapshot for this period."
10.4 **Confirm** — Success toast "Stock snapshot generated successfully."; button text
    becomes "Generating…" and disables during the run.
10.5 **Cancel** — Cancelling aborts with no state change.
10.6 **Overwrite** — Regenerate for a period that already has a snapshot; verify it
    overwrites and reflects current (including back-dated) transactions — this math is
    entirely server-side SQL, not visible from the client.
10.7 **Failure** — Simulated server error → "Failed to generate stock snapshot. Please try
    again."; whether a partial snapshot could be left behind on failure is a backend
    transaction question.
10.8 **Back-dated correctness** — Enter a back-dated transaction, regenerate the affected
    month, confirm the snapshot's closing stock updates — backend-dependent, verify by
    observed result.

---

## Regression touchpoints (run after any Inventory change)
R1. Every stock-moving screen (Purchase, Sales, Adjustment, Transfer, Loan, Opening) →
    confirm Stock Overview and Part Finder reflect the movement immediately after
    save/edit/delete.
R2. GST maths consistency across Purchase and Sales in GST vs non-GST divisions and IGST vs
    CGST/SGST. Remember Sales Entry's Back Calculate (§3.5) has no price floor, unlike Jobs'
    Final-a-Job — don't assume parity between the two features when regression-testing GST
    math edge cases.
R3. Accounts-posting badges (Posted/Not-Posted) update after posting runs; posted-record
    edit/delete rules hold **unconditionally** on Purchase/Sales regardless of whether
    posting is currently enabled (§B14/§2.17).
R4. Snapshot values remain consistent after back-dated edits + regeneration. Remember
    Snapshot is global, not per-branch (§10.1).

## Verification / sign-off
- Execute every TC on Chrome + one other browser, in both light/dark themes.
- Record pass/fail with screenshots for each failed TC.
- For any TC marked "CAN'T VERIFY" or backend-dependent above, record the **observed**
  behavior during manual testing — that becomes the new source of truth for a future
  plan update.
- Re-run Section R after fixes.
