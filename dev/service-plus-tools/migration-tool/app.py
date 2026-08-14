"""Migration Tool — Streamlit entrypoint.

A dashboard, not a wizard: Connect and Select targets live in the sidebar
(which scrolls independently of the main panel, so it never grows the main
page). The main panel is one screen — a fixed-height SQL box, a Check/Continue
button row, and a fixed-height Messages/Results box — implementing the flow
in DESIGN.md §7. Controls are always visible; Check/Continue are disabled
(not hidden) until their prerequisites are met. State lives in
st.session_state since Streamlit re-runs this whole script on every
interaction.
"""

import streamlit as st

from config import ConfigError, load_settings
from db import check_sql_in_schema, list_client_dbs, list_schemas, run_sql_in_schema, test_connection
from models import ClientDb, SchemaTarget

st.set_page_config(page_title="Migration Tool", page_icon="🛠️", layout="wide")

# Streamlit reserves several rems above the first element for its toolbar;
# shrinking that pulls the title up so it isn't the thing pushing everything
# else below the fold. The toolbar itself (Deploy button, "⋮" main menu) is
# hidden via .streamlit/config.toml (client.toolbarMode = "minimal"), not CSS,
# since that survives Streamlit version upgrades better than a class-name
# selector would.
st.markdown("<style>div.block-container{padding-top:0.5rem;}</style>", unsafe_allow_html=True)

DEFAULT_CONTROL_DB_NAME = "service_plus_client"


