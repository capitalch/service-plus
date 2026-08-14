"""Streamlit auto-adds this as a sidebar page from its filename/pages/ location.
See DESIGN.md §9."""

import streamlit as st

st.set_page_config(page_title="Migration Tool — Help", page_icon="❓")

st.title("❓ Help")

st.header("What this tool is for")
st.markdown(
    """
There is no migration runner in the service-plus stack — a schema change made
after a tenant already exists has to be hand-applied per schema. This tool
runs a SQL script you provide against a chosen set of BU schemas, across a
chosen set of client databases, one schema at a time, showing success or
failure for each.

**What it is not**: a versioned migration framework. It does not track which
SQL has already been applied to a schema between separate runs of this tool —
that's still on you to track, the same as today.
"""
)

st.header("The client → database → schema model")
st.markdown(
    """
- One **control database** (default name `service_plus_client`) lists every
  active client and the name of that client's own database (`public.client`).
- Each client has its **own, separate PostgreSQL database** — reachable on the
  *same* host/port/user/password as the control database, per your `.env`.
  Only the database name differs per client.
- Inside each client's database, every schema *except* `security` is a BU
  (business unit) — that's what "schema" means throughout this tool. `security`
  is never shown as a target because it's never a BU.
"""
)

st.header("What a per-schema transaction guarantees")
st.markdown(
    """
The SQL you provide runs as **one transaction per schema**: if any statement
in it fails partway through, everything already done for *that schema* is
rolled back — that schema is left exactly as it was before the run. Other
selected schemas are unaffected either way, and the run continues to the next
one regardless of whether the current schema succeeded or failed.

There is **no undo for a schema that committed successfully**. The **Check**
button dry-runs the SQL against every selected target and rolls back —
nothing is written — so a syntax or semantic error surfaces before
**Continue** runs (and commits) for real. Read the Messages/Results box
carefully before clicking Check, and again before clicking Continue.
"""
)

st.header("Troubleshooting")

with st.expander("\"Connection failed\" in the sidebar"):
    st.markdown(
        """
- Check `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` in your `.env` — copy
  `.env.example` to `.env` if you haven't yet.
- Confirm you have network access to that Postgres host from where you're
  running this tool (VPN, firewall rules, etc.).
- Confirm the **control database name** field in the sidebar's Connect section
  is actually correct for the environment you're targeting — it defaults to
  `service_plus_client` but can be changed.
"""
    )

with st.expander("A client shows 0 schemas"):
    st.markdown(
        """
That client's database has no schemas other than `security` (and Postgres'
own system schemas, which are also always hidden) — i.e. no BU has been
provisioned in it yet. Nothing to select there; that's not an error.
"""
    )

with st.expander("A schema shows ❌ failed after Check or Continue"):
    st.markdown(
        """
The error message shown is the real database error (from Postgres, via
`psycopg`) for that schema — read it directly, it's not summarized or
translated. Common causes: the SQL assumes an object that doesn't exist yet in
that particular schema (e.g. an older tenant missing a column a newer one
has), or a genuine syntax error in the SQL you provided. That schema was
rolled back cleanly; fix the issue and re-check against just that schema if
needed (deselect the others in the sidebar's Targets section).
"""
    )

with st.expander("Can I run this against just one schema to test first?"):
    st.markdown(
        """
Yes — the sidebar's Targets section lets you select any subset, down to a
single schema. Testing against one schema before selecting "all" for a client
is a reasonable way to de-risk a run, even though the tool doesn't force that
workflow on you.
"""
    )
