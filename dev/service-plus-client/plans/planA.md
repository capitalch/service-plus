# Implementation Plan - Loan Entry Module

Implement the Loan Entry inventory module for tracking part loans to technicians or external agencies. This module will follow the mode-based UI pattern (New/View) established by Stock Adjustment.

## Workflow

1. **Backend SQL**: Define queries in `SqlStore` for counting, paging, and detail retrieval.
2. **Client Types**: Define TypeScript interfaces for loan entities and form items.
3. **Constants**: Register SQL keys in `SQL_MAP` and add loan-specific messages to `MESSAGES`.
4. **UI Components**:
    - Build `NewLoanEntry`: Form for recording loan_in (Debit) or loan_out (Credit).
    - Build `LoanEntrySection`: Main container with view/new mode management, filtering, and paging.
5. **Integration**: Register the section in `ClientInventoryPage` and ensure sidebar navigation is active.

## Execution Steps

### Step 1: Backend SQL Queries
Add the following to `service-plus-server/app/db/sql_store.py`:
- `GET_STOCK_LOANS_COUNT`: Count filtered loans.
- `GET_STOCK_LOANS_PAGED`: Paged list of loans with summary fields.
- `GET_STOCK_LOAN_DETAIL`: Single loan with all line items and part details.

### Step 2: Client Types & Constants
- Create `src/features/client/types/stock-loan.ts` with `StockLoanType`, `StockLoanLineType`, and `LoanLineFormItem`.
- Update `src/constants/sql-map.ts` with:
    - `GET_STOCK_LOANS_COUNT`
    - `GET_STOCK_LOANS_PAGED`
    - `GET_STOCK_LOAN_DETAIL`
- Update `src/constants/messages.ts` with loan-related success/error strings.

### Step 3: UI Implementation
- **NewLoanEntry**:
    - Header: Date, Loan To (Text), Ref No, Remarks.
    - Lines: Part Selection, Type (In/Out), Qty, Line Remarks.
    - Mutation: Use `genericUpdate` to create `stock_loan`, `stock_loan_line`, and associated `stock_transaction` entries (LOAN_IN/LOAN_OUT).
- **LoanEntrySection**:
    - Filter toolbar (Date range, Search by Loan To/Ref No).
    - Grid view with pagination.
    - Mode toggle (New/View).

### Step 4: Routing & Navigation
- Update `src/features/client/pages/client-inventory-page.tsx` to handle the "Loan Entry" case.
- Verify "Loan Entry" exists in `ClientExplorerPanel` (already present).
