# For maintenance of schema
- In client side:
    - For deactivated schema, it allows delete schema option. But it deletes the row from security.bu table only. It does not delete the schema from the database. It should delete the schema from the database after giving a warning message to the user and inputting the schema name to confirm.
    - In Business Units page, show a button to display Orphaned bus. These are schemas in the database but not in the security.bu table. Allow selective delete of orphaned bus.
- Make sure that the schema name is always in lowercase.
- Do corresponding changes at server side.