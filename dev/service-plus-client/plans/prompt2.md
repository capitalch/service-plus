# Division issue to be fixed before continueing with plan.md
- At present each branch can have multiple divisions. At least one division is mandatory for each branch.
- When a new bu is created by admin, a default branch Head Office is auto created.
- To do
    - Whenever a new branch is created, a default division should be auto created and its name should be "Main". This division can not be deleted. Common fields from branch should be auto copied to division. The id of this division should be 1,hence it is default division.
    - post_data_to_accounts app setting should be default false and when it is false, division trace+ configuration should not be visible. Division should be able to edit save without trace+ configuration.

