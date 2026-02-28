# Information and guidelines
- This is a SAAS project for Electronic gadgets repair management in a workshop with a customer interface.
- Server is built using fastapi, Python, and PostgreSQL
- Client is built using React, Redux, Vite and TypeScript
- Server code is in folder 'service-plus-server'
- Client code is in folder 'service-plus-client'
- client database name is 'service_plus_client'. It has only one schema as 'public' and  has 1 table as 'client'. Details are in 'service-plus-client/src/types/db-schema-client.ts'. Database structure is in 'service-plus-server/db/service-plus-client.sql'
- server database name is 'service_plus_demo'. It has 2 schemas as 'security' and 'demo1'. Details are in 'service-plus-client/src/types/db-schema-service.ts' and 'service-plus-client/src/types/db-schema-security.ts'. Database structure is in 'service-plus-server/db/service-plus-demo.sql'
- In fact there is one row for each client in 'service_plus_client' database in client table. This row is created when a new client is created. This row is updated when the client is updated. This row is deleted when the client is deleted. For each client, there is a separate database created. The name of the database is the database column db_name in the client table.
- if db_name is servic_plus_demo in client table, Then there should exist a database named 'service_plus_demo', with one mandatory schema 'security'. For each entry in bu table there will be a schema created with the name of the code column of the bu table. In present instance this is demo1. The 'demo1' name comes from the 'code' column of the'bu' table in 'security' schema. When a new BU is created, a new schema with the code of the BU is created in the 'service_plus_demo' database. This schema will have all the tables required for the BU.
- The workflow is as follows:
1. "Super Admin User" (SA) gathers information of client details and Admin user (AU) details and client database name from the client side form.
2. A new client is created as a new row in the 'client' table in 'service_plus_client' database. Based on the database name, the db_name column is updated.
3. A new database is created with the same name as db_name. This database will have initially one schema only named as 'security' as per template in the 'security' schema of 'service-plus-server/db/service-plus-demo.sql'.
4. In security schema of the new database, a new row is created in the 'user' table. This row will have the details of the admin user (AU) gathered from the client side form. Now work of SA finished.
5. SA can create multiple AU's (Admin user) as per requirement, for a given client. While creation of an AU, the details are entered in the 'user' table in 'security' schema of the client database.
6. SA can also modify the client details and AU details as per requirement, for a given client. While modification of a client or AU, the details are updated in the 'client' table of 'service_plus_client' database and 'user' table in 'security' schema of the here service_plus_demo database. SA can also disable a client or AU. While disabling a client or AU, the 'is_active' column is updated to false in the 'client' table of 'service_plus_client' database and 'user' table in 'security' schema of the here service_plus_demo database.
7. When a user is AU, then he can create a new user in the 'user' table in 'security' schema of the client database. This user will be a normal user (NU).
8. AU can create a new BU in the 'bu' table in 'security' schema of the service_plus_demo database. AU is asked for creation of a new BU when there is none.
9. When AU creates a new bu in the bu table of the security schema of 'service_plus_demo' database, a new schema with the code column value of the bu table is created in the here service_plus_demo database. This schema will have all the tables required for the BU. The details of the schema is in 'demo1' schema of 'service_plus_demo' database. The 'demo1' schema is a template for the new schema with the code of bu as schema name. The tables in the new schema will be created by copying the tables from the 'demo1' schema.
# Guidelines
- When any text command is given to gemini and last word is plan then do the plan only for the given command. Write your plan in the planA.md file in the plans folder in root. 
- Overwrite planA.md if required.
- In planA.md write all the steps of execution as Step1, Step 2 and so on.
- In planA.md include a workflow section which provides the workflow of entire effort