# for clients menu item initiate button
- Create a ui which is 2 step process:
    - Step 1: create db
        - if no db_name is present, show this section only, don't show admin section
        - prompt the db_name as service_plus_<client_code> and it should be unique for each client
        - before submit check if the db_name is already exists or not and don't allow to submit if it exists. Give proper message.
    - Step 2: create admin
        - if db_name is present, show this section only, don't show db section
        - prompt the admin details: 
            - full_name
            - email
            - mobile
    - When Step 1 is completed successfully, show Step 2
    - When Step 2 is completed successfully, show a success message and close the dialog. Then refesh the clients table.

