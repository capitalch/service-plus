# Plan — Test SQL for the Migration Tool

Source: [`plans/prompt.md`](./prompt.md). Two standalone scripts, meant to be pasted into the tool's "Provide SQL" step (or loaded as `.sql` files) on a *non-production* schema first: one that creates a test table and seeds dummy rows, one that tears it back down. Each script is a single block — per `DESIGN.md` §8, everything pasted in one go runs inside one transaction per schema, so either script fully applies to a schema or not at all.

Table name (`migration_tool_test_probe`) is deliberately unlikely to collide with any real BU table. No schema qualifier is used in either script — the tool already runs `SET search_path TO "<schema>"` before executing (`db.py:run_sql_in_schema`), so the table resolves inside whichever schema is selected as a target.

## Script 1 — create + seed (`create_test_probe.sql`)

```sql
-- migration-tool smoke test: create + seed a disposable table.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING make it idempotent.

CREATE TABLE IF NOT EXISTS migration_tool_test_probe (
    id          SERIAL PRIMARY KEY,
    label       TEXT NOT NULL UNIQUE,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO migration_tool_test_probe (label, note) VALUES
    ('probe-1', 'migration-tool smoke test row 1'),
    ('probe-2', 'migration-tool smoke test row 2'),
    ('probe-3', 'migration-tool smoke test row 3')
ON CONFLICT (label) DO NOTHING;
```

## Script 2 — clean up (`drop_test_probe.sql`)

```sql
-- migration-tool smoke test: remove the table and all its data.
-- DROP ... IF EXISTS makes this safe to run even if create_test_probe.sql
-- was never applied to a given schema (e.g. a schema that failed earlier).

DROP TABLE IF EXISTS migration_tool_test_probe;
```

## How to use these with the tool

1. Run the tool (`streamlit run app.py`), connect, and select **one throwaway schema** first — not "select all everywhere" — for the first pass.
2. Paste Script 1 into step 3, review in step 4 (confirm the SQL shown matches the block above and the target list is just the one throwaway schema), then Run.
3. Confirm success in the step 5 results table, then connect to that schema directly (`psql`, or any client) and check `migration_tool_test_probe` has 3 rows.
4. Paste Script 2, run it against the same schema, and confirm the table is gone.
5. Once the single-schema pass is clean, repeat with a wider target selection (multiple schemas / clients) to exercise the per-schema transaction and multi-target result reporting.
6. To test the failure path (per DESIGN.md §8 — one schema's failure shouldn't block the rest), run Script 1 twice *without* running Script 2 in between against a schema that already has a conflicting non-unique-violation error (e.g. temporarily rename `label` to something that breaks a hand-added `CHECK`), and confirm the run still proceeds to the remaining selected schemas with that one schema reporting ❌ and an error message.
