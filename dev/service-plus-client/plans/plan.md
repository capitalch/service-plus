# Plan: Add `db_name` Column to Client Overview Table

## Objective
Add the `db_name` field (from `db-schema-client.ts` → `Client` table, `public.client.db_name`) to the `ClientType` and render it as a new visible column in the `ClientOverviewTable` component.

---

## Workflow

```
src/features/super-admin/types/index.ts
       ↓  add db_name: string | null to ClientType
src/features/super-admin/data/dummy-data.ts
       ↓  add db_name values to each dummy client entry
src/features/super-admin/components/client-overview-table.tsx
       ↓  add DB Name column header + cell (hidden on small/medium, visible on xl)
```

---

## Steps

### Step 1 — Update `ClientType` in `src/features/super-admin/types/index.ts`
- Add `db_name: string | null` to `ClientType`.
- Insert it in alphabetical order among the existing properties (between `created_at` and `id`).

### Step 2 — Update dummy data in `src/features/super-admin/data/dummy-data.ts`
- Add `db_name` field to each of the 6 dummy client objects in `dummyClients`.
- Use realistic placeholder DB names (e.g. `"alpha_corp_db"`, `"beta_solutions_db"`, etc.); use `null` for inactive clients.
- Keep object properties sorted alphabetically.

### Step 3 — Add DB Name column to `src/features/super-admin/components/client-overview-table.tsx`
- Add a new `<TableHead>` for **DB Name** positioned between "Created On" and "Actions".
- Apply `hidden xl:table-cell` responsive class (shows only on extra-large screens to preserve layout on smaller screens).
- Add the corresponding `<TableCell>` rendering `client.db_name ?? "—"` with the same `hidden xl:table-cell` responsive class.
- No other logic changes required.
