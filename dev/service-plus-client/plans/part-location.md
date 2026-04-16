# set Part Location Implementation Plan
- stock_balance table has column location_id
- if it is null then it is in default location
- if it is not null then it is in the specified location
- we have two other tables spare_part_location_master and spare_part_location_change which track the location history of a part
- final location of part is stored in stock_balance table
- rename the tables as follows
- spare_part_location_master → stock_location_master
- spare_part_location_change → stock_location_change

