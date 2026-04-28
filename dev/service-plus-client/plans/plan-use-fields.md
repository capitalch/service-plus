# Plan: Add useFieldArray to Dynamic Row Forms (Step-by-Step)

## Objective

Migrate **8 data entry forms** from manual `useState` array management to **react-hook-form's `useFieldArray`** for proper form state management, validation, and maintainability.

Each step covers the complete migration of one form from schemas → section → child form.

---

## Implementation Order

| Step | Form | Complexity |
|------|------|------------|
| Step 1 | Batch Job | High (cards UI, file uploads, warranty logic) |
| Step 2 | Opening Stock | Low (table, simple totals) |
| Step 3 | Branch Transfer | Low (grid, simple) |
| Step 4 | Part Used | Medium (dual tables, existing + new) |
| Step 5 | Sales Invoice | Medium (totals with useEffect) |
| Step 6 | Purchase Invoice | High (2 modals, complex state) |
| Step 7 | Stock Adjustment | Medium (table, IN/OUT logic) |
| Step 8 | Loan Entry | Medium (table, loan type logic) |

---

## Current State Reference

| Form | Current State Management |
|------|--------------------------|
| Batch Job | useState via props |
| Part Used | Multiple useState arrays |
| Sales Invoice | useState via props |
| Purchase Invoice | useState local |
| Branch Transfer | useState via props |
| Opening Stock | useState via props |
| Stock Adjustment | useState via props |
| Loan Entry | useState via props |

---

## Reference Implementation

**Existing example using `useFieldArray`:**
- `src/features/client/components/configurations/document-sequence/document-sequence-section.tsx`

```tsx
const form = useForm<SequencesFormType>({
    defaultValues: { sequences: [] },
    mode: "onChange",
    resolver: zodResolver(sequencesFormSchema),
});

const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sequences",
});

<Input {...register(`sequences.${index}.fieldName`)} />
```

---

# STEP 1: Batch Job ✅ DONE

**Forms:** `batch-job/batch-job-schema.ts`, `batch-job/batch-job-section.tsx`, `batch-job/new-batch-job-form.tsx`

### 1.1 Schema Changes

**File:** `src/features/client/components/jobs/batch-job/batch-job-schema.ts`

Add array field to the root schema:

```ts
// Add to batchJobFormSchema (around existing fields)
rows: z.array(batchJobRowSchema).min(1, "At least one job is required"),
```

Update any type exports if needed to include the array type.

### 1.2 Section Component Changes

**File:** `src/features/client/components/jobs/batch-job/batch-job-section.tsx`

- Import `useFieldArray`, `zodResolver` and schema
- Replace `useState` for rows with `useForm` + `useFieldArray`
- Keep `useState` for file uploads only (`pendingFiles`)
- Replace `addRow()` / `removeRow()` / `updateRow()` calls with `append()`, `remove()`, `setValue()`

```tsx
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray } from "react-hook-form";
import { batchJobFormSchema, BatchJobFormType } from "./batch-job-schema";

const form = useForm<BatchJobFormType>({
    resolver: zodResolver(batchJobFormSchema),
    defaultValues: {
        rows: [initialBatchJobRow], // Start with 1 row
    },
});

const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rows",
});

// Pass to child via context or props
<NewBatchJobForm form={form} />
```

### 1.3 Child Form Component Changes

**File:** `src/features/client/components/jobs/batch-job/new-batch-job-form.tsx`

- Use `useFormContext` or accept `form` prop
- Remove `useState` for rows
- Replace `updateRow()` with `setValue()` from react-hook-form
- Use `register()` for fields

```tsx
const { control, register, setValue, getValues } = useFormContext<BatchJobFormType>();
const { fields, append, remove } = useFieldArray({ control, name: "rows" });

// Add row
const handleAddRow = () => {
    append(blankBatchJob(docSequence, seqOffset + 1));
};

// Remove row
const handleRemoveRow = (index: number) => {
    if (fields.length > 1) remove(index);
};

// Field binding
<input {...register(`rows.${index}.product_brand_model_id`)} />
```

