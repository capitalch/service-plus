# Plan: Add Login to auth_router with Helper in auth_router_helper

---

## Workflow

```
Client
  │
  ▼
POST /api/auth/login
  │  LoginRequest { clientId, identity, password }
  ▼
auth_router.py
  │  log request → delegate to login_helper(body)
  ▼
login_helper()  [auth_router_helper.py]
  │
  ├─[1]─ SuperAdmin check
  │         identity == config.superadmin_username?
  │           YES → verify_password(password, config.superadmin_password_hash)
  │                   FAIL → raise AuthorizationException (INVALID_CREDENTIALS)
  │                   PASS → create_access_token({ userId:"S", userType:"S", clientId, db_name:None })
  │                        → return LoginResponse immediately
  │
  ├─[2]─ Resolve tenant  [Client DB]
  │         SqlAuth.GET_CLIENT_DB_NAME
  │         exec_sql(db_name=None, args={ clientId })
  │         → { db_name }   or raise AuthorizationException (INVALID_CREDENTIALS)
  │
  ├─[3]─ Authenticate user  [Service DB — security schema]
  │         SqlAuth.GET_USER_BY_IDENTITY
  │         exec_sql(db_name=db_name, schema="security", args={ identity })
  │         → { id, username, email, mobile, password_hash, full_name,
  │             is_active, is_admin, role_name, access_rights }
  │         → no row found  → raise AuthorizationException (INVALID_CREDENTIALS)
  │         → is_active is False → raise AuthorizationException (FORBIDDEN)
  │
  ├─[4]─ Verify password
  │         verify_password(password, password_hash)
  │         FAIL → raise AuthorizationException (INVALID_CREDENTIALS)
  │
  ├─[5]─ Determine userType
  │         is_admin == True  → userType = "A"
  │         is_admin == False → userType = "B"
  │
  ├─[6]─ Create JWT
  │         create_access_token({ userId: id, userType, clientId, db_name })
  │
  ├─[7]─ Log LOGIN_SUCCESSFUL
  │
  └─[8]─ return LoginResponse
              { access_token, token_type:"bearer", user_type,
                email, full_name, mobile, role_name, access_rights }
  │
  ▼
auth_router.py  →  LoginResponse  →  Client
```

---

## Steps

### Step 1 — Add login schemas to `app/schemas/auth_schema.py`
- `LoginRequest`: `client_id: str`, `identity: str`, `password: str`
- `LoginResponse`: `access_token: str`, `access_rights: list[str]`, `email: str`,
  `full_name: str`, `mobile: str`, `role_name: str`, `token_type: str`, `user_type: str`
- Keep classes sorted alphabetically.

### Step 2 — Add SuperAdmin config fields to `app/config.py`
- Add `superadmin_username: str` and `superadmin_password_hash: str` to `Settings`.
- Used only in the SuperAdmin check inside `login_helper()`.

### Step 3 — Add SQL constants to `app/db/sql_auth.py`
All SQL must use CTEs for parameters with a commented-out test value line.
Keep constants sorted alphabetically.

**Schema reference** (`service_plus_client.sql`, `service_plus_demo.sql`):
- Client DB: `public.client` — columns: `id bigint`, `db_name`, `is_active`
- Service DB `security."user"` — columns: `id`, `username`, `email`, `mobile`,
  `password_hash`, `full_name`, `is_active`, `is_admin`
- `role_name` → joined from `security.user_bu_role` → `security.role.name`
- `access_rights` → aggregated from `security.user_bu_role` → `security.role_access_right`
  → `security.access_right.code` (array of text codes)

`GET_CLIENT_DB_NAME` (Client DB, `public` schema):
```sql
with "client_id" as (values(%(client_id)s::bigint))
-- with "client_id" as (values(1::bigint)) -- Test line
SELECT db_name
FROM client
WHERE id = (table "client_id")
  AND is_active = true
```

`GET_USER_BY_IDENTITY` (Service DB, caller passes `schema="security"` to `exec_sql`):
```sql
with "identity" as (values(%(identity)s::text))
-- with "identity" as (values('john@example.com'::text)) -- Test line
SELECT u.id, u.username, u.email, u.mobile, u.password_hash, u.full_name,
       u.is_active, u.is_admin,
       (SELECT r.name
        FROM user_bu_role ubr
        JOIN role r ON r.id = ubr.role_id
        WHERE ubr.user_id = u.id AND ubr.is_active = true
        ORDER BY r.name LIMIT 1) AS role_name,
       ARRAY(SELECT DISTINCT ar.code
             FROM user_bu_role ubr
             JOIN role_access_right rar ON rar.role_id = ubr.role_id
             JOIN access_right ar ON ar.id = rar.access_right_id
             WHERE ubr.user_id = u.id AND ubr.is_active = true
             ORDER BY ar.code) AS access_rights
FROM "user" u
WHERE u.username = (table "identity")
   OR u.email = (table "identity")
LIMIT 1
```

### Step 4 — Add `login_helper()` to `app/routers/auth_router_helper.py`
- Implement the 8-step flow from the workflow above.
- Always raise `AuthorizationException(AppMessages.INVALID_CREDENTIALS)` for any
  auth failure — never reveal whether the client, user, or password was the problem.
- Keep functions sorted alphabetically.

### Step 5 — Add `POST /api/auth/login` endpoint to `app/routers/auth_router.py`
- Accept `LoginRequest`, respond with `LoginResponse`.
- Log the call at INFO level, then delegate entirely to `login_helper(body)`.
- Keep endpoints sorted alphabetically by path.

### Step 6 — Verify `AppMessages` in `app/exceptions.py`
- Confirm `FORBIDDEN`, `INVALID_CREDENTIALS`, `LOGIN_SUCCESSFUL` exist — no changes needed.
