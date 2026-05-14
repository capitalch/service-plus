# Fix: job_part_used cost_price / selling_price

## Root cause
`GET_JOB_PART_USED_BY_JOB` selects `jpu.sale_price` but the actual column added to the
table is `selling_price`. `jpu.cost_price` now exists, so that reference is valid.

The charges modal also uses `sale_price` internally throughout (types, state, save payload).

## Changes

### 1. sql_store.py
- Fix `GET_JOB_PART_USED_BY_JOB`: `jpu.sale_price` → `jpu.selling_price`
- Add `GET_APP_SETTING_BY_KEY`: fetch a single `app_setting` row by `setting_key`

### 2. sql-map.ts
- Add `GET_APP_SETTING_BY_KEY`

### 3. job-charges-modal.tsx
- Rename `sale_price` → `selling_price` in `ExistingPartRow`, `NewPartRow`, all handlers,
  save payloads, and JSX inputs/column headers
- On load: fetch `MARKUP_PERCENT_OVER_COST` from `app_setting` alongside other queries
- `handlePartSelect`: auto-populate `cost_price = part.cost_price ?? null`;
  auto-compute `selling_price = round(cost_price × (1 + markup/100), 2)`
- `handlePartClear`: clear `selling_price` (was `sale_price`)

### 4. job-pdf-modal.tsx
- `PartUsedRow.sale_price` → `selling_price` (column name in query result)
- Update totals computation accordingly