def _init_state() -> None:
    defaults = {
        "settings": None,
        "settings_error": None,
        "control_db_name": DEFAULT_CONTROL_DB_NAME,
        "connected": False,
        "client_dbs": [],
        "schemas_by_client_id": {},  # client.id -> list[str]
        "selected_targets": [],
        "sql_text": "",
        "uploader_version": 0,  # bumped on Clear to force a fresh st.file_uploader widget
        "check_results": [],
        "checked_key": None,
        "last_action": None,  # "check" | "run" | None — which output the Messages panel shows
        "results": [],
        "running": False,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _reset_all() -> None:
    """on_click callback for the sidebar Reset button — clears every key,
    including the dynamic per-schema checkbox keys from Select targets, so the
    next rerun repopulates clean defaults via _init_state()."""
    for key in list(st.session_state.keys()):
        del st.session_state[key]


def _load_settings_once():
    if st.session_state.settings is not None or st.session_state.settings_error is not None:
        return
    try:
        st.session_state.settings = load_settings()
    except ConfigError as e:
        st.session_state.settings_error = str(e)


def sidebar_connect() -> bool:
    """Returns True once a successful connection has populated client_dbs."""
    st.markdown("**Connect**")

    if st.session_state.settings_error:
        st.error(st.session_state.settings_error)
        st.stop()

    st.text_input(
        "Control database name",
        key="control_db_name",
        help=(
            "The one database that lists every client and its own database name "
            "(public.client). Defaults to service_plus_client — change this only "
            "if you're pointing at a different environment. See DESIGN.md §2/§5."
        ),
    )

    col_test, col_reset = st.columns(2)
    test_clicked = col_test.button("Test Connection", type="primary", use_container_width=True)
    col_reset.button(
        "🔄 Reset",
        on_click=_reset_all,
        use_container_width=True,
        help="Clear all selections, SQL, and results and start over.",
    )

    if test_clicked:
        with st.spinner("Connecting..."):
            try:
                test_connection(st.session_state.settings, st.session_state.control_db_name)
                st.session_state.client_dbs = list_client_dbs(
                    st.session_state.settings, st.session_state.control_db_name
                )
                st.session_state.connected = True
            except Exception as e:  # noqa: BLE001 - shown to the user verbatim, not swallowed
                st.session_state.connected = False
                st.error(f"Connection failed: {e}")

    if st.session_state.connected:
        st.success(f"Connected — {len(st.session_state.client_dbs)} active client(s).")
    return st.session_state.connected


def _apply_select_all(client_id: int, schema_names: list[str]) -> None:
    """on_change callback for a client's "select all" checkbox — runs before the
    rerun that redraws the per-schema checkboxes, so writing their session_state
    values here is what actually drives them (see sidebar_select_targets)."""
    new_value = st.session_state[f"all_{client_id}"]
    for schema_name in schema_names:
        st.session_state[f"schema_{client_id}_{schema_name}"] = new_value


def _apply_select_all_everywhere() -> None:
    """on_change callback for the top-level "select all schemas in all clients"
    checkbox. Relies on schemas_by_client_id already being populated for every
    client from the previous render — safe, since on_change only fires on a
    user interaction, which necessarily comes after sidebar_select_targets has
    already run at least once (see sidebar_select_targets)."""
    new_value = st.session_state["select_all_everywhere"]
    for client in st.session_state.client_dbs:
        st.session_state[f"all_{client.id}"] = new_value
        for schema_name in st.session_state.schemas_by_client_id.get(client.id, []):
            st.session_state[f"schema_{client.id}_{schema_name}"] = new_value


def sidebar_select_targets(connected: bool) -> None:
    """Populates st.session_state.selected_targets. The `security` schema
    (and Postgres system schemas) is never shown — it's never a migration
    target. See DESIGN.md §2."""
    st.markdown("**Targets**")

    if not connected:
        st.caption("Connect above to see clients and their schemas.")
        st.session_state.selected_targets = []
        return

    st.checkbox(
        "Select all schemas in all clients",
        key="select_all_everywhere",
        on_change=_apply_select_all_everywhere,
        help="Overrides every per-client and per-schema checkbox below.",
    )

    selected: list[SchemaTarget] = []
    for client in st.session_state.client_dbs:
        client: ClientDb
        if client.id not in st.session_state.schemas_by_client_id:
            try:
                st.session_state.schemas_by_client_id[client.id] = list_schemas(
                    st.session_state.settings, client.db_name
                )
            except Exception as e:  # noqa: BLE001
                st.session_state.schemas_by_client_id[client.id] = []
                st.warning(f"Could not list schemas for {client.name} ({client.db_name}): {e}")

        schemas = st.session_state.schemas_by_client_id[client.id]
        with st.expander(f"{client.name}  ·  {len(schemas)} schema(s)"):
            if not schemas:
                st.caption("No BU schemas found.")
                continue
            # Once a checkbox with a given `key` has rendered, Streamlit ignores
            # `value=` on later reruns and reads from session_state instead — so
            # driving the per-schema checkboxes off `select_all`'s return value
            # is a no-op after the first render. `on_change` fires *before* the
            # rerun that redraws them, so writing straight into session_state
            # here is what actually makes "select all" take effect.
            st.checkbox(
                "Select all for this client",
                key=f"all_{client.id}",
                on_change=_apply_select_all,
                args=(client.id, schemas),
            )
            for schema_name in schemas:
                key = f"schema_{client.id}_{schema_name}"
                checked = st.checkbox(schema_name, key=key)
                if checked:
                    selected.append(SchemaTarget(client=client, schema_name=schema_name))

    st.session_state.selected_targets = selected
    n_clients = len({t.client.id for t in selected})
    st.caption(f"**{len(selected)}** schema(s) selected across **{n_clients}** client(s).")


def _current_check_key() -> tuple:
    """Identifies "what would Continue run right now" — the SQL text plus the
    exact target set. Comparing this to the key stored at the last successful
    Check is how the Messages panel detects a stale check (SQL or targets
    changed since)."""
    return (
        st.session_state.sql_text,
        tuple(sorted((t.client.id, t.schema_name) for t in st.session_state.selected_targets)),
    )


def _render_results_table(results, *, show_download: bool) -> None:
    rows = [
        {
            "Client": r.target.client.name,
            "Schema": r.target.schema_name,
            "Status": "✅ success" if r.success else "❌ failed",
            "Error": r.error_message or "",
            "Seconds": round(r.duration_seconds, 2),
        }
        for r in results
    ]
    st.dataframe(rows, use_container_width=True)
    n_ok = sum(1 for r in results if r.success)
    n_fail = len(results) - n_ok
    st.write(f"**{n_ok} succeeded, {n_fail} failed.**")
    if show_download and rows:
        import csv
        import io

        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        st.download_button(
            "Download results (.csv)",
            buf.getvalue(),
            file_name="migration_results.csv",
            # Streamlit's auto-generated element ID doesn't vary with `data`, only
            # with stable args like label/file_name — so on a multi-target run,
            # every loop iteration (same label, same file_name, growing CSV) would
            # collide without an explicit key. len(rows) strictly increases by one
            # each call within a single script run, so it's always unique here.
            key=f"results_download_{len(rows)}",
        )


def render_sql_panel() -> None:
    """The main panel: SQL box + Check/Continue buttons on the left, the
    shared Messages/Results box on the right — side by side to use the wide
    layout instead of stacking. Everything always renders — Check and
    Continue are disabled via their `disabled=` argument until ready, rather
    than hidden."""
    col_sql, col_msgs = st.columns([3, 2], gap="medium")

    with col_sql:
        col_source, col_clear = st.columns([4, 1])
        mode = col_source.radio(
            "Source", ["Paste SQL", "Load .sql file"], horizontal=True, label_visibility="collapsed"
        )
        if col_clear.button("Clear", use_container_width=True, help="Clear the SQL text and any loaded file."):
            st.session_state.sql_text = ""
            st.session_state.uploader_version += 1

        if mode == "Paste SQL":
            st.session_state.sql_text = st.text_area(
                "SQL",
                value=st.session_state.sql_text,
                height=260,
                label_visibility="collapsed",
                placeholder="ALTER TABLE ...;\n\nINSERT INTO ... VALUES (...) ON CONFLICT DO NOTHING;",
            )
            st.caption(
                "Press **Ctrl+Enter** (⌘+Enter on Mac) after pasting, or click outside the box, to apply it — "
                "Check SQL stays disabled until the text is applied."
            )
        else:
            uploaded = st.file_uploader(
                "SQL file",
                type=["sql"],
                label_visibility="collapsed",
                key=f"sql_file_{st.session_state.uploader_version}",
            )
            if uploaded is not None:
                st.session_state.sql_text = uploaded.read().decode("utf-8")
            if st.session_state.sql_text:
                st.text_area(
                    "Loaded SQL (read-only preview)",
                    value=st.session_state.sql_text,
                    height=260,
                    disabled=True,
                    label_visibility="collapsed",
                )

        targets = st.session_state.selected_targets
        has_sql = bool(st.session_state.sql_text.strip())
        ready_to_check = st.session_state.connected and bool(targets) and has_sql

        current_key = _current_check_key()
        stale = st.session_state.checked_key is not None and st.session_state.checked_key != current_key
        checked_fresh = st.session_state.checked_key == current_key and bool(st.session_state.check_results)
        ready_to_continue = (
            checked_fresh
            and all(r.success for r in st.session_state.check_results)
            and not st.session_state.running
        )

        col_check, col_continue = st.columns(2)
        check_clicked = col_check.button(
            "Check SQL",
            disabled=not ready_to_check or st.session_state.running,
            use_container_width=True,
            help=(
                "Dry-runs this SQL against every selected target, inside a transaction "
                "that is always rolled back — nothing is committed. Confirms the SQL "
                "is valid before Continue runs (and commits) for real."
            ),
        )
        continue_clicked = col_continue.button(
            f"Continue — {len(targets)} schema(s)",
            type="primary",
            disabled=not ready_to_continue,
            use_container_width=True,
            help="Runs the checked SQL for real — COMMIT on success per schema, ROLLBACK on failure.",
        )
        if not ready_to_check and not st.session_state.running:
            missing = []
            if not st.session_state.connected:
                missing.append("connect")
            if not targets:
                missing.append("select at least one target")
            if not has_sql:
                missing.append("provide SQL")
            if missing:
                st.caption(f"Check SQL needs you to: {', '.join(missing)}.")

    with col_msgs:
        st.markdown("**Messages / Results**")
        box = st.container(height=360, border=True)
        placeholder = box.empty()

        def render_messages() -> None:
            with placeholder.container():
                if st.session_state.last_action == "run" and st.session_state.results:
                    _render_results_table(st.session_state.results, show_download=True)
                elif st.session_state.last_action == "check" and st.session_state.check_results:
                    if stale:
                        st.warning(
                            "SQL or target selection changed since the last check — check again before continuing."
                        )
                    elif all(r.success for r in st.session_state.check_results):
                        st.success(f"SQL ok — will run on {len(st.session_state.check_results)} schema(s).")
                    else:
                        n_fail = sum(1 for r in st.session_state.check_results if not r.success)
                        st.error(f"{n_fail} of {len(st.session_state.check_results)} schema(s) failed the check.")
                        _render_results_table(st.session_state.check_results, show_download=False)
                else:
                    st.caption("Nothing to show yet — connect, select targets, and provide SQL, then click Check SQL.")

        if check_clicked:
            st.session_state.last_action = "check"
            results = []
            progress = st.progress(0.0)
            for i, target in enumerate(targets, start=1):
                with st.spinner(f"Checking {target.label} ({i}/{len(targets)})..."):
                    results.append(check_sql_in_schema(st.session_state.settings, target, st.session_state.sql_text))
                progress.progress(i / len(targets))
            st.session_state.check_results = results
            st.session_state.checked_key = current_key
            # The Check/Continue buttons above were already drawn this run with
            # Continue's `disabled=` computed from the *pre-check* checked_key —
            # Streamlit doesn't re-render an already-drawn widget mid-script, so
            # without forcing a fresh rerun here, Continue stays (visually) disabled
            # until some unrelated later interaction happens to rerun the script.
            st.rerun()
        elif continue_clicked:
            st.session_state.last_action = "run"
            st.session_state.results = []
            st.session_state.running = True
            progress = st.progress(0.0)
            total = len(targets)
            # Sequential, one schema at a time — DESIGN.md §3/§8. Each target's
            # result is appended and re-rendered immediately so progress is live,
            # not only visible once the whole batch finishes.
            for i, target in enumerate(targets, start=1):
                with st.spinner(f"Running on {target.label} ({i}/{total})..."):
                    result = run_sql_in_schema(st.session_state.settings, target, st.session_state.sql_text)
                st.session_state.results.append(result)
                render_messages()
                progress.progress(i / total)
            st.session_state.running = False
        else:
            render_messages()


def main() -> None:
    _init_state()
    _load_settings_once()

    with st.sidebar:
        connected = sidebar_connect()
        st.divider()
        sidebar_select_targets(connected)

    st.title("🛠️ Migration Tool")
    st.caption("SQL against selected BU schemas, one schema at a time, each in its own transaction.")

    render_sql_panel()


if __name__ == "__main__":
    main()
