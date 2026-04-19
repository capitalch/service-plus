# Strategy and plan for stock snapshot
- We have a table named as stock_snapshot in database
- I want to upate this tab with the details of stock transactions at the end of every month.
- This should be done in a way that it does not affect the performance of the application.
- This should be done by fastapi server by detecting the change in month.
- Admin should be able to trigger this process manually for a selected period. The reason being that stock transactions can be done on back date, thus requiring manual intervention to update the stock snapshot. Is there other way to handle this?
- The part-finder stock detail panel should show the uptodate stock summary details by taking into account the aggregate of last stock snapshot and the stock transactions after that.
- Create a detailed strategy and plan for this and write this in plan.md file.