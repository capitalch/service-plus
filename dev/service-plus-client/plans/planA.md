# Implementation Plan - PDF Preview & Printing for Purchase Invoices (jsPDF + autoTable)

## Objective
Enable a high-quality PDF preview and download/printing capability for Purchase Invoices using **`jsPDF`** and its **`jspdf-autotable`** plugin.

## Workflow section
- **Decision on PDF Technology**: We will use **`jsPDF`** for document generation and **`jspdf-autotable`** for rendering line items in a structured, multi-page format. 
- **Architecture**: A new utility function `generatePurchaseInvoicePdf` will be created to construct the PDF document (Header with company/supplier info, Table with line items, Footer with totals).
- **Integration**: We will replace the "Coming Soon" toast with a `PurchaseInvoicePdfPreviewDialog` that generates the PDF and renders it in a live preview frame.

---

## Steps of Execution

### Step 1: Install `jsPDF` and `jspdf-autotable`
Add the required libraries to the project.
```bash
pnpm add jspdf jspdf-autotable
```

### Step 2: Create PDF Generation Utility
Develop a new utility in `src/features/client/components/inventory/purchase-entry/purchase-invoice-pdf-gen.ts`:
- Accepts the `invoice` and `lines` data.
- Configures `jsPDF` for A4 layout.
- Uses `doc.autoTable()` to render line items with specific column widths and headers (Part Code, Name, HSN, Qty, Unit Price, Tax breakdown, Total).
- Implements custom drawing for the header and footer (Company name, Supplier info, Total words, Signatory block).

### Step 3: Create `PurchaseInvoicePdfPreviewDialog`
Create a new dialog component `src/features/client/components/inventory/purchase-entry/purchase-invoice-pdf-preview-dialog.tsx`:
- Triggers the utility to generate a PDF `Blob` or `DataURI`.
- Uses an `<iframe>` or `<object>` to display the PDF inside a large modal for live preview.
- Provides a "Download" and "Print" action.

### Step 4: Integrate with `PurchaseEntrySection`
Update the `DropdownMenu` in `purchase-entry-section.tsx`:
- Add a new state variable `pdfPreviewInvoice` to track which invoice is being previewed as PDF.
- Update the "Show PDF" menu item to open the new `PurchaseInvoicePdfPreviewDialog`.

### Step 5: Integrate with `ViewPurchaseInvoiceDialog`
Update the existing view dialog:
- Update the "Show PDF" button to trigger the same `PurchaseInvoicePdfPreviewDialog` (passing the current `detail` row).

### Step 6: Testing & Polish
- Ensure correct rendering of GST columns and multi-page tables.
- Verify Indian Rupee (₹) symbol rendering (might require embedding a custom font).
- Review overall layout quality and alignment.
