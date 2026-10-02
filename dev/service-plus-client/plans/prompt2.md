# Division issue to be fixed
- There is one issue. The issue is division.
- One branch can have many divisions. 
- Each division can update accounts at Trace+, for which a separate config tab is there. 
- When using multiple divisions different gst profiles can be used. One division can have gst billing, another may not. 
- At present at least one division is mandatory to start with.
- I want to keep the things simple for customers of lt and ent. For lt and ent, there will be only one division each named as "main" division. This division should be created by default when the bu is first created. Also this division can not be deleted. Customer should be able to edit the name of division. But cannot create any new division. Trace+ configuration of division should not be available for customers of lt and ent. These customers cannot update accounts at Trace+. Corresponding changes are required in client side for lt and ent customers and also in server side.
- The mandatory field values for default division are same as that of default branch.
- Existing setup should not be disturbed by these changes.

