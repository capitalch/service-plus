# Plan: Fix Email Uniqueness Check — Remove is_admin Filter

## Root Cause

`security."user"` has `UNIQUE (email)` covering ALL rows (admins + business users).

Both check SQLs filter `AND is_admin = false`, so they only search among business users.

If the email being entered belongs to an **admin user**, the check finds nothing
→ returns `exists = false` → green check → form submits → PostgreSQL UNIQUE
constraint fires at the server → runtime error.

## Fix

Remove `AND is_admin = false` from:
1. `CHECK_BUSINESS_USER_EMAIL_EXISTS`          (used in create dialog)
2. `CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID` (used in edit dialog)

Both should check against the ENTIRE `security."user"` table, matching the scope
of the actual unique constraint.

---

## Steps

### Step 1 — Fix SQL in `sql_auth.py`

**File:** `service-plus-server/app/db/sql_auth.py`

**1a. `CHECK_BUSINESS_USER_EMAIL_EXISTS`** — remove `AND is_admin = false`:

```sql
-- Before:
SELECT EXISTS(
    SELECT 1 FROM security."user"
    WHERE LOWER(email) = LOWER((table "p_email"))
      AND is_admin = false
) AS exists

-- After:
SELECT EXISTS(
    SELECT 1 FROM security."user"
    WHERE LOWER(email) = LOWER((table "p_email"))
) AS exists
```

**1b. `CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID`** — remove `AND is_admin = false`:

```sql
-- Before:
SELECT EXISTS(
    SELECT 1 FROM security."user"
    WHERE LOWER(email) = LOWER((table "p_email"))
      AND is_admin = false
      AND id <> (table "p_id")
) AS exists

-- After:
SELECT EXISTS(
    SELECT 1 FROM security."user"
    WHERE LOWER(email) = LOWER((table "p_email"))
      AND id <> (table "p_id")
) AS exists
```

---

## Files to Change

| Action | File |
|--------|------|
| Modify | `service-plus-server/app/db/sql_auth.py` |

No frontend changes needed — the frontend code is already correct.
The debounced check, spinner, green check, and submit guards all work as intended
once the SQL returns the correct result.
