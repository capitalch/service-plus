# Plan - Add Part MRP vs Cost Price Validation

This plan outlines the steps to implement a validation rule where MRP must be greater than Cost Price, while allowing both to be 0.

## Workflow
1.  Analyze the existing `zod` validation schema in `AddPartDialog`.
2.  Modify the `superRefine` block to include the exception for 0 values.
3.  Test the validation in the UI with various price combinations.

## Execution Steps

### Step 1: Locate the Components
The validation schema needs to be updated in both:
1.  `service-plus-client/src/features/client/components/add-part-dialog.tsx`
2.  `service-plus-client/src/features/client/components/edit-part-dialog.tsx`

### Step 2: Update the Validation Schemas
Modify the `superRefine` logic for the `schema` object in both files.

**Current Logic:**
```typescript
.superRefine((data, ctx) => {
    if (data.mrp != null && data.cost_price != null && data.mrp <= data.cost_price) {
        ctx.addIssue({ code: "custom", message: "MRP must be greater than cost price", path: ["mrp"] });
    }
});
```

**New Logic (Same for both files):**
The condition for error should exclude the case where both values are 0.
```typescript
.superRefine((data, ctx) => {
    const mrp = data.mrp ?? 0;
    const cost = data.cost_price ?? 0;
    
    // Trigger error if MRP is not > Cost, UNLESS both are 0
    if (mrp <= cost && (mrp !== 0 || cost !== 0)) {
        ctx.addIssue({ 
            code: "custom", 
            message: "MRP must be greater than cost price", 
            path: ["mrp"] 
        });
    }
});
```