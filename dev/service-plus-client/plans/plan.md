# Plan: Fix Server-Side Bug — Pass BU id from Client to Skip Row Checks

## Problem

`resolve_create_bu_schema_and_feed_seed_data_helper` always runs uniqueness checks
and INSERT (steps 4–6). When the BU row already exists, step 4 raises `BU_CODE_EXISTS`.

## Solution

The client already holds `bu.id` (from the Redux store). Include it in the payload.
On the server, if `id` is present in the payload → BU row already exists → skip steps
4, 5, 6 entirely and use the supplied `id`. Proceed directly to schema creation (steps 7–10).

---

## Workflow

Client sends `{ code, id, name }` instead of `{ code, name }`.
Server checks: `if id present → repair path (skip insert); else → new BU path (original flow)`.

---

## Step 1 — Client: include `bu.id` in the payload (`create-bu-schema-dialog.tsx`)

Change line 62 from:
```ts
JSON.stringify({ code: bu.code.toLowerCase(), name: bu.name })
```
to:
```ts
JSON.stringify({ code: bu.code.toLowerCase(), id: bu.id, name: bu.name })
```

---

## Step 2 — Server: branch on `id` presence in `mutation_helper.py`

After format validations (steps 1–3, unchanged), add:

```python
# 4. If id supplied, BU row already exists — skip uniqueness checks and INSERT
bu_id = payload.get("id")
if bu_id:
    bu_id = int(bu_id)
else:
    # existing steps 4–6: uniqueness checks + INSERT
    ...
    bu_id = rows[0]["id"] if rows else None

# Steps 7–10 (schema, DDL, seed, audit) unchanged — run for both paths
```

No new SQL query needed — `id` is taken directly from the payload.
