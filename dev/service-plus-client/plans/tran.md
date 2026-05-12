# Redesign of Job Pipeline
- In actions dropdown add the last dropdown option as "Undo last transaction"
- If there are no transactions already done for the selected job, then this item will be disabled
- "Undo last transaction" will remove the last transaction for the job and bring it to previous status
- A modal window will be shown with job no, customer name,  receive type, receive condition, device details, and read only transactions so far. There will be a message that last transaction will be undone and this step cannot be undone, are u sure? On confirm only, the action is taken.
- read the file plans/plan-undo-last-tran.md and write the modified plan in plans/plan.md


  