### 1.4 Computed/Manual Logic Adaptations

- **Warranty logic:** Keep but use `watch()` to observe job_type changes
- **File uploads:** Keep separate `useState` for `pendingFiles` (not in form state)
- **Job number auto-generation:** Use `useEffect` on rows change to update sequence offset

### 1.5 Validation

Replace manual validation:

```ts
// OLD: const isValid = rows.every(r => r.quantity > 0 && r.product_brand_model_id);
```

With:

```ts
// NEW: Trigger schema validation
const isValid = await form.trigger("rows");
```

---

# STEP 2: Opening Stock ✅ DONE

**Forms:** `opening-stock/opening-stock-schema.ts`, `opening-stock/opening-stock-section.tsx`, `opening-stock/new-opening-stock.tsx`

### 2.1 Schema Changes

**File:** `src/features/client/components/inventory/opening-stock/opening-stock-schema.ts`

Add array field:

```ts
lines: z.array(openingStockLineSchema).min(1, "At least one item required"),
```

### 2.2 Section Component Changes

**File:** `src/features/client/components/inventory/opening-stock/opening-stock-section.tsx`

Same pattern as Batch Job:
- Import useForm, useFieldArray, zodResolver, schema
- Replace useState for lines with useFieldArray
- Pass form via context

### 2.3 Child Form Component Changes

**File:** `src/features/client/components/inventory/opening-stock/new-opening-stock.tsx`

- Remove useState for lines
- Use useFormContext + useFieldArray
- Replace insertLine/removeLine/updateLine with append/remove/setValue

### 2.4 Totals Calculation

Keep existing totals logic:
- Lines count
- Total quantity (3 decimals)
- Total value (qty × unit_cost)

Can use `watch("lines")` + useEffect to recalculate.

---

# STEP 3: Branch Transfer ✅ DONE

**Forms:** `branch-transfer/branch-transfer-schema.ts`, `branch-transfer/branch-transfer-section.tsx`, `branch-transfer/new-branch-transfer.tsx`

### 3.1 Schema Changes

**File:** `src/features/client/components/inventory/branch-transfer/branch-transfer-schema.ts`

Add:

```ts
lines: z.array(transferLineSchema).min(1, "At least one item required"),
```

### 3.2 Section Component Changes

**File:** `src/features/client/components/inventory/branch-transfer/branch-transfer-section.tsx`

- Import useForm, useFieldArray, zodResolver, schema
- Replace useState for lines with useFieldArray

### 3.3 Child Form Component Changes

**File:** `src/features/client/components/inventory/branch-transfer/new-branch-transfer.tsx`

- Remove useState for lines
- Use useFormContext + useFieldArray
- Replace insertLine/removeLine/updateLine

### 3.4 Business Logic

- Destination filter: Keep (still valid with array)
- Summary: Keep (lines count, total qty)

---

# STEP 4: Part Used ✅ Done

**Forms:** `part-used/part-used-schema.ts`, `part-used/part-used-section.tsx`, `part-used/new-part-used-form.tsx`

### 4.1 Schema Changes

**File:** `src/features/client/components/jobs/part-used/part-used-schema.ts`

This is unique - has two arrays:

```ts
newLines: z.array(newPartUsedLineSchema),
deletedIds: z.array(z.number()),
existingLines: z.array(existingPartUsedLineSchema).optional(),
```

### 4.2 Section Component Changes

**File:** `src/features/client/components/jobs/part-used/part-used-section.tsx`

- Import useForm, useFieldArray, zodResolver
- Replace useState for newLines and deletedIds with useFieldArray
- Keep existingLines as read-only (view mode)

### 4.3 Child Form Component Changes

**File:** `src/features/client/components/jobs/part-used/new-part-used-form.tsx`

