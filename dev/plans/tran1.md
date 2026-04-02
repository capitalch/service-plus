# changes to be made in codebase
- database schema is changed at server side, make necessary changes in sql_bu.py at server.
- Make necessary changes in client side code to reflect the changes in database schema.
- Make this new seed data entry in BU_SEED_SQL:
    - Enter a row in app_settings table:
        - key: "default_gst_rate",
        - value: "18"
    - Enter a row in app_settings table:
        - key: "to_show_parts_in_job_invoice",
        - value: "true"
        
        