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
  ├─[3]─ Authenticate user  [Service DB]
  │         SqlAuth.GET_USER_BY_IDENTITY
  │         exec_sql(db_name=db_name, args={ identity })
  │         → { id, username, email, mobile, password_hash,
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
                email, mobile, role_name, access_rights }
  │
  ▼
auth_router.py  →  LoginResponse  →  Client
```

---

## Steps

### Step 1 — Add login schemas to `app/schemas/auth_schema.py`
- `LoginRequest`: `client_id: str`, `identity: str`, `password: str`
- `LoginResponse`: `access_token: str`, `token_type: str`, `user_type: str`,
  `email: str`, `mobile: str`, `role_name: str`, `access_rights: dict`
- Keep classes sorted alphabetically.

### Step 2 — Add SuperAdmin config fields to `app/config.py`
- Add `superadmin_username: str` and `superadmin_password_hash: str` to `Settings`.
- Used only in the SuperAdmin check inside `login_helper()`.

### Step 3 — Add SQL constants to `app/db/sql_auth.py`
- `GET_CLIENT_DB_NAME` — query Client DB by `%(client_id)s`; return `db_name`.
- `GET_USER_BY_IDENTITY` — query Service DB (`security` schema) where `username` or
  `email` matches `%(identity)s`; return `id, username, email, mobile, password_hash,
  is_active, is_admin, role_name, access_rights`.
- Keep constants sorted alphabetically.

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
