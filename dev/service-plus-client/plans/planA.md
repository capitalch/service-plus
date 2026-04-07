# Implementation Plan - Reorganize Purchase Invoice PDF

Reorganize `purchase-invoice-pdf-gen.ts` to improve the invoice layout, readability, and overall professional appearance.

## Workflow
1.  Define a new layout structure for the PDF (Header, Party Details, Meta Info, Table, Totals, Footer).
2.  Refactor the code into logical sections/helper functions within the generator to improve maintainability.
3.  Implement visual enhancements: better typography, spacing, and clear section dividers.
4.  Standardize labels (e.g., using "Billed From" and "Billed To").

## Step 1: Structural Refactoring
- Break down the massive `generatePurchaseInvoicePdf` function into smaller, logical blocks of code or local helper functions.
- Sections to isolate: `drawHeader`, `drawPartySection`, `drawInvoiceMeta`, `drawFooter`.

## Step 2: Header and Meta Information
- Centered **TAX INVOICE** title with increased vertical rhythm.
- Group Invoice Number, Date, and State Code into a clean metadata block, possibly right-aligned or in a specific grid.
- Ensure company/branch name is prominent.

## Step 3: Party Details (Billed From / Billed To)
- Clear two-column layout for **Billed From** (Supplier) and **Billed To** (Branch).
- Include Address, Phone, and GSTIN in a standardized vertical list for both parties.
- Use subtle vertical lines or boxes to separate these areas.

## Step 4: Line Items Table
- Enhance `jspdf-autotable` configuration:
    - Darker header background with white text for a premium look.
    - Precise column widths for Part Code, Name, HSN, Tax columns.
    - Right-align numeric values (Qty, Price, Tax, Total).
    - Add a "Sub-total" or "Total" row at the bottom of the table itself.

## Step 5: Totals and Summary Section
- Create a distinct footer totals area:
    - **Aggregate Amount**
    - **Tax Amount (Total)**
    - **computed Amount**
    - **Difference / Round-off** (only if non-zero, or styled as adjustment)
    - **Invoice amount** (Grand Total) - highlight with bold/larger font.
- Add a text-based "Total Amount in Words" if feasible (optional polish).

## Step 6: Footer and Remarks
- Ensure Remarks are clearly separated from the totals.
- Standardized signatory area with enough space for a physical stamp/sign.
- "Computer generated" disclaimer at the very bottom.
