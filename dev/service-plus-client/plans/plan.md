# Plan: Add Username Field to Create Admin Dialog

## Overview

The "Add Admin" form (`create-admin-dialog.tsx`) must collect a `username` from the SA.
Username must be validated as unique within the client's security database via a debounced
server-side check (same pattern as email uniqueness). The server currently auto-derives
username from email — that logic must be replaced with the caller-supplied value.

---

## Workflow

```
SA opens "Add Admin" dialog
  → fills in: Full Name, Username (new), Email, Mobile
  → on username input (debounced 1200ms) → genericQuery CHECK_ADMIN_USERNAME_EXISTS
      → exists  → set error "Username already taken"
      → !exists → show green tick
  → on email input (debounced, unchanged) → CHECK_ADMIN_EMAIL_EXISTS
  → submit → createAdminUser mutation (now includes username)
  → server stores supplied username instead of auto-deriving it
  → email sent with the supplied username + temp password
```

---

## Steps

### Step 1 — Add SQL key: `sql-map.ts`
**File:** `src/constants/sql-map.ts`

Add (alphabetically):
```ts
CHECK_ADMIN_USERNAME_EXISTS: "CHECK_ADMIN_USERNAME_EXISTS",
```

### Step 2 — Add message keys: `messages.ts`
**File:** `src/constants/messages.ts`

Add under **Admin CRUD** section (alphabetically):
```ts
ERROR_ADMIN_USERNAME_EXISTS: 'This username is already taken for this client.',
ERROR_ADMIN_USERNAME_REQUIRED: 'Username is required.',
```

### Step 3 — Update GraphQL mutation: `graphql-map.ts`
**File:** `src/constants/graphql-map.ts`

Update `createAdminUser` mutation to include `$username: String!`:
```graphql
mutation CreateAdminUser(
    $db_name: String!
    $email: String!
    $full_name: String!
    $mobile: String
    $username: String!
) {
    createAdminUser(
        db_name: $db_name
        email: $email
        full_name: $full_name
        mobile: $mobile
        username: $username
    )
}
```

### Step 4 — Update `create-admin-dialog.tsx`
**File:** `src/features/super-admin/components/create-admin-dialog.tsx`

- Add `username` to `createAdminSchema`:
  ```ts
  username: z.string()
      .min(1, MESSAGES.ERROR_ADMIN_USERNAME_REQUIRED)
      .min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
      .regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
  ```
- Add state: `checkingUsername`, `usernameTaken` (same pattern as email).
- Add `useWatch` on `username`; debounce → `genericQuery` with `CHECK_ADMIN_USERNAME_EXISTS`.
- Add Username input field (with spinner/tick feedback) between Full Name and Email.
- Include `username` in `onSubmit` mutation variables.
- Update `form.reset` and close-reset effect to include `username: ""`.
- Update `submitDisabled` to also guard on `usernameTaken === true` and `checkingUsername`.

### Step 5 — Add SQL: `sql_auth.py`
**File:** `app/db/sql_auth.py`

Add `CHECK_ADMIN_USERNAME_EXISTS` (same pattern as `CHECK_ADMIN_EMAIL_EXISTS`):
```sql
CHECK_ADMIN_USERNAME_EXISTS = """
    with "p_username" as (values(%(username)s::text))
    SELECT EXISTS(
        SELECT 1 FROM security."user"
        WHERE LOWER(username) = LOWER((table "p_username"))
    ) AS exists
"""
```

### Step 6 — Update GraphQL schema: `schema.graphql`
**File:** `app/graphql/schema.graphql`

Add `username: String!` to `createAdminUser` mutation:
```
createAdminUser(db_name: String!, email: String!, full_name: String!, mobile: String, username: String!): Generic
```

### Step 7 — Update mutation resolver: `mutation.py`
**File:** `app/graphql/resolvers/mutation.py`

Add `username: str` parameter to `resolve_create_admin_user` and pass it through to the helper.

### Step 8 — Update mutation helper: `mutation_helper.py`
**File:** `app/graphql/resolvers/mutation_helper.py`

- Add `username: str` parameter to `resolve_create_admin_user_helper`.
- Remove the auto-derive block (lines that build `username` from email local-part).
- Use the supplied `username` directly.

---

## Files Changed

| File | Change |
|------|--------|
| `src/constants/sql-map.ts` | Add `CHECK_ADMIN_USERNAME_EXISTS` |
| `src/constants/messages.ts` | Add `ERROR_ADMIN_USERNAME_EXISTS`, `ERROR_ADMIN_USERNAME_REQUIRED` |
| `src/constants/graphql-map.ts` | Add `$username` to `createAdminUser` mutation |
| `src/features/super-admin/components/create-admin-dialog.tsx` | Add username field with debounced uniqueness check |
| `app/db/sql_auth.py` | Add `CHECK_ADMIN_USERNAME_EXISTS` SQL |
| `app/graphql/schema.graphql` | Add `username: String!` to `createAdminUser` |
| `app/graphql/resolvers/mutation.py` | Add `username` param + pass to helper |
| `app/graphql/resolvers/mutation_helper.py` | Accept `username`, remove auto-derive logic |
