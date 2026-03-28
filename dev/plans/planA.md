# Plan: Inventory > Stock Review (Overview)

## 1. Purpose of Stock Review
In your database schema, inventory is tracked via a double-entry ledger in the `stock_transaction` table (`D` for Inwards/Debit, `C` for Outwards/Credit). 
The **Stock Review** (or *Stock Overview*) screen is a real-time snapshot of the current available inventory at a specific branch.

## 2. What should be shown on this screen?

The page should feature a main **Data Grid** displaying the following columns for a selected Branch:
1. **Part Code & Name** (from `spare_part_master`)
2. **Category / Brand** (from `spare_part_master`)
3. **Current Stock Quantity** (Calculated dynamically: `SUM(qty where dr_cr = 'D') - SUM(qty where dr_cr = 'C')` grouped by `part_id`)
4. **UOM (Unit of Measure)** (e.g., NOS, PCS)
5. **Inventory Value** (Current Stock $\times$ Cost Price)

## 3. Key Functionalities

### A. Branch Selection & Searching
- A dropdown at the top to select the **Branch** (defaults to globally active branch).
- A search bar to quickly find a specific part by name or code.
- Filter by Category.

### B. The SQL View / Query
Since calculating stock row-by-row on the frontend is inefficient, we should use a powerful SQL query in `sql_auth.py` that handles the aggregation:

```sql
GET_STOCK_OVERVIEW = """
    with "p_branch_id" as (values(%(branch_id)s::bigint))
    SELECT 
        sp.id AS part_id,
        sp.part_code,
        sp.part_name,
        sp.category,
        sp.uom,
        sp.cost_price,
        COALESCE(SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE -st.qty END), 0) AS current_stock
    FROM spare_part_master sp
    LEFT JOIN stock_transaction st ON st.part_id = sp.id AND st.branch_id = (table "p_branch_id")
    GROUP BY sp.id, sp.part_code, sp.part_name, sp.category, sp.uom, sp.cost_price
    ORDER BY sp.part_name
"""
```

### C. UI Features
- **Low Stock Indicator:** If quantity falls below 0 (which shouldn't happen but helps spot negative inventory anomalies) or below a certain threshold.
- **Ledger Drilldown (Future Scope):** Clicking on a row could open a side-panel or dialog showing the "Stock Ledger" for that item (last 10 transactions).

## 4. Implementation Steps (If Approved)
1. Add `GET_STOCK_OVERVIEW` to `sql_auth.py`.
2. Add constant to `sql-map.ts`.
3. Create `stock-overview-section.tsx` inside `features/client/components/`.
4. Add state management for Branch ID, Search Query, and fetching the aggregated stock via `genericQuery`.
5. Map this component to the `InventoryExplorer` when "Stock Overview" is selected.
