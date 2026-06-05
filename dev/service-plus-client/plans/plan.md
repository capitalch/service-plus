# Plan: Warranty Jobs — Allow Parts & Charges Entry (Cost Only)

## Context

Currently warranty jobs lock all parts/charges inputs as read-only. The requirement is to allow recording cost prices of parts and additional charges for warranty jobs, while keeping selling prices at zero and the final invoice amount at zero.

---

## Rules for Warranty Jobs

- Parts and additional charges **can be added/edited/deleted**.
- Only **cost price** and **qty** are editable; selling price is always 0.
- GST fields (rate, HSN, IGST/CGST/SGST) are hidden — no tax applies.
- **Final amount saved to `job.amount` is always 0**.
- Selling price written to `job_part_used.selling_price` and `job_additional_charge.selling_price` is always 0.

---

## Changes

### `final-job-form.tsx`

1. **Warranty banner** — change text to "Warranty job — only cost prices are recorded; selling prices and final amount are ₹0."

2. **Parts Used section**
   - Remove `!isWarranty` guard on "Add Part" empty-state button.
   - Brand `<Select>` and `<PartCodeInput>`: always rendered (remove `isWarranty ? text : input` ternaries).
   - Part name, remarks inputs: remove `disabled={isWarranty}`.
   - HSN field: condition `isGst && !isWarranty`.
   - Profit, GST%, Sale, +GST fields: hidden for warranty.
   - Qty, Cost inputs: remove `disabled={isWarranty}`.
   - Amt display: for warranty show `cost_price * qty`.
   - Add/Remove buttons: always shown.
   - Parts footer: for warranty show cost total.

3. **Additional Charges section**
   - Remove `!isWarranty` guard on "Add Charge" empty-state button.
   - Sale, HSN, GST%, Sale+GST columns: hidden for warranty.
   - All `disabled={isWarranty}` removed from inputs.
   - Amount cell: for warranty show `cost_price * qty`.
   - Actions column: always shown.
   - Charges footer: for warranty show cost total.

4. **Grand Summary**
   - For warranty: show Parts Cost + Charges Cost totals; replace back-calc with "Final Amount ₹0.00".

### `final-a-job-section.tsx`

In `handleSaveFinal` and `handleSaveEdit`:
- `amount = isWarrantyJob ? 0 : (backCalc or computed)`
- Parts `selling_price`, `gst_rate` → 0; `hsn_code` → null when warranty
- Charges `selling_price`, `gst_rate` → 0; `hsn_code` → null when warranty
