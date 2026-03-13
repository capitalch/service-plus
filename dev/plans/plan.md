# Plan: Fix Login for All User Types (SA / Admin / Business)

## Current State Analysis

| User Type | Server | Client | Status |
|-----------|--------|--------|--------|
| Super Admin (S) | ✅ Early-return path, skips client DB | ⚠️ Form requires client selection — SA has no client | Partial |
| Admin User (A) | ❌ `username` missing from `LoginResponse` → Pydantic `ValidationError` → 500 | ✅ `RoleSelectionDialog` ready | Broken |
| Business User (B) | ❌ Same `username` missing bug as Admin | ✅ Routes to client mode | Broken |

### Root Causes

1. **Server — `auth_router_helper.py` (line 136–144)**
   Non-SA `LoginResponse(...)` call is missing `id=user["id"]` and `username=user["username"]`.
   `username` has no default in `LoginResponse` schema → Pydantic raises `ValidationError` → server returns 500 for every admin/business login.

2. **Server — `auth_schema.py`**
   `client_id: str` is required. Super Admin does not belong to any client; forcing a `client_id` is semantically wrong (though the server ignores it for SA after the identity check).

3. **Client — `auth-schemas.ts`**
   `clientId: z.string().min(1, ...)` — mandatory. SA cannot submit the login form without selecting a client.

4. **Client — `login-form.tsx`**
   No hint to SA that the Client field is not required for them.

---

## Fix Plan

### Step 1 — Server: Fix missing `id` & `username` in non-SA `LoginResponse`

**File:** `service-plus-server/app/routers/auth_router_helper.py`

Change the non-SA return (around line 136) from:
```python
return LoginResponse(
    access_token=access_token,
    access_rights=user["access_rights"] or [],
    email=user["email"],
    full_name=user["full_name"],
    mobile=user["mobile"] or "",
    role_name=user["role_name"] or "",
    user_type=user_type,
)
```
To:
```python
return LoginResponse(
    access_token=access_token,
    access_rights=user["access_rights"] or [],
    email=user["email"],
    full_name=user["full_name"],
    id=user["id"],
    mobile=user["mobile"] or "",
    role_name=user["role_name"] or "",
    user_type=user_type,
    username=user["username"],
)
```

---

### Step 2 — Server: Make `client_id` optional in `LoginRequest`

**File:** `service-plus-server/app/schemas/auth_schema.py`

Change:
```python
client_id: str = Field(alias="clientId", description="ID of the client application")
```
To:
```python
client_id: str = Field(default="", alias="clientId", description="ID of the client application")
```

This allows SA to submit without a `clientId`. Non-SA users who omit it will get "invalid credentials" from step [2] of `login_helper` (correct behaviour).

---

### Step 3 — Client: Make `clientId` optional in Zod schema

**File:** `service-plus-client/src/features/auth/schemas/auth-schemas.ts`

Change:
```ts
clientId: z.string().min(1, MESSAGES.ERROR_CLIENT_REQUIRED),
```
To:
```ts
clientId: z.string().default(''),
```

---

### Step 4 — Client: Add Super Admin hint in login form

**File:** `service-plus-client/src/features/auth/components/login-form.tsx`

Add a small helper text under the Client combobox:
```tsx
<p className="text-xs text-slate-400">Not required for Super Admin login</p>
```

---

## Workflow

```
User submits login form
        │
        ├─ identity == SA username? (server check)
        │       YES → verify SA password → return JWT (user_type="S")
        │       NO  → resolve tenant DB via client_id
        │               │
        │               ├─ client not found → 401 Invalid credentials
        │               └─ found → GET_USER_BY_IDENTITY
        │                           │
        │                           ├─ user not found / inactive → 401
        │                           ├─ wrong password → 401
        │                           └─ OK → determine user_type (A or B)
        │                                   → build JWT with id, db_name, client_id
        │                                   → return LoginResponse (with id + username) ✅
        │
Client receives LoginResponse
        │
        ├─ userType === 'S' → navigate /super-admin
        ├─ userType === 'A' → show RoleSelectionDialog
        │                       ├─ Admin Mode → setSessionMode('admin') → /admin
        │                       └─ Client Mode → setSessionMode('client') → /
        └─ userType === 'B' → setSessionMode('client') → /
```

## Summary

| File | Change |
|------|--------|
| `app/routers/auth_router_helper.py` | Add `id` and `username` to non-SA `LoginResponse` |
| `app/schemas/auth_schema.py` | Make `client_id` optional (default `""`) |
| `src/features/auth/schemas/auth-schemas.ts` | Make `clientId` optional in Zod schema |
| `src/features/auth/components/login-form.tsx` | Add "Not required for Super Admin" hint |
