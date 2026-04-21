# Implementation Plan: Recreate Stock Ledger and Balance Data

## Objective
To develop and execute a server-side script that reconciles the `stock_transaction` ledger and `stock_balance` snapshots by re-processing all documented inventory movements (Purchase, Sales, Loans, Transfers, etc.).

## Workflow
1.  **Identification**: Enumerate all active Business Units (schemas) in the `service_plus_service` database.
2.  **Clean Slate**: Truncate `stock_transaction` and `stock_balance` tables within each target schema.
3.  **Source Aggregation**: Iterate through all inventory-impacting tables:
    *   `stock_opening_balance_line` (Opening stocks)
    *   `purchase_invoice_line` (Stock In)
    *   `sales_invoice_line` (Stock Out)
    *   `stock_adjustment_line` (Increase/Decrease)
    *   `stock_loan_line` (Borrowed In / Lent Out)
    *   `stock_branch_transfer_line` (Inter-branch movement)
    *   `job_part_used` (Consumption for repairs)
4.  **Transaction Reconstruction**: Insert reconstructed records into `stock_transaction`.
5.  **Balance Reconciliation**: The database triggers (`trg_stock_balance_insert`) will automatically update `stock_balance` during the insertion process.

## Steps

### Step 1: Create Re-processing Script
Create a Python utility script `scripts/recreate_stock.py` in the server project. This script will:
- Connect to the PostgreSQL database.
- Resolve any missing system-defined `stock_transaction_type` entries.
- Support running for a single specific BU or all BUs.

### Step 2: Implement Logic for Each Transaction Type
- **Opening Balances**: Direct mapping from `stock_opening_balance_line` (code: 'OPENING').
- **Purchases**: Map `purchase_invoice_line` (dr_cr: 'D', code: 'PURCHASE') with reference to invoice date.
- **Sales**: Map `sales_invoice_line` (dr_cr: 'C', code: 'SALES').
- **Adjustments**: Map `dr_cr` as documented in `stock_adjustment_line` (code: 'ADJUST').
- **Loans**: 
    - If `dr_cr` is 'D', it's a Borrow In (code: 'LOAN').
    - If `dr_cr` is 'C', it's a Lend Out (code: 'LOAN').
- **Branch Transfers**: 
    - Create a 'C' (OUT) transaction for the Source Branch (code: 'TRANSFER').
    - Create a 'D' (IN) transaction for the Destination Branch (code: 'TRANSFER').
- **Job Parts**: Map consumption from repairs where stock was utilized (code: 'JOB_CONSUME').

### Step 3: Validation and Finalization
- Log the number of records processed per BU.
- Verify consistency between `stock_transaction` totals and final `stock_balance` values.
- (Optional) Regenerate `stock_snapshot` if required.

## Proposed SQL Logic for Reconstruction (Python-assisted)
The script will use batch inserts for performance while ensuring the `search_path` is correctly set per BU.
