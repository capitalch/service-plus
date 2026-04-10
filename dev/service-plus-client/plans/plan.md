# Plan: Move `loan_to` from header to line items

## Summary
`loan_to` is being moved from the `stock_loan` (header) table to the `stock_loan_line` (lines) table.
Every line item will now carry its own recipient/technician field.

## Files to Change

### 1. `src/features/client/types/stock-loan.ts`
- Remove `loan_to: string` from `StockLoanType`
- Add `loan_to: string` to `StockLoanLineType`
- Add `loan_to: string` to `LoanLineFormItem`
- Add `loan_to: ""` to `emptyLoanLine` factory

### 2. `src/features/client/components/inventory/loan-entry/new-loan-entry.tsx`
- Remove header `loanTo` state and its setter
- Remove "Loan To / Technician" `<Input>` from the header card (shrinks header grid)
- Add a **"Loan To"** column to the lines table (after Part, before IN/OUT)
- Update `isFormValid`: drop `!!loanTo.trim()`, add `!!l.loan_to.trim()` per line
- Update `handleReset`: remove `setLoanTo("")`
- Update `handleSubmit`: remove dedicated `loanTo` toast check; fold into existing line-fields guard
- Update `executeSave - linePayload`: add `loan_to: line.loan_to.trim()` per line
- Update `headerFields`: remove `loan_to`
- Update edit-load `useEffect`: remove `setLoanTo(...)`, map `loan_to: l.loan_to` into loadedLines

### 3. `src/constants/messages.ts`
- Remove `ERROR_LOAN_TO_REQUIRED` (no longer a standalone header validation)
- Update `ERROR_LOAN_LINE_FIELDS_REQUIRED` to mention loan_to: `'Each line needs a part, recipient (Loan To) and quantity > 0.'`
