# Plan: Server-generated Temporary Credentials for createAdminUser

## Overview

Currently Step 3 asks the SA to enter `username` and `password` for the admin user.
The new behaviour: the server auto-generates both, hashes the password, stores it, and
emails the plain-text credentials to the admin's email address. The admin user later
changes them after first login. The SA only provides `full_name`, `email`, and `mobile`.

---

## Workflow

```
SA fills Step 3 form: full_name, email, mobile (no username / no password)
  │
  ▼
Client calls createAdminUser(db_name, email, full_name, mobile?)
  │
  ▼
Server:
  1. Derive temporary username from email local-part (sanitized, unique check not needed
     for first admin — only one admin is created here)
  2. Generate a random temporary password (12 chars, letters + digits)
  3. Hash the password with hash_password()
  4. INSERT into security.user with is_admin=True, is_active=True
  5. Send email to admin's email with subject "Your Admin Credentials"
     containing username and plain-text temp password
  6. Return { id }
  │
  ▼
Client shows success screen
  (toast: "Admin user created. Credentials have been emailed.")
```

---

## Steps

### Step 1 — Server: add email utility

**File:** `service-plus-server/app/core/email.py` (new file)

Create a lightweight async email helper using Python's `smtplib` (or `aiosmtplib` if
already in requirements). Read SMTP config from environment variables:

```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
```

Expose one function:

```python
async def send_email(to: str, subject: str, body: str) -> None:
    ...
```

If SMTP is not configured (env vars missing), log a warning and skip silently so that
development environments without a mail server don't break.

---

### Step 2 — Server: update `resolve_create_admin_user_helper`

**File:** `service-plus-server/app/graphql/resolvers/mutation_helper.py`

Changes:
- Remove `password: str` and `username: str` parameters.
- Add imports: `import secrets, string` and `from app.core.email import send_email`.
- Generate username from email local-part: strip non-alphanumeric/underscore chars,
  lower-case, truncate to 30 chars, prefix `adm_` if result starts with a digit.
- Generate temp password: `secrets.token_urlsafe(9)` (12 printable URL-safe chars).
- Hash password with existing `hash_password()`.
- Insert user row (unchanged sql_object structure).
- Call `send_email(...)` with credentials after successful insert.
- Return `{"id": record_id}` (unchanged).

```python
async def resolve_create_admin_user_helper(
    db_name: str,
    email: str,
    full_name: str,
    mobile: str | None,
) -> dict:
    import re, secrets
    from app.core.email import send_email

    # Derive username
    local = email.split("@")[0]
    username = re.sub(r"[^a-zA-Z0-9_]", "", local).lower()[:30] or "admin"
    if username[0].isdigit():
        username = "adm_" + username

    # Generate temporary password
    temp_password = secrets.token_urlsafe(9)   # ~12 chars
    password_hash = hash_password(temp_password)

    sql_object = {
        "tableName": "user",
        "xData": {
            "email": email,
            "full_name": full_name,
            "is_active": True,
            "is_admin": True,
            "mobile": mobile or None,
            "password_hash": password_hash,
            "username": username,
        },
    }
    record_id = await exec_sql_object(db_name, "security", sql_object)

    # Email credentials (fire-and-forget; errors are logged, not re-raised)
    try:
        await send_email(
            to=email,
            subject="Your Admin Account Credentials",
            body=(
                f"Hello {full_name},\n\n"
                f"Your admin account has been created.\n\n"
                f"  Username : {username}\n"
                f"  Password : {temp_password}\n\n"
                f"Please log in and change your password immediately.\n"
            ),
        )
    except Exception as mail_err:
        logger.warning(f"Failed to send credentials email to {email}: {mail_err}")

    return {"id": record_id}
```

---

### Step 3 — Server: update `resolve_create_admin_user` resolver signature

**File:** `service-plus-server/app/graphql/resolvers/mutation.py`

Remove `password: str` and `username: str` parameters from the resolver function and
the helper call:

```python
@mutation.field("createAdminUser")
async def resolve_create_admin_user(
    _,
    info,
    db_name: str,
    email: str,
    full_name: str,
    mobile: str | None = None,
) -> Any:
    ...
    return await resolve_create_admin_user_helper(
        db_name=db_name,
        email=email,
        full_name=full_name,
        mobile=mobile,
    )
```

