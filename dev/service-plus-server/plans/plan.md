# Plan: Add Login to auth_router with Helper in auth_router_helper

## Objective
Implement a `POST /api/auth/login` endpoint in `auth_router.py` that authenticates a user
(username + password), verifies credentials against the database, and returns a JWT access token.
All business logic lives in `auth_router_helper.py`.

---

## Workflow

```
Client
  │
  ▼
POST /api/auth/login  (auth_router.py)
  │  LoginRequest { username, password }
  ▼
login_helper()  (auth_router_helper.py)
  │
  ├─► SqlAuth.GET_USER_BY_USERNAME  (sql_auth.py)
  │     └─► database.exec_sql()  →  user row (id, username, password_hash, is_active, role)
  │
  ├─► verify_password(plain, hash)  (core/security.py)
  │     └─► raise AuthorizationException on failure
  │
  ├─► create_access_token({ sub: username, role: role })  (core/security.py)
  │
  └─► return LoginResponse { access_token, token_type="bearer", username, role }
  │
  ▼
auth_router.py  →  LoginResponse  →  Client
```

---

## Step 1 — Add login schemas to `app/schemas/auth_schema.py`
- Add `LoginRequest` Pydantic model with fields: `username: str`, `password: str`
- Add `LoginResponse` Pydantic model with fields:
  `access_token: str`, `token_type: str`, `username: str`, `role: str`
- Keep all models sorted alphabetically by class name.

## Step 2 — Add SQL query to `app/db/sql_auth.py`
- Add class constant `GET_USER_BY_USERNAME` that selects
  `id, username, password_hash, is_active, role` from the `app_user` table
  filtered by `%(username)s`.
- Keep constants sorted alphabetically by name.

## Step 3 — Add `login_helper()` to `app/routers/auth_router_helper.py`
- Import: `AuthorizationException`, `AppMessages`, `verify_password`, `create_access_token`,
  `LoginRequest`, `LoginResponse`, `SqlAuth`, `exec_sql`, `logger`.
- Function signature: `async def login_helper(data: LoginRequest) -> LoginResponse`
- Steps inside the helper:
  1. Call `exec_sql` with `SqlAuth.GET_USER_BY_USERNAME` and `{"username": data.username}`.
  2. If no row returned, raise `AuthorizationException(AppMessages.INVALID_CREDENTIALS)`.
  3. If `user["is_active"]` is `False`, raise `AuthorizationException(AppMessages.FORBIDDEN)`.
  4. Call `verify_password(data.password, user["password_hash"])`; raise
     `AuthorizationException(AppMessages.INVALID_CREDENTIALS)` on failure.
  5. Call `create_access_token({"sub": user["username"], "role": user["role"]})`.
  6. Log success with `AppMessages.LOGIN_SUCCESSFUL`.
  7. Return `LoginResponse(access_token=token, token_type="bearer", username=..., role=...)`.
- Keep functions sorted alphabetically by name.

## Step 4 — Add `POST /api/auth/login` endpoint to `app/routers/auth_router.py`
- Import `LoginRequest`, `LoginResponse` from schemas and `login_helper` from helper.
- Add endpoint:
  ```
  POST /api/auth/login
  Body: LoginRequest
  Response: LoginResponse
  ```
- Delegate entirely to `login_helper(body)`.
- Log the call at INFO level before delegating.
- Keep endpoint definitions sorted alphabetically by path name.

## Step 5 — Verify `AppMessages` entries in `app/exceptions.py`
- Confirm that `FORBIDDEN`, `INVALID_CREDENTIALS`, and `LOGIN_SUCCESSFUL` already exist.
- No changes needed unless any of those constants are missing.
