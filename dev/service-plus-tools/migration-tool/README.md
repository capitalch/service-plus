# Migration Tool

A small local GUI for running a SQL script — a schema change, a seed-data insert, anything — against a chosen set of BU schemas, across a chosen set of client databases, in one confirmed action, with a per-schema success/failure result.

It exists because there is no migration runner in the service-plus stack: a schema change made after a tenant is already provisioned has to be hand-applied per schema today. This tool is that hand-apply step, made repeatable and visible instead of a one-off `.sql` file run blind through `psql`.

See [`DESIGN.md`](./DESIGN.md) in this same folder for the full architecture and the reasoning behind each design choice. This file is the "how do I use it" companion.

## Background: what is Streamlit, and why this tool uses it

[Streamlit](https://streamlit.io/) is a Python library for building small, local web-UI tools out of a single script — no separate frontend/HTML/JS to write, no API layer to stand up. You write plain Python; each widget (`st.text_input`, `st.checkbox`, `st.button`, ...) is one line, and the whole script re-runs top-to-bottom every time someone interacts with the page. State that needs to survive between those re-runs (like "which schemas did the user check") is kept in `st.session_state`, a plain dict that persists across reruns within one browser session.

You run a Streamlit app with:
```
streamlit run app.py
```
which starts a local web server (default `http://localhost:8501`) and opens it in your browser. There's nothing to deploy — it's meant to be run on your own machine, by you, for as long as you need it.

This tool uses Streamlit specifically because its whole job — connect, pick targets, provide SQL, check, run, see results — only needs a handful of widgets and a Postgres driver (`psycopg`, the same one `service-plus-server` uses), not a separate frontend build. Streamlit's sidebar plus `st.container(height=...)` / `st.empty()` give the app a fixed, bounded-size layout (sidebar for setup, a fixed SQL box, a fixed Messages/Results box) instead of a page that keeps growing as you interact with it.

## Requirements

- Python 3.11+ (matching `service-plus-server`)
- The packages in `requirements.txt` (`streamlit`, `psycopg[binary]`, `python-dotenv`)
- Network access to the Postgres host that holds both the control database and every tenant database

## Setup

1. From this folder (`service-plus-tools/migration-tool/`):
   ```
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in the real Postgres connection details:
   ```
   cp .env.example .env
   ```
   `.env` is git-ignored — it is never committed, per the tool's own design (§5 of `DESIGN.md`). These are the *same* host/port/user/password `service-plus-server` uses to reach every client database — see `DESIGN.md` §2 if you want the "why" behind that.
3. Run it:
   ```
   streamlit run app.py
   ```
   Your browser opens to the tool automatically.

## Using the tool

It's a dashboard, not a wizard — everything is visible at once. Buttons that aren't ready yet are disabled (with a caption explaining what's missing) rather than hidden, and nothing about the page grows as you use it: the SQL box and the Messages/Results box are both fixed-height and scroll internally.

**Sidebar** (setup — scrolls on its own, never pushes the main panel around):

- **🔄 Reset** — clears everything and starts over.
- **Connect** — confirm (or edit) the control database name — the one database that lists every client and its own database name. Click "Test Connection." A clear error shows here if credentials or network access are wrong, before you get any further.
- **Targets** — once connected, every active client appears with its schemas listed as checkboxes (the internal `security` schema is hidden — it's never a migration target). Check whichever schemas you want this run to touch, across as many clients as you like. There's a "select all for this client" checkbox per client, and a "select all schemas in all clients" checkbox above the whole list for when you really do mean every schema, everywhere.

**Main panel**:

1. **SQL** — either paste SQL directly, or load a `.sql` file. This can be a schema change (`ALTER TABLE ...`), a seed-data insert, anything — it's treated the same way either way.
2. **Check** — enabled once you're connected, have selected at least one target, and have entered SQL. Dry-runs the SQL against every selected target — same transaction as a real run, but always rolled back, nothing committed — and shows "SQL ok — will run on N schema(s)" (or exactly which schemas failed and why) in the Messages box below. Changing the SQL or the target selection after checking invalidates the check (the Messages box switches to a stale-check warning and Continue disables again) — check again before continuing. There is no undo once a schema's run commits — Check is the one safety gate, so actually read what's in the Messages box before clicking Continue.
3. **Continue** — enabled only once the current SQL + targets have been checked successfully. Schemas run **one at a time**, each inside its own transaction. If a schema's SQL fails partway through, that schema is rolled back cleanly and the run continues to the next selected schema — a failure in one schema never blocks or corrupts another, and never stops the batch. You'll see each schema's result appear live in the Messages box as it finishes: ✅ success, or ❌ with the actual database error message. When it's done, the full results table is available to copy or download right there.
4. **Messages / Results** — one fixed-height box shared by Check and Continue: it always shows whatever happened most recently.

## Getting help inside the tool

Click **❓ Help** in the sidebar (Streamlit adds it automatically from `pages/1_❓_Help.py`) for: what this tool is and isn't for, how the client-database → schema model works, what a per-schema transaction actually guarantees, and fixes for the most common failures (bad credentials, unreachable control database, a syntax error partway through a pasted script). Most individual controls also have a small "?" tooltip — hover it for a one-line explanation of that specific field.

## What this tool will not do

- It does not remember, between runs, which SQL has already been applied to which schema — there's no migration history. Track that yourself (the same way it's tracked today).
- It does not run schemas in parallel — always one at a time, by design, so results stay simple to read.
- It cannot undo a committed schema. Check first, and read the Messages box before clicking Continue.
