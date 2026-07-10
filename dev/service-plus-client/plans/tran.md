# New client database creation, and security and bu named schema creation process upgrade
- At present sql_store contains the sql as SECURITY_SCHEMA_DDL string and securityschema is created at the time of client initialization. Seed data for security schema is provided through client side code in react components.
- A new schema named after bu is also created when user creates a new bu. the sql for bu schema creation is hardcoded in sql_bu.py.
- Also the seed data for the bu schema is provided in sql_bu.py
- Actually the single source of truth for security and bu named schema is service_plus_service.sql file. This excludes the seed data for both the schemas.
- I propose to move all seed data for both the schemas to a two different files properly named as seed_security_data.py and seed_bu_data.py.
- I also want a mechanism to extract the schema creation sql for both the schemas to two different files sql_security.py and sql_bu.py. These files will be read by service plus server for creating schemas and seed data will be read from seed_security_data.py and seed_bu_data.py for populating the schemas as and when required.
- Keep all these files in app/db folder. Suggest a mechanism to extract data from service_plus_service.sql to sql_security.py and sql_bu.py. This will be required when there is change is database and therefore service_plus_service.sql file changes.
- Seed data will be manually updated in seed_security_data.py and seed_bu_data.py.
- Also fitin the new changes to existing setup without breaking it.