**Existing parts (read-only table):**
- Keep display as-is (they're already saved)
- Add delete button that adds to `deletedIds` array

**New parts (editable table):**
- Remove useState for `newLines`
- Use useFieldArray for `newLines`
- Replace insertNewLine/removeNewLine/updateNewLine

```tsx
const { fields: newLineFields, append: appendNewLine, remove: removeNewLine } = 
    useFieldArray({ control, name: "newLines" });
```

### 4.4 Validation

- Combine validation: `newLines.some(l => l.part_id && l.quantity > 0) || deletedIds.length > 0`
- Use form.trigger() for combined check

---

# STEP 5: Sales Invoice ✅ Done

**Forms:** `sales-entry/sales-invoice-schema.ts`, `sales-entry/sales-entry-section.tsx`, `sales-entry/new-sales-invoice.tsx`

### 5.1 Schema Changes

**File:** `src/features/client/components/inventory/sales-entry/sales-invoice-schema.ts`

Add:

```ts
lines: z.array(salesLineSchema).min(1, "At least one line item required"),
```

### 5.2 Section Component Changes

**File:** `src/features/client/components/inventory/sales-entry/sales-entry-section.tsx`

- Import useForm, useFieldArray, zodResolver
- Replace useState for lines

### 5.3 Child Form Component Changes

**File:** `src/features/client/components/inventory/sales-entry/new-sales-invoice.tsx`

- Remove useState for lines
- Use useFieldArray
- Replace insertLine/removeLine/updateLine

### 5.4 Computed Totals with useEffect

**Critical:** The existing `calcLine()` logic that recalculates amounts needs to work with react-hook-form.

```tsx
const { watch, setValue } = useFormContext();
const lines = watch("lines");

useEffect(() => {
    if (!lines) return;
    
    const recomputed = lines.map(line => {
        if (!line.part_id) return line;
        return calcLine(line, isIgst);
    });
    
    // Update with computed values
    recomputed.forEach((line, idx) => {
        setValue(`lines.${idx}`, line);
    });
}, [lines, isIgst]);
```

Alternatively, calculate parent-level totals separately and don't store computed fields in the array.

### 5.5 Summary Bar

Watch changes and recalculate in useEffect:
- Lines count
- Total quantity
- Subtotal
- Tax
- Grand total

---

# STEP 6: Purchase Invoice ✅ Done

**Forms:** `purchase-entry/purchase-invoice-schema.ts`, `purchase-entry/purchase-entry-section.tsx`, `purchase-entry/new-purchase-invoice.tsx`

### 6.1 Schema Changes

**File:** `src/features/client/components/inventory/purchase-entry/purchase-invoice-schema.ts`

Add:

```ts
lines: z.array(purchaseLineSchema).min(1, "At least one line item required"),
```

### 6.2 Section Component Changes

**File:** `src/features/client/components/inventory/purchase-entry/purchase-entry-section.tsx`

- Import useForm, useFieldArray, zodResolver
- Replace useState for lines

### 6.3 Child Form Component Changes

**File:** `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`

- Remove useState for lines
- Use useFieldArray
- Replace insertLine/removeLine/updateLine

### 6.4 Computed Totals with useEffect

Same pattern as Sales Invoice, plus handle:

```tsx
// Watch for isIgst changes - recalculate all GST rates
const isIgst = watch("isIgst");
useEffect(() => {
    const updated = lines.map(line => ({
        ...line,
        ...(isIgst 
            ? { igst_rate: line.gst_rate, cgst_rate: 0, sgst_rate: 0 }
            : { igst_rate: 0, cgst_rate: line.gst_rate / 2, sgst_rate: line.gst_rate / 2 }
        )
    }));
    // Apply updates...
}, [isIgst]);
```

### 6.5 Modals Integration

The PhysicalInvoiceModal and MasterDataDiffModal need access to form values:

```tsx
const values = form.getValues();
const computedTotals = calculateTotals(values.lines);

// Pass to modal props
<PhysicalInvoiceModal computedTotals={computedTotals} onConfirm={...} />
```

### 6.6 Under Warranty Toggle

Keep logic but use:
```tsx
const currentValue = getValues(`lines.${index}.under_warranty`);
setValue(`lines.${index}.unit_price`, newValue ? 0 : currentValue);
```

---

# STEP 7: Stock Adjustment ✅ Done

**Forms:** `stock-adjustment/stock-adjustment-schema.ts`, `stock-adjustment/stock-adjustment-section.tsx`, `stock-adjustment/new-stock-adjustment.tsx`

### 7.1 Schema Changes

**File:** `src/features/client/components/inventory/stock-adjustment/stock-adjustment-schema.ts`

Add:

```ts
lines: z.array(stockAdjustmentLineSchema).min(1, "At least one item required"),
```

### 7.2 Section Component Changes

**File:** `src/features/client/components/inventory/stock-adjustment/stock-adjustment-section.tsx`

- Import useForm, useFieldArray, zodResolver
- Replace useState for lines with useFieldArray
- Keep useState for file uploads only (if any)

### 7.3 Child Form Component Changes

**File:** `src/features/client/components/inventory/stock-adjustment/new-stock-adjustment.tsx`

- Remove useState for lines
- Use useFieldArray
- Replace updateLine/insertLine/removeLine with append/remove/setValue
- For PartCodeInput - need a ref array workaround since we can't use useRef for dynamic fields directly

### 7.4 IN/OUT Logic

Keep but use watch() for dr_cr field:

```tsx
const lines = watch("lines");
// Calculate totals
const inTotal = lines?.filter(l => l.dr_cr === "D").reduce((s, l) => s + l.qty, 0) ?? 0;
const outTotal = lines?.filter(l => l.dr_cr === "C").reduce((s, l) => s + l.qty, 0) ?? 0;
```

### 7.5 PartCodeInput Issue

The `PartCodeInput` can't use standard `register()`. Keep current onChange pattern but use `setValue()`:

```tsx
onSelect={(part) => {
    setValue(`lines.${index}.part_id`, part.id);
    setValue(`lines.${index}.part_code`, part.part_code);
    // etc...
}}
```

---

# STEP 8: Loan Entry ✅ DONE

**Forms:** `loan-entry/loan-entry-schema.ts`, `loan-entry/loan-entry-section.tsx`, `loan-entry/new-loan-entry.tsx`

### 8.1 Schema Changes

**File:** `src/features/client/components/inventory/loan-entry/loan-entry-schema.ts`

Add:

```ts
lines: z.array(loanLineSchema).min(1, "At least one item required"),
```

### 8.2 Section Component Changes

**File:** `src/features/client/components/inventory/loan-entry/loan-entry-section.tsx`

- Import useForm, useFieldArray, zodResolver
- Replace useState for lines

### 8.3 Child Form Component Changes

**File:** `src/features/client/components/inventory/loan-entry/new-loan-entry.tsx`

- Remove useState for lines
- Use useFieldArray
- Replace updateLine/insertLine/removeLine

### 8.4 Loan Type Logic

Keep existing loan type (D/C) logic - use watch() to detect changes.

---

## Common Patterns Summary

### Before → After Mapping

| Old Pattern | New Pattern |
|-------------|-------------|
| `useState` for array | `useFieldArray` from react-hook-form |
| `addRow()` | `append(blankRow())` |
| `removeRow(id)` | `remove(index)` |
| `updateRow(id, patch)` | `setValue(\`lines.${index}.field\`, value)` |
| `<input value={x} onChange={...} />` | `<input {...register(\`lines.${index}.field\`)} />` |
| Manual validation | `form.trigger("lines")` |
| `useState` for computed | `watch("field")` + `useEffect` |

### What NOT to Change

- File uploads (keep in separate useState)
- API calls (GraphQL mutations)
- Business logic (warranty, IGST, etc.)
- UI layout/structure
- Non-form local state

---

## Testing Checklist (Apply to Each Step)

- [ ] Form submits with valid data
- [ ] Form shows validation errors with invalid data  
- [ ] Empty form shows "at least one line required"
- [ ] Add row creates new empty row
- [ ] Remove row removes the row
- [ ] Cannot remove last row (minimum enforced)
- [ ] Field values persist correctly
- [ ] Computed totals update on field changes
- [ ] Form reset clears all rows
- [ ] Business logic (warranty,IGST,gst recalc) works