"""Step 11 test for the Extended Warranty SQL store — plans/plan-ew-final.md §D3.1, tests 1–13,
plus a smoke run of every read (R).

Runs the real statements from app/db/sql/sql_extended_warranty.py against a real BU schema.
Every test runs inside BEGIN … ROLLBACK, so nothing is kept — except test 5, which needs two
sessions to see the same lead: it commits one fixture lead (full_name 'EW SQL TEST') and
deletes it, with its messages and events, in a finally block.

Scope notes:
- Test 1 feeds TRANSITION_EW_LEAD the allowed-from list the Step 12 resolver computes from
  EW_TRANSITIONS (the table below is §C2.3). The resolver-level run is Step 12.
- Test 10 covers the SQL of an interest and of the alert row; "exactly one alert per first
  tap" is resolver logic and is tested in Step 12.
- Test 11 covers the SQL half (the lead/message binding); the token half needs sign_ew /
  verify_ew and runs in Step 12.

Usage (from service-plus-server/, inside the venv; the DB settings come from .env):
    python scripts/ew_sql_test.py [db_name] [schema]      # default: service_plus_demo demo1

Needs at least one row in branch and brand. Exit code 0 = every check passed.
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg  # noqa: E402
import psycopg.sql as pgsql  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

from app.db.connection.psycopg_driver import get_service_db_connection  # noqa: E402
from app.db.sql.sql_extended_warranty import ExtendedWarrantyServerSql as W  # noqa: E402
from app.db.sql.sql_extended_warranty import ExtendedWarrantySql as R  # noqa: E402

DB_NAME = sys.argv[1] if len(sys.argv) > 1 else "service_plus_demo"
SCHEMA = sys.argv[2] if len(sys.argv) > 2 else "demo1"

CLOSED = {"CANCELLED", "LOST", "WON"}
STATES = ["NEW_LEAD", "MESSAGE_SENT", "INTERESTED", "IN_PROGRESS", "WON", "LOST", "CANCELLED"]
# §C2.3 as the server enforces it — NEW_LEAD → MESSAGE_SENT happens only by sending.
TRANSITIONS = {
    "CANCELLED": {"IN_PROGRESS"},
    "IN_PROGRESS": {"CANCELLED", "LOST", "WON"},
    "INTERESTED": {"CANCELLED", "IN_PROGRESS", "LOST", "WON"},
    "LOST": {"IN_PROGRESS", "WON"},
    "MESSAGE_SENT": {"CANCELLED", "IN_PROGRESS", "INTERESTED", "LOST", "WON"},
    "NEW_LEAD": {"CANCELLED", "IN_PROGRESS", "LOST", "WON"},
    "WON": set(),
}
RANK = {"ACCEPTED": 1, "DELIVERED": 3, "FAILED": 9, "PENDING": 0, "READ": 4, "SENT": 2}

_results: list[tuple[str, bool]] = []


def check(name: str, ok: bool, detail: object = "") -> None:
    _results.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + ("" if ok else f"  — {detail}"))


# ── Helpers ───────────────────────────────────────────────────────────────────


async def q(conn, sql, args=None) -> list[dict]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, args if args is not None else {})
        return await cur.fetchall() if cur.description else []


async def raises(conn, sql, args=None) -> str | None:
    """Runs `sql` in a savepoint; returns the error class name, or None when it succeeded."""
    try:
        async with conn.transaction(force_rollback=True):
            await q(conn, sql, args)
    except psycopg.Error as e:
        return type(e).__name__
    return None


async def new_lead(ctx, *, created_at=None, days_left=20, mobile="9000000001", opted_out=False,
                   stage=None, state="NEW_LEAD") -> int:
    """Inserts a fixture lead directly (tests only — the app never writes state this way)."""
    if stage is None and state == "IN_PROGRESS":
        stage = 1
    rows = await q(ctx.conn, """
        INSERT INTO ew_lead (branch_id, full_name, mobile, brand_id, serial_no, warranty_end_date,
                             state, progress_stage, closed_at, is_opted_out, created_at)
        VALUES (%(branch_id)s::bigint, 'EW SQL TEST', %(mobile)s::text, %(brand_id)s::bigint,
                %(serial_no)s::text, CURRENT_DATE + %(days_left)s::int, %(state)s::text,
                %(stage)s::smallint,
                CASE WHEN %(state)s::text IN ('WON', 'LOST', 'CANCELLED') THEN now() END,
                %(opted_out)s::boolean, COALESCE(%(created_at)s::timestamptz, now()))
        RETURNING id
    """, {"branch_id": ctx.branch_id, "brand_id": ctx.brand_id, "created_at": created_at,
          "days_left": days_left, "mobile": mobile, "opted_out": opted_out,
          "serial_no": f"EWT-{uuid4().hex[:12]}", "stage": stage, "state": state})
    return rows[0]["id"]


async def add_msg(ctx, lead_id, *, band="D8_30", kind="REMINDER", sent_at=None, status="ACCEPTED",
                  wamid=None) -> int:
    rows = await q(ctx.conn, """
        INSERT INTO ew_message (ew_lead_id, kind, band, delivery_status, status_rank, wamid, sent_at)
        VALUES (%(lead)s::bigint, %(kind)s::text, %(band)s::text, %(status)s::text, %(rank)s::smallint,
                %(wamid)s::text, COALESCE(%(sent_at)s::timestamptz, now()))
        RETURNING id
    """, {"band": None if kind == "LEAD_ALERT" else band, "kind": kind, "lead": lead_id,
          "rank": RANK[status], "sent_at": sent_at, "status": status, "wamid": wamid})
    return rows[0]["id"]


async def view(ctx, lead_id) -> dict:
    return (await q(ctx.conn, "SELECT * FROM ew_lead_view WHERE id = %(id)s::bigint", {"id": lead_id}))[0]


async def events(ctx, lead_id, event_type=None) -> list[dict]:
    return await q(ctx.conn, """
        SELECT * FROM ew_lead_event
        WHERE ew_lead_id = %(id)s::bigint AND (%(t)s::text IS NULL OR event_type = %(t)s::text)
        ORDER BY id
    """, {"id": lead_id, "t": event_type})


async def set_days_left(ctx, lead_id, days_left) -> None:
    await q(ctx.conn, "UPDATE ew_lead SET warranty_end_date = CURRENT_DATE + %(d)s::int WHERE id = %(id)s::bigint",
            {"d": days_left, "id": lead_id})


def allowed_from_for(to_state, progress_stage) -> list[str]:
    """What the Step 12 resolver will send: stage advance → [IN_PROGRESS], else the inverse table."""
    if to_state == "IN_PROGRESS" and progress_stage in (2, 3):
        return ["IN_PROGRESS"]
    return [s for s, targets in TRANSITIONS.items() if to_state in targets]


def claim_args(ctx, lead_id, branch_id=None) -> dict:
    return {"branch_id": branch_id or ctx.branch_id, "ew_lead_id": lead_id, "sent_by": None,
            "sent_by_name": "EW SQL test"}


def transition_args(ctx, lead_id, to_state, progress_stage=None, allowed_from=None) -> dict:
    return {"allowed_from": allowed_from if allowed_from is not None else allowed_from_for(to_state, progress_stage),
            "branch_id": ctx.branch_id, "by": None, "by_name": "EW SQL test", "ew_lead_id": lead_id,
            "notes": None, "progress_stage": progress_stage, "to_state": to_state}


def follow_up_args(ctx, lead_id, *, next_at=None, stage=None) -> dict:
    return {"action": "CALL", "branch_id": ctx.branch_id, "by": None, "by_name": "EW SQL test",
            "ew_lead_id": lead_id, "next_follow_up_at": next_at, "notes": "test follow-up",
            "progress_stage": stage}


def paged_args(ctx, **overrides) -> dict:
    args = {"band": None, "branch_id": ctx.branch_id, "follow_up_due": None, "is_closed": None, "limit": 50,
            "message_group": None, "offset": 0, "progress_stage": None, "search": None, "state": None}
    args.update(overrides)
    return args


async def dashboard(ctx) -> dict:
    return (await q(ctx.conn, R.GET_EW_DASHBOARD, {"branch_id": ctx.branch_id}))[0]


# ── Tests ─────────────────────────────────────────────────────────────────────


async def test_1_transition_matrix(ctx):
    bad = []
    for frm in STATES:
        for to in STATES:
            async with ctx.conn.transaction(force_rollback=True):
                lead_id = await new_lead(ctx, state=frm)
                rows = await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, to))
                after = await view(ctx, lead_id)
                expected = to in TRANSITIONS[frm]
                if bool(rows) != expected:
                    bad.append(f"{frm}→{to} {'moved' if rows else 'refused'}")
                    continue
                if not expected:
                    if after["state"] != frm:
                        bad.append(f"{frm}→{to} refused but state is {after['state']}")
                    continue
                problems = []
                if after["state"] != to:
                    problems.append(f"state {after['state']}")
                if after["progress_stage"] != (1 if to == "IN_PROGRESS" else None):
                    problems.append(f"stage {after['progress_stage']}")
                if (after["closed_at"] is not None) != (to in CLOSED):
                    problems.append("closed_at")
                if to == "INTERESTED" and after["interest_at"] is None:
                    problems.append("interest_at not set")
                evs = await events(ctx, lead_id)
                if [(e["event_type"], e["from_state"], e["to_state"]) for e in evs] != [("STATE_CHANGE", frm, to)]:
                    problems.append(f"events {evs}")
                if problems:
                    bad.append(f"{frm}→{to}: " + ", ".join(problems))
    check("all 49 (from, to) pairs behave exactly as §C2.3, with the right side effects", not bad, "; ".join(bad))
    check("MESSAGE_SENT is never a transition target", all("MESSAGE_SENT" not in t for t in TRANSITIONS.values()))


async def test_2_is_closed(ctx):
    lead_id = await new_lead(ctx)
    check("is_closed is false for New Lead", (await view(ctx, lead_id))["is_closed"] is False)
    await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, "WON"))
    check("is_closed becomes true on Won", (await view(ctx, lead_id))["is_closed"] is True)
    err = await raises(ctx.conn, "UPDATE ew_lead SET is_closed = false WHERE id = %(id)s::bigint", {"id": lead_id})
    check("writing is_closed is refused", err is not None, "the UPDATE succeeded")


async def test_3_checks(ctx):
    new_id = await new_lead(ctx)
    ip_id = await new_lead(ctx, state="IN_PROGRESS")
    cases = [
        ("In Progress without a stage", "UPDATE ew_lead SET state = 'IN_PROGRESS' WHERE id = %(id)s::bigint", new_id),
        ("a stage outside In Progress", "UPDATE ew_lead SET progress_stage = 2 WHERE id = %(id)s::bigint", new_id),
        ("stage 4", "UPDATE ew_lead SET progress_stage = 4 WHERE id = %(id)s::bigint", ip_id),
        ("Won without closed_at", "UPDATE ew_lead SET state = 'WON' WHERE id = %(id)s::bigint", new_id),
        ("closed_at on an open lead", "UPDATE ew_lead SET closed_at = now() WHERE id = %(id)s::bigint", new_id),
        ("an unknown state", "UPDATE ew_lead SET state = 'FOO' WHERE id = %(id)s::bigint", new_id),
        ("an unknown preferred_contact",
         "UPDATE ew_lead SET preferred_contact = 'EMAIL' WHERE id = %(id)s::bigint", new_id),
    ]
    cases += [
        ("a REMINDER without a band",
         "INSERT INTO ew_message (ew_lead_id, kind, band) VALUES (%(id)s::bigint, 'REMINDER', NULL)", new_id),
        ("a LEAD_ALERT with a band",
         "INSERT INTO ew_message (ew_lead_id, kind, band) VALUES (%(id)s::bigint, 'LEAD_ALERT', 'D0_7')", new_id),
    ]
    for label, sql, lead_id in cases:
        err = await raises(ctx.conn, sql, {"id": lead_id})
        check(f"CHECK refuses {label}", err == "CheckViolation", err or "the statement succeeded")


async def test_4_stages(ctx):
    lead_id = await new_lead(ctx, state="IN_PROGRESS")
    rows = await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, "IN_PROGRESS", 2))
    check("Stage 1 → 2", rows and rows[0]["progress_stage"] == 2, rows)
    rows = await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, "IN_PROGRESS", 3))
    check("Stage 2 → 3", rows and rows[0]["progress_stage"] == 3, rows)
    stage_events = await events(ctx, lead_id, "STAGE_CHANGE")
    check("each advance logs a STAGE_CHANGE event", len(stage_events) == 2, stage_events)
    rows = await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, "IN_PROGRESS", 2))
    check("Stage 3 → 2 refused", not rows, rows)
    rows = await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, "IN_PROGRESS", 3))
    check("Stage 3 → 3 refused", not rows, rows)

    rows = await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, lead_id, stage=1))
    after = await view(ctx, lead_id)
    check("a follow-up with a lower stage keeps the higher one",
          rows and after["progress_stage"] == 3 and after["follow_up_count"] == 1, after)

    lead2 = await new_lead(ctx, state="IN_PROGRESS")
    await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, lead2, stage=2))
    types = [e["event_type"] for e in await events(ctx, lead2)]
    check("a follow-up that raises the stage logs STAGE_CHANGE + FOLLOW_UP",
          (await view(ctx, lead2))["progress_stage"] == 2 and sorted(types) == ["FOLLOW_UP", "STAGE_CHANGE"], types)

    next_at = datetime.now(timezone.utc) + timedelta(days=1)
    await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, lead2, next_at=next_at))
    check("a follow-up sets next_follow_up_at", (await view(ctx, lead2))["next_follow_up_at"] is not None)
    await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, lead2, next_at=None))
    check("a follow-up with no next date clears it", (await view(ctx, lead2))["next_follow_up_at"] is None)

    await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, lead2, next_at=next_at))
    await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead2, "WON"))
    after = await view(ctx, lead2)
    check("leaving In Progress clears the stage and the next follow-up",
          after["progress_stage"] is None and after["next_follow_up_at"] is None, after)

    new_id = await new_lead(ctx)
    rows = await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, new_id))
    check("a follow-up outside In Progress returns no row", not rows, rows)

    interested = await new_lead(ctx, state="INTERESTED")
    rows = await q(ctx.conn, W.TRANSITION_EW_LEAD,
                   transition_args(ctx, interested, "IN_PROGRESS", 3, allowed_from=["INTERESTED"]))
    check("entering In Progress always starts at Stage 1 (D3), even if a stage is passed",
          rows and rows[0]["progress_stage"] == 1, rows)


async def test_5_concurrent_claim(ctx, conn_b):
    """Two sessions claim the same lead at once → one message, one event."""
    lead_id = None
    task = None
    try:
        lead_id = await new_lead(ctx)  # autocommit → committed, so session B can see it
        async with ctx.conn.transaction():  # session A holds its claim uncommitted
            first = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
            task = asyncio.create_task(q(conn_b, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id)))
            await asyncio.sleep(1.5)
            waited = not task.done()
        second = await asyncio.wait_for(task, timeout=20)
        counts = (await q(ctx.conn, """
            SELECT (SELECT COUNT(*) FROM ew_message    WHERE ew_lead_id = %(id)s::bigint) AS messages,
                   (SELECT COUNT(*) FROM ew_lead_event WHERE ew_lead_id = %(id)s::bigint) AS events
        """, {"id": lead_id}))[0]
        check("session A gets the claim", len(first) == 1, first)
        check("session B waited for A instead of inserting a second row", waited)
        check("session B gets no row", second == [], second)
        check("exactly one message and one event", counts == {"messages": 1, "events": 1}, counts)
    finally:
        if task and not task.done():
            task.cancel()
        if lead_id:
            await q(ctx.conn, "DELETE FROM ew_lead WHERE id = %(id)s::bigint", {"id": lead_id})
            left = await q(ctx.conn, "SELECT id FROM ew_lead WHERE id = %(id)s::bigint", {"id": lead_id})
            check("fixture lead deleted", left == [], left)


async def test_6_band_guard(ctx):
    lead_id = await new_lead(ctx, days_left=20)
    rows = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    check("first claim in 8–30 succeeds", rows and rows[0]["band"] == "D8_30", rows)
    msg_id = rows[0]["ew_message_id"] if rows else None
    rows = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    check("second claim in the same band is refused", not rows, rows)
    await q(ctx.conn, "UPDATE ew_message SET delivery_status = 'FAILED', status_rank = 9 WHERE id = %(id)s::bigint",
            {"id": msg_id})
    rows = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    check("after FAILED the same band can be claimed again", len(rows) == 1, rows)
    await set_days_left(ctx, lead_id, 3)
    rows = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    check("a new band (0–7) can be claimed", rows and rows[0]["band"] == "D0_7", rows)
    err = await raises(ctx.conn, """
        INSERT INTO ew_message (ew_lead_id, kind, band) VALUES (%(id)s::bigint, 'REMINDER', 'D0_7')
    """, {"id": lead_id})
    check("the unique index refuses a direct duplicate insert", err == "UniqueViolation", err)


async def test_7_can_send_and_bands(ctx):
    for state in ["INTERESTED", "IN_PROGRESS", "WON", "LOST", "CANCELLED"]:
        lead_id = await new_lead(ctx, state=state)
        check(f"can_send is false for {state}", (await view(ctx, lead_id))["can_send"] is False)
    lead_id = await new_lead(ctx, opted_out=True)
    check("can_send is false for an opted-out lead", (await view(ctx, lead_id))["can_send"] is False)
    lead_id = await new_lead(ctx, days_left=-8)
    check("can_send is false at 8 days past expiry", (await view(ctx, lead_id))["can_send"] is False)
    lead_id = await new_lead(ctx, days_left=-7)
    check("can_send is true at 7 days past expiry", (await view(ctx, lead_id))["can_send"] is True)
    lead_id = await new_lead(ctx, days_left=90)
    v = await view(ctx, lead_id)
    check("can_send is true at 90 days left (61+ band)", v["can_send"] is True and v["band"] == "D61_PLUS", v)
    lead_id = await new_lead(ctx, state="MESSAGE_SENT")
    check("can_send is true for Message Sent with nothing sent in this band",
          (await view(ctx, lead_id))["can_send"] is True)

    lead_id = await new_lead(ctx)
    edges = [(61, "D61_PLUS"), (60, "D31_60"), (31, "D31_60"), (30, "D8_30"), (8, "D8_30"),
             (7, "D0_7"), (0, "D0_7"), (-1, "OVERDUE")]
    wrong = []
    for days, band in edges:
        await set_days_left(ctx, lead_id, days)
        v = await view(ctx, lead_id)
        if (v["days_left"], v["band"]) != (days, band):
            wrong.append(f"{days}: {v['days_left']}/{v['band']}")
    check("band edges 61/60/31/30/8/7/0/-1", not wrong, wrong)


async def test_8_claim_moves_state(ctx):
    lead_id = await new_lead(ctx, days_left=20)
    await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    evs = await events(ctx, lead_id)
    check("the claim moves New Lead → Message Sent",
          (await view(ctx, lead_id))["state"] == "MESSAGE_SENT", await view(ctx, lead_id))
    check("…with one STATE_CHANGE event, staff name stamped",
          len(evs) == 1 and evs[0]["to_state"] == "MESSAGE_SENT" and evs[0]["created_by_name"] == "EW SQL test", evs)
    await set_days_left(ctx, lead_id, 3)
    rows = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    check("sending again from Message Sent (new band) keeps the state and adds no event",
          rows and (await view(ctx, lead_id))["state"] == "MESSAGE_SENT" and len(await events(ctx, lead_id)) == 1)
    other = await new_lead(ctx)
    rows = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, other, branch_id=-1))
    v = await view(ctx, other)
    check("a claim with the wrong branch does nothing",
          not rows and v["state"] == "NEW_LEAD" and v["message_count"] == 0, v)


async def test_9_webhook(ctx):
    lead_id = await new_lead(ctx)
    wamid = f"wamid.EWTEST.{uuid4().hex}"
    msg_id = await add_msg(ctx, lead_id, status="PENDING")
    sent = {"error": None, "id": msg_id, "rank": 1, "status": "ACCEPTED", "wamid": wamid}
    check("SET_EW_MESSAGE_SENT settles a PENDING row", len(await q(ctx.conn, W.SET_EW_MESSAGE_SENT, sent)) == 1)
    check("SET_EW_MESSAGE_SENT leaves a non-PENDING row alone", await q(ctx.conn, W.SET_EW_MESSAGE_SENT, sent) == [])

    def outcome(status, w=wamid, error=None):
        return {"error": error, "new_rank": RANK[status], "status": status, "wamid": w}

    rows = await q(ctx.conn, W.SET_EW_MESSAGE_OUTCOME, outcome("READ"))
    check("webhook READ applies", rows and rows[0]["kind"] == "REMINDER", rows)
    rows = await q(ctx.conn, W.SET_EW_MESSAGE_OUTCOME, outcome("DELIVERED"))
    check("a late DELIVERED after READ is ignored",
          not rows and (await view(ctx, lead_id))["last_delivery_status"] == "READ", rows)
    rows = await q(ctx.conn, W.SET_EW_MESSAGE_OUTCOME, outcome("DELIVERED", w=f"wamid.UNKNOWN.{uuid4().hex}"))
    check("an unknown wamid matches no row", not rows, rows)

    failed_wamid = f"wamid.EWTEST.{uuid4().hex}"
    lead_f = await new_lead(ctx)
    await add_msg(ctx, lead_f, wamid=failed_wamid)
    await q(ctx.conn, W.SET_EW_MESSAGE_OUTCOME, outcome("FAILED", w=failed_wamid, error="131026 undeliverable"))
    v = await view(ctx, lead_f)
    check("FAILED stores the error", v["last_delivery_status"] == "FAILED" and v["last_error"], v)

    alert_wamid = f"wamid.EWTEST.{uuid4().hex}"
    alert_id = (await q(ctx.conn, W.CLAIM_EW_LEAD_ALERT,
                        {"error": None, "ew_lead_id": lead_id, "rank": 0, "status": "PENDING"}))[0]["id"]
    await q(ctx.conn, W.SET_EW_MESSAGE_SENT,
            {"error": None, "id": alert_id, "rank": 1, "status": "ACCEPTED", "wamid": alert_wamid})
    rows = await q(ctx.conn, W.SET_EW_MESSAGE_OUTCOME, outcome("DELIVERED", w=alert_wamid))
    v = await view(ctx, lead_id)
    check("the webhook updates a LEAD_ALERT too",
          rows and rows[0]["kind"] == "LEAD_ALERT" and v["alert_status"] == "DELIVERED", rows)
    check("a LEAD_ALERT does not count as a reminder", v["message_count"] == 1, v["message_count"])


async def test_10_interest(ctx):
    lead_id = await new_lead(ctx, state="MESSAGE_SENT")
    msg_id = await add_msg(ctx, lead_id)
    args = {"customer_remarks": "  please call after 5  ", "ew_lead_id": lead_id, "ew_message_id": msg_id,
            "preferred_contact": "CALL"}
    rows = await q(ctx.conn, W.RECORD_EW_INTEREST, args)
    v = await view(ctx, lead_id)
    check("first tap: Message Sent → Interested",
          rows and (rows[0]["from_state"], rows[0]["to_state"]) == ("MESSAGE_SENT", "INTERESTED"), rows)
    check("…interest_at, preferred contact and trimmed remarks stored",
          v["interest_at"] and v["preferred_contact"] == "CALL" and v["customer_remarks"] == "please call after 5", v)
    evs = await events(ctx, lead_id, "INTEREST")
    check("…one INTEREST event carrying the tapped message", len(evs) == 1 and evs[0]["ew_message_id"] == msg_id, evs)
    check("second tap returns no row", await q(ctx.conn, W.RECORD_EW_INTEREST, args) == [])
    check("…and adds no event", len(await events(ctx, lead_id, "INTEREST")) == 1)

    for state, stage in [("IN_PROGRESS", 2), ("LOST", None)]:
        other = await new_lead(ctx, state=state, stage=stage)
        m = await add_msg(ctx, other)
        rows = await q(ctx.conn, W.RECORD_EW_INTEREST, {**args, "ew_lead_id": other, "ew_message_id": m})
        v = await view(ctx, other)
        check(f"a tap on {state} records interest but keeps the state",
              rows and v["state"] == state and v["progress_stage"] == stage and v["interest_at"], v)

    opted = await new_lead(ctx, state="MESSAGE_SENT", opted_out=True)
    m = await add_msg(ctx, opted)
    rows = await q(ctx.conn, W.RECORD_EW_INTEREST, {**args, "ew_lead_id": opted, "ew_message_id": m})
    check("an opted-out lead records nothing", not rows, rows)

    rows = await q(ctx.conn, W.CLAIM_EW_LEAD_ALERT,
                   {"error": "staff_whatsapp_number is not a valid mobile number", "ew_lead_id": lead_id,
                    "rank": 9, "status": "FAILED"})
    v = await view(ctx, lead_id)
    check("a FAILED alert row is visible on the lead",
          rows and v["alert_status"] == "FAILED" and v["alert_error"], v)


async def test_11_public_binding(ctx):
    lead_a = await new_lead(ctx, state="MESSAGE_SENT")
    lead_b = await new_lead(ctx, state="MESSAGE_SENT")
    msg_a = await add_msg(ctx, lead_a)
    msg_b = await add_msg(ctx, lead_b)
    alert_a = await add_msg(ctx, lead_a, kind="LEAD_ALERT")

    def pub(lead, msg):
        return q(ctx.conn, W.GET_EW_LEAD_FOR_PUBLIC, {"ew_lead_id": lead, "ew_message_id": msg})

    rows = await pub(lead_a, msg_a)
    check("matching lead + reminder → page data", len(rows) == 1 and rows[0]["has_interest"] is False, rows)
    check("another lead's message → nothing", await pub(lead_a, msg_b) == [])
    check("a LEAD_ALERT message id → nothing", await pub(lead_a, alert_a) == [])
    check("an unknown lead → nothing", await pub(-1, msg_a) == [])

    rows = await q(ctx.conn, W.SET_EW_OPT_OUT, {"ew_lead_id": lead_a, "ew_message_id": msg_a})
    v = await view(ctx, lead_a)
    check("opt-out sets the flag, keeps the state, and turns can_send off",
          rows and v["is_opted_out"] and v["opted_out_at"] and v["state"] == "MESSAGE_SENT" and not v["can_send"], v)
    check("a second opt-out matches no row",
          await q(ctx.conn, W.SET_EW_OPT_OUT, {"ew_lead_id": lead_a, "ew_message_id": msg_a}) == [])
    check("exactly one OPT_OUT event", len(await events(ctx, lead_a, "OPT_OUT")) == 1)
    print("  NOTE  token tag / tamper / expiry checks run in Step 12 (need sign_ew / verify_ew)")


async def test_12_dashboard_sums(ctx):
    before = await dashboard(ctx)
    for days in (90, 45, 20, 3, -5):
        await new_lead(ctx, days_left=days)
    for status in ("READ", "DELIVERED", "FAILED", "ACCEPTED"):
        await add_msg(ctx, await new_lead(ctx, state="MESSAGE_SENT"), status=status)
    await new_lead(ctx, state="MESSAGE_SENT")  # no reminder yet → Awaiting
    interested = await new_lead(ctx, state="INTERESTED")
    await q(ctx.conn, "UPDATE ew_lead SET interest_at = now() WHERE id = %(id)s::bigint", {"id": interested})
    for stage in (1, 2, 3):
        lead_id = await new_lead(ctx, state="IN_PROGRESS", stage=stage)
        if stage == 2:
            await q(ctx.conn, "UPDATE ew_lead SET next_follow_up_at = now() - interval '1 hour' WHERE id = %(id)s::bigint",
                    {"id": lead_id})
    for state in ("WON", "LOST", "CANCELLED"):
        await new_lead(ctx, state=state)
    after = await dashboard(ctx)
    delta = {k: after[k] - before[k] for k in after}

    pipeline = ["new_all", "sent_all", "interested", "in_progress_all", "won", "lost", "cancelled"]
    check("pipeline states sum to leads_total", sum(after[k] for k in pipeline) == after["leads_total"], after)
    check("message groups sum to sent_all",
          sum(after[f"sent_{g}"] for g in ("awaiting", "delivered", "read", "failed")) == after["sent_all"], after)
    check("bands + 61+ sum to new_all",
          sum(after[f"new_{b}"] for b in ("31_60", "8_30", "0_7", "overdue", "61_plus")) == after["new_all"], after)
    check("stages sum to in_progress_all",
          sum(after[f"in_progress_{s}"] for s in (1, 2, 3)) == after["in_progress_all"], after)
    for p in ("today", "week", "month", "older"):
        parts = sum(after[f"msg_{s}_{p}"] for s in ("read", "delivered", "failed", "awaiting"))
        check(f"{p}: read + delivered + failed + awaiting = total", parts == after[f"msg_total_{p}"], after)

    expected = {"cancelled": 1, "follow_ups_due": 1, "in_progress_1": 1, "in_progress_2": 1, "in_progress_3": 1,
                "interested": 1, "interested_today": 1, "leads_today": 17, "leads_total": 17, "lost": 1,
                "msg_awaiting_today": 1, "msg_delivered_today": 1, "msg_failed_today": 1, "msg_read_today": 1,
                "msg_total_today": 4, "new_0_7": 1, "new_31_60": 1, "new_61_plus": 1, "new_8_30": 1,
                "new_all": 5, "new_overdue": 1, "sent_all": 5, "sent_awaiting": 2, "sent_delivered": 1,
                "sent_failed": 1, "sent_read": 1, "won": 1, "won_today": 1}
    wrong = {k: (delta[k], v) for k, v in expected.items() if delta[k] != v}
    check("each fixture lands in exactly the expected card", not wrong, f"(got, expected): {wrong}")


async def test_13_period_edges(ctx):
    b = (await q(ctx.conn, """
        SELECT date_trunc('day', now()) AS d, date_trunc('week', now()) AS w, date_trunc('month', now()) AS m
    """))[0]
    tick = timedelta(microseconds=1)
    stamps = [b["d"], b["d"] - tick, b["w"], b["w"] - tick, b["m"], b["m"] - tick]
    before = await dashboard(ctx)
    for ts in stamps:
        lead_id = await new_lead(ctx, state="WON", created_at=ts)
        await q(ctx.conn, "UPDATE ew_lead SET closed_at = %(ts)s::timestamptz, interest_at = %(ts)s::timestamptz "
                          "WHERE id = %(id)s::bigint", {"id": lead_id, "ts": ts})
        await add_msg(ctx, lead_id, sent_at=ts, status="READ")
    after = await dashboard(ctx)

    expected = {"today": sum(ts >= b["d"] for ts in stamps), "week": sum(ts >= b["w"] for ts in stamps),
                "month": sum(ts >= b["m"] for ts in stamps), "older": sum(ts < b["m"] for ts in stamps)}
    print(f"  INFO  day starts {b['d']}, week {b['w']}, month {b['m']} → expected per period {expected}")
    wrong = []
    for metric in ("leads", "interested", "won", "msg_total", "msg_read"):
        for period, n in expected.items():
            key = f"{metric}_{period}"
            if after[key] - before[key] != n:
                wrong.append(f"{key}: {after[key] - before[key]} (expected {n})")
    check("midnight / week-start / month-start edges bucket correctly for every metric", not wrong, wrong)


async def test_reads(ctx):
    lead_id = await new_lead(ctx, mobile="9000000777")
    serial = (await view(ctx, lead_id))["serial_no"]
    rows = await q(ctx.conn, R.GET_EW_LEADS_PAGED, paged_args(ctx))
    check("GET_EW_LEADS_PAGED runs with every filter off", rows and rows[0]["total_count"] >= 1, len(rows))
    rows = await q(ctx.conn, R.GET_EW_LEADS_PAGED, paged_args(ctx, search=f"  {serial.lower()} "))
    check("…search by serial finds exactly the fixture (case-insensitive, trimmed)",
          len(rows) == 1 and rows[0]["ew_lead_id"] == lead_id and rows[0]["total_count"] == 1, rows)
    rows = await q(ctx.conn, R.GET_EW_LEADS_PAGED, paged_args(ctx, search=serial, state="WON"))
    check("…filters combine (state WON excludes it)", rows == [], rows)
    due = await new_lead(ctx, state="IN_PROGRESS")
    await q(ctx.conn, "UPDATE ew_lead SET next_follow_up_at = now() - interval '1 day' WHERE id = %(id)s::bigint",
            {"id": due})
    rows = await q(ctx.conn, R.GET_EW_LEADS_PAGED, paged_args(ctx, follow_up_due=True, state="IN_PROGRESS"))
    check("…follow_up_due returns only due In Progress leads",
          any(r["ew_lead_id"] == due for r in rows)
          and all(r["state"] == "IN_PROGRESS" and r["next_follow_up_at"] for r in rows), rows)

    rows = await q(ctx.conn, R.GET_EW_LEAD_DETAIL, {"branch_id": ctx.branch_id, "ew_lead_id": lead_id})
    check("GET_EW_LEAD_DETAIL finds the lead in its branch", len(rows) == 1)
    check("…and with branch null", len(await q(ctx.conn, R.GET_EW_LEAD_DETAIL,
                                               {"branch_id": None, "ew_lead_id": lead_id})) == 1)
    check("…but not in another branch", await q(ctx.conn, R.GET_EW_LEAD_DETAIL,
                                                {"branch_id": -1, "ew_lead_id": lead_id}) == [])

    await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, lead_id))
    await q(ctx.conn, W.TRANSITION_EW_LEAD, transition_args(ctx, lead_id, "IN_PROGRESS"))
    await q(ctx.conn, W.ADD_EW_FOLLOW_UP, follow_up_args(ctx, lead_id))
    rows = await q(ctx.conn, R.GET_EW_LEAD_TIMELINE, {"ew_lead_id": lead_id})
    sources = sorted((r["source"], r["item_type"]) for r in rows)
    check("GET_EW_LEAD_TIMELINE merges messages and events",
          sources == [("EVENT", "FOLLOW_UP"), ("EVENT", "STATE_CHANGE"), ("EVENT", "STATE_CHANGE"),
                      ("MESSAGE", "MESSAGE")], sources)

    await new_lead(ctx, mobile="9000000777")
    rows = await q(ctx.conn, R.GET_EW_LEAD_BY_MOBILE, {"mobile": " 9000000777 "})
    check("GET_EW_LEAD_BY_MOBILE returns earlier leads first, at most 5",
          2 <= len(rows) <= 5 and rows[0]["source"] == "EW" and rows[0]["brand_id"] == ctx.brand_id, rows)
    check("…blank mobile returns nothing", await q(ctx.conn, R.GET_EW_LEAD_BY_MOBILE, {"mobile": "  "}) == [])

    before = (await q(ctx.conn, R.COUNT_EW_OPEN_INTEREST, {"branch_id": ctx.branch_id}))[0]["open_interest"]
    await new_lead(ctx, state="INTERESTED")
    after = (await q(ctx.conn, R.COUNT_EW_OPEN_INTEREST, {"branch_id": ctx.branch_id}))[0]["open_interest"]
    check("COUNT_EW_OPEN_INTEREST counts Interested", after - before == 1, (before, after))

    sendable = await new_lead(ctx)
    won = await new_lead(ctx, state="WON")
    rows = await q(ctx.conn, W.GET_EW_LEADS_FOR_SEND, {"branch_id": ctx.branch_id, "ew_lead_ids": [sendable, won]})
    check("GET_EW_LEADS_FOR_SEND keeps only sendable leads", [r["ew_lead_id"] for r in rows] == [sendable], rows)
    rows = await q(ctx.conn, W.GET_EW_LEADS_FOR_SEND, {"branch_id": -1, "ew_lead_ids": [sendable]})
    check("…and only in the given branch", rows == [], rows)

    before = (await q(ctx.conn, W.GET_EW_SENT_TODAY_COUNT))[0]["sent_today"]
    claimed = await q(ctx.conn, W.CLAIM_EW_REMINDER, claim_args(ctx, sendable))
    mid = (await q(ctx.conn, W.GET_EW_SENT_TODAY_COUNT))[0]["sent_today"]
    await q(ctx.conn, "UPDATE ew_message SET delivery_status = 'FAILED', status_rank = 9 WHERE id = %(id)s::bigint",
            {"id": claimed[0]["ew_message_id"]})
    end = (await q(ctx.conn, W.GET_EW_SENT_TODAY_COUNT))[0]["sent_today"]
    check("GET_EW_SENT_TODAY_COUNT counts today's reminders, not FAILED ones",
          (mid - before, end - before) == (1, 0), (before, mid, end))

    user = await q(ctx.conn, 'SELECT id, full_name FROM security."user" ORDER BY id LIMIT 1')
    if user:
        rows = await q(ctx.conn, W.GET_EW_STAFF_NAME, {"user_id": user[0]["id"]})
        check("GET_EW_STAFF_NAME returns the user's full name", rows == [{"full_name": user[0]["full_name"]}], rows)


TESTS = [
    ("Test 1 — transition matrix", test_1_transition_matrix),
    ("Test 2 — is_closed is generated", test_2_is_closed),
    ("Test 3 — CHECK constraints", test_3_checks),
    ("Test 4 — stages and follow-ups", test_4_stages),
    ("Test 5 — concurrent claim (two sessions)", None),
    ("Test 6 — once per band", test_6_band_guard),
    ("Test 7 — can_send and band edges", test_7_can_send_and_bands),
    ("Test 8 — the claim moves the state once", test_8_claim_moves_state),
    ("Test 9 — webhook outcome", test_9_webhook),
    ("Test 10 — customer interest", test_10_interest),
    ("Test 11 — public lead/message binding and opt-out", test_11_public_binding),
    ("Test 12 — dashboard sums", test_12_dashboard_sums),
    ("Test 13 — period edges", test_13_period_edges),
    ("Test R — every read runs", test_reads),
]


async def main() -> int:
    print(f"Extended Warranty SQL test — db={DB_NAME} schema={SCHEMA}")
    async with get_service_db_connection(DB_NAME, autocommit=True) as conn, \
            get_service_db_connection(DB_NAME, autocommit=True) as conn_b:
        for c in (conn, conn_b):
            await c.execute(pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(SCHEMA)))
        await conn_b.execute("SET lock_timeout = '15s'")

        branch = await q(conn, "SELECT id FROM branch ORDER BY id LIMIT 1")
        brand = await q(conn, "SELECT id FROM brand ORDER BY id LIMIT 1")
        if not branch or not brand:
            print(f"ABORT: {SCHEMA} needs at least one branch and one brand row.")
            return 2
        ctx = SimpleNamespace(branch_id=branch[0]["id"], brand_id=brand[0]["id"], conn=conn)
        print(f"Using branch_id={ctx.branch_id}, brand_id={ctx.brand_id}")

        for name, fn in TESTS:
            print(f"\n{name}")
            try:
                if fn is None:
                    await test_5_concurrent_claim(ctx, conn_b)
                else:
                    async with conn.transaction(force_rollback=True):
                        await fn(ctx)
            except Exception as e:  # pylint: disable=broad-exception-caught
                check(f"{name} ran without an unexpected error", False, f"{type(e).__name__}: {e}")

    failed = [name for name, ok in _results if not ok]
    print(f"\n{len(_results) - len(failed)} passed, {len(failed)} failed")
    for name in failed:
        print(f"  FAILED: {name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