---

### Step 4 — Server: update GraphQL schema

**File:** `service-plus-server/app/graphql/schema.graphql`

Remove `password: String!` and `username: String!` from the `createAdminUser` mutation
definition:

```graphql
createAdminUser(
    db_name: String!
    email: String!
    full_name: String!
    mobile: String
): Int
```

---

### Step 5 — Client: update `GRAPHQL_MAP.createAdminUser`

**File:** `src/constants/graphql-map.ts`

Remove `$password` and `$username` variables:

```typescript
createAdminUser: gql`
    mutation CreateAdminUser(
        $db_name: String!
        $email: String!
        $full_name: String!
        $mobile: String
    ) {
        createAdminUser(
            db_name: $db_name
            email: $email
            full_name: $full_name
            mobile: $mobile
        )
    }
`,
```

---

### Step 6 — Client: update `step3Schema` and types

**File:** `src/features/super-admin/components/initialize-client-dialog.tsx`

- Remove `password` and `username` fields from `step3Schema`.
- Remove `Step3FormType` fields for `password` and `username`.
- Updated schema:

```typescript
const step3Schema = z.object({
    email: z.email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
    full_name: z.string().min(1, MESSAGES.ERROR_FULL_NAME_REQUIRED),
    mobile: z.string().optional(),
});
```

---

### Step 7 — Client: update `initialize-client-dialog.tsx` component

**File:** `src/features/super-admin/components/initialize-client-dialog.tsx`

Changes:
- Remove `useMutation(GRAPHQL_MAP.createAdminUser)` hook; use `apolloClient.mutate` instead (consistent with other calls in this file), add `useState` for `creatingAdmin`.
- Remove `useEffect` that auto-derives `username` from email (no longer needed).
- Remove `isUsernameDirty` ref.
- Update `step3Form` `defaultValues` — remove `password` and `username`.
- Update `step3Form.reset(...)` in the close effect — remove those fields.
- Rewrite `onStep3Submit`:

```typescript
async function onStep3Submit(data: Step3FormType) {
    const activeDb = createdDbName || client.db_name || "";
    setCreatingAdmin(true);
    try {
        const result = await apolloClient.mutate({
            mutation: GRAPHQL_MAP.createAdminUser,
            variables: {
                db_name: activeDb,
                email: data.email,
                full_name: data.full_name,
                mobile: data.mobile || null,
            },
        });
        if (result.errors?.length) {
            toast.error(MESSAGES.ERROR_INITIALIZE_ADMIN_FAILED);
            return;
        }
        setStep("success");
        toast.success(MESSAGES.SUCCESS_INITIALIZE_ADMIN);
    } catch {
        toast.error(MESSAGES.ERROR_INITIALIZE_ADMIN_FAILED);
    } finally {
        setCreatingAdmin(false);
    }
}
```

- Remove `Username` and `Temporary Password` input fields from the JSX (Step 3 panel).
- Update `step3Busy` to use the new `creatingAdmin` state.
- Update success screen paragraph to mention credentials were emailed.

---

### Step 8 — Client: add/update messages

**File:** `src/constants/messages.ts`

Add:

```typescript
SUCCESS_INITIALIZE_ADMIN: 'Admin user created. Login credentials have been emailed.',
```

(replaces existing `'Admin user created successfully.'`)

---

## Summary of Files Changed

### Server

| File | Change |
|---|---|
| `app/core/email.py` | New file — async `send_email` helper using SMTP env vars |
| `app/graphql/resolvers/mutation_helper.py` | Remove `password`/`username` params; auto-generate both; send email |
| `app/graphql/resolvers/mutation.py` | Remove `password`/`username` params from resolver |
| `app/graphql/schema.graphql` | Remove `password`/`username` from `createAdminUser` mutation |

### Client

| File | Change |
|---|---|
| `src/constants/graphql-map.ts` | Remove `$password`/`$username` from `createAdminUser` mutation |
| `src/constants/messages.ts` | Update `SUCCESS_INITIALIZE_ADMIN` to mention email |
| `src/features/super-admin/components/initialize-client-dialog.tsx` | Remove username/password fields, schema fields, auto-derive effect; switch to `apolloClient.mutate` |
