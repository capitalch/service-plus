# Plan: Recreate security_schema_ddl from service_plus_service.sql Security Schema

## Objective
Create a `SECURITY_SCHEMA_DDL` constant (Python string) in `app/db/sql_auth.py` that contains the complete DDL SQL to create the `security` schema and all its objects in a new client database. This DDL is executed when provisioning a new client database.

---

## Security Schema Objects (sourced from service_plus_service.sql)

### Tables
1. `security.access_right` — access rights registry
2. `security.bu` — business units
3. `security.role` — roles
4. `security.role_access_right` — junction: role ↔ access_right
5. `security."user"` — users (quoted reserved word)
6. `security.user_bu_role` — junction: user ↔ bu ↔ role

### Sequences (GENERATED ALWAYS AS IDENTITY)
- `access_right.id`, `bu.id`, `user.id`

### Constraints
- PKs: all tables
- UNIQUE: `access_right.code`, `role.code`, `user.email`, `user.username`
- UNIQUE: `user_bu_role(user_id, bu_id)`
- CHECK: `access_right.code`, `role.code` (uppercase pattern `^[A-Z_]+$`)

### Indexes
- `access_right_module_idx` — btree on `module`
- `role_access_right_access_right_id_idx` — btree on `access_right_id`
- `role_is_system_idx` — btree on `is_system`
- `user_bu_role_bu_id_idx`, `user_bu_role_role_id_idx`, `user_bu_role_user_id_idx`
- `user_full_name_idx` — btree on `full_name`
- `user_mobile_unique_idx` — partial UNIQUE btree on `mobile WHERE mobile IS NOT NULL`

### Foreign Keys
- `role_access_right.access_right_id` → `access_right(id)` ON DELETE CASCADE
- `role_access_right.role_id` → `role(id)` ON DELETE CASCADE
- `user_bu_role.bu_id` → `bu(id)` ON DELETE CASCADE
- `user_bu_role.role_id` → `role(id)` ON DELETE CASCADE
- `user_bu_role.user_id` → `user(id)` ON DELETE CASCADE

---

## Steps

### Step 1 — Read existing sql_auth.py
Read `app/db/sql_auth.py` to understand current structure, class name, and what SQL constants already exist, to avoid duplication and maintain alphabetical ordering.

### Step 2 — Compose SECURITY_SCHEMA_DDL SQL string
Build a complete, ordered SQL string that:
1. Creates `security` schema
2. Creates all 6 tables with columns, defaults, and CHECK constraints (in alphabetical order: `access_right`, `bu`, `role`, `role_access_right`, `user`, `user_bu_role`)
3. Adds GENERATED ALWAYS AS IDENTITY sequences for `access_right.id`, `bu.id`, `user.id`
4. Adds primary key, unique, and check constraints
5. Creates all indexes
6. Adds foreign key constraints

The SQL must use `security` as the literal schema name (since this DDL is applied to a newly created client database, not the current one).

### Step 3 — Add SECURITY_SCHEMA_DDL to sql_auth.py
Insert the `SECURITY_SCHEMA_DDL` as a class-level constant string in the SQL auth class inside `app/db/sql_auth.py`, placed alphabetically among existing constants/properties.

### Step 4 — Verify
Confirm the constant is syntactically correct Python and the embedded SQL matches the source schema exactly (tables, columns, types, defaults, constraints, indexes, FKs).

---

## Workflow

```
service_plus_service.sql
        |
        | (extract security schema DDL objects)
        v
  Compose ordered SQL string
  - CREATE SCHEMA security
  - CREATE TABLE (6 tables, alphabetical)
  - ALTER TABLE ... ADD GENERATED ALWAYS AS IDENTITY (sequences)
  - ALTER TABLE ONLY ... ADD CONSTRAINT (PKs, UNIQUEs, CHECKs)
  - CREATE INDEX / CREATE UNIQUE INDEX
  - ALTER TABLE ONLY ... ADD CONSTRAINT (FKs)
        |
        v
  Insert as SECURITY_SCHEMA_DDL constant
  into app/db/sql_auth.py (SQL auth class, alphabetical position)
        |
        v
  Used by provisioning logic when creating a new client database:
  execute(SECURITY_SCHEMA_DDL) → security schema ready in new DB
```
