# Modify: Inventory > Opening Stock
- At present user can try to enter multiple instances of opening balances for a single branch. In that case referential integrity error happens at database level. Reason is, for one branch only one instance of opening balance can occur, which may consist of many parts. There is nothing wrong from database; referential integrity is correct. Problem is in UX.
- UX can be modified in a way that user should not be able to enter multiple instances of opening balances for a single branch. If there is an instance of opening balance for a branch, user should be able to add more parts to it. If there is no instance of opening balance for a branch, user should be able to enter a new instance of opening balance for that branch.
- MAybe the view tab is not required. It can be integrated into the main tab.
- Create a plan to modify the ux in plans/plan.md

    
    
    