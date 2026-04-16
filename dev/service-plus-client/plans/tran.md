# Plan for implementation of opening stock
- at present we have stock_opening_balance and stock_opening_balance_line tables in the database.
- Opening balance is givan once in a lifetime for a branch.
- Corresponding to each entry in stock_opening_balance table, there will be multiple entries in stock_opening_balance_line table.
- for each entry in stock_opening_balance_line table, there will be a corresponding entry in stock_transaction table.
- Please check current table structure and give a suggestion for best strategy to implement opening stock.
- If required we can make changes in table structure.