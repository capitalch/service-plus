"""Step 12 test for the Extended Warranty server code — plans/plan-ew-final.md §D3.1 tests
14–16, plus what Step 11 deferred (test 1 through the real resolver, test 10's "one staff
alert per first tap", test 11's signed links) and the webhook dispatch (W).

No WhatsApp message is sent: send_template is replaced by a fake that records each call
and answers ACCEPTED (or fails / raises when a test asks it to). No setting is changed in
the database: get_ew_settings and the WhatsApp switch are replaced in-process.

Unlike ew_sql_test.py, this code COMMITS — the resolvers and routes open their own
connections. Every fixture lead is named 'EW SQL TEST' and is deleted, with its messages
and events, in a finally block at the end.

Usage (from service-plus-server/, inside the venv; the DB settings and the link-token
secret come from .env):
    python scripts/ew_server_test.py [db_name] [schema]      # default: service_plus_demo demo1

Needs at least one row in branch, brand and security."user". Exit code 0 = all passed.
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import quote
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg.sql as pgsql  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

from app.db.connection.pool_manager import pool_manager  # noqa: E402
from app.db.connection.psycopg_driver import get_service_db_connection  # noqa: E402
from app.db.sql.sql_extended_warranty import ExtendedWarrantyServerSql as W  # noqa: E402
from app.graphql.resolvers import mutation as mutation_module  # noqa: E402
from app.graphql.resolvers.custom import extended_warranty as ew_resolvers  # noqa: E402
from app.routers.public import extended_warranty_router as ew_router  # noqa: E402
from app.routers.webhooks import whatsapp_webhook_router as webhook  # noqa: E402
from app.whatsapp import ew_sender  # noqa: E402
from app.whatsapp.sender import _build_biz_opaque_callback_data  # noqa: E402
from app.whatsapp.token import sign, sign_ew, sign_receipt, verify, verify_ew, verify_receipt  # noqa: E402

DB_NAME = sys.argv[1] if len(sys.argv) > 1 else "service_plus_demo"
SCHEMA = sys.argv[2] if len(sys.argv) > 2 else "demo1"

STATES = ["NEW_LEAD", "MESSAGE_SENT", "INTERESTED", "IN_PROGRESS", "WON", "LOST", "CANCELLED"]
# §C2.3, written out independently of the server's copy so test 1 can compare them.
EXPECTED = {
    "CANCELLED": {"IN_PROGRESS"},
    "IN_PROGRESS": {"CANCELLED", "LOST", "WON"},
    "INTERESTED": {"CANCELLED", "IN_PROGRESS", "LOST", "WON"},
    "LOST": {"IN_PROGRESS", "WON"},
    "MESSAGE_SENT": {"CANCELLED", "IN_PROGRESS", "INTERESTED", "LOST", "WON"},
    "NEW_LEAD": {"CANCELLED", "IN_PROGRESS", "LOST", "WON"},
    "WON": set(),
}
RANK = {"ACCEPTED": 1, "DELIVERED": 3, "FAILED": 9, "PENDING": 0, "READ": 4, "SENT": 2}
REMINDER_TEMPLATE = "extended_warranty_reminder_v1"
ALERT_TEMPLATE = "extended_warranty_lead_alert_v1"

REAL_GET_EW_SETTINGS = ew_sender.get_ew_settings
EVENT_ENABLED = {"on": True}
PUBLISHED: list[dict] = []
SEND_MODE = {"mode": "ok"}  # ok | fail | raise
SENDS: list[dict] = []
SETTINGS: dict = {}

_results: list[tuple[str, bool]] = []


def check(name: str, ok: bool, detail: object = "") -> None:
    _results.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + ("" if ok else f"  — {detail}"))


# ── Fakes ─────────────────────────────────────────────────────────────────────


async def fake_get_ew_settings(_db_name, _schema) -> dict:
    return dict(SETTINGS)


async def fake_is_event_enabled(_db_name, _schema, _event_key) -> bool:
    return EVENT_ENABLED["on"]


async def fake_publish(event_name, payload) -> None:
    PUBLISHED.append({"event": event_name, **payload})


async def fake_send_template(to, template, header_values, body_values, callback_data, button_values=None):
    SENDS.append({"body": body_values, "buttons": button_values, "callback": callback_data,
                  "header": header_values, "template": template.name, "to": to})
    if SEND_MODE["mode"] == "raise":
        raise RuntimeError("simulated network error")
    if SEND_MODE["mode"] == "fail":
        return SimpleNamespace(error_code="131026", error_message="131026: simulated failure", ok=False,
                               permanent=True, provider_message_id=None)
    return SimpleNamespace(error_code=None, error_message=None, ok=True, permanent=False,
                           provider_message_id=f"wamid.EWTEST.{uuid4().hex}")


def reset_state() -> None:
    SETTINGS.clear()
    SETTINGS.update(ew_sender._EW_DEFAULT_SETTINGS)  # pylint: disable=protected-access
    EVENT_ENABLED["on"] = True
    SEND_MODE["mode"] = "ok"
    SENDS.clear()
    PUBLISHED.clear()


# ── Helpers ───────────────────────────────────────────────────────────────────


async def q(conn, sql, args=None) -> list[dict]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, args if args is not None else {})
        return await cur.fetchall() if cur.description else []


async def raised(coro) -> str | None:
    try:
        await coro
    except Exception as e:  # pylint: disable=broad-exception-caught
        return type(e).__name__
    return None


def interest(token: str, customer_remarks: str = ""):
    """The interest route called directly. Its Form(...) default only resolves when FastAPI
    handles a real request, so a direct call must pass the value."""
    return ew_router.post_extended_warranty_interest(token, customer_remarks=customer_remarks)


def value(payload: dict) -> str:
    return quote(json.dumps(payload))


async def new_lead(ctx, *, days_left=20, mobile="9000000001", opted_out=False, stage=None, state="NEW_LEAD") -> int:
    """A committed fixture lead (the code under test opens its own connections)."""
    if stage is None and state == "IN_PROGRESS":
        stage = 1
    rows = await q(ctx.conn, """
        INSERT INTO ew_lead (branch_id, full_name, mobile, brand_id, serial_no, warranty_end_date,
                             state, progress_stage, closed_at, is_opted_out)
        VALUES (%(branch_id)s::bigint, 'EW SQL TEST', %(mobile)s::text, %(brand_id)s::bigint,
                %(serial_no)s::text, CURRENT_DATE + %(days_left)s::int, %(state)s::text, %(stage)s::smallint,
                CASE WHEN %(state)s::text IN ('WON', 'LOST', 'CANCELLED') THEN now() END, %(opted_out)s::boolean)
        RETURNING id
    """, {"branch_id": ctx.branch_id, "brand_id": ctx.brand_id, "days_left": days_left, "mobile": mobile,
          "opted_out": opted_out, "serial_no": f"EWT-{uuid4().hex[:12]}", "stage": stage, "state": state})
    ctx.lead_ids.append(rows[0]["id"])
    return rows[0]["id"]


async def add_msg(ctx, lead_id, *, band="D8_30", kind="REMINDER", status="ACCEPTED", wamid=None) -> int:
    rows = await q(ctx.conn, """
        INSERT INTO ew_message (ew_lead_id, kind, band, delivery_status, status_rank, wamid)
        VALUES (%(lead)s::bigint, %(kind)s::text, %(band)s::text, %(status)s::text, %(rank)s::smallint, %(wamid)s::text)
        RETURNING id
    """, {"band": None if kind == "LEAD_ALERT" else band, "kind": kind, "lead": lead_id, "rank": RANK[status],
          "status": status, "wamid": wamid})
    return rows[0]["id"]


async def view(ctx, lead_id) -> dict:
    return (await q(ctx.conn, "SELECT * FROM ew_lead_view WHERE id = %(id)s::bigint", {"id": lead_id}))[0]


async def messages(ctx, lead_id, kind=None) -> list[dict]:
    return await q(ctx.conn, """
        SELECT * FROM ew_message
        WHERE ew_lead_id = %(id)s::bigint AND (%(kind)s::text IS NULL OR kind = %(kind)s::text)
        ORDER BY id
    """, {"id": lead_id, "kind": kind})


async def events(ctx, lead_id) -> list[dict]:
    return await q(ctx.conn, "SELECT * FROM ew_lead_event WHERE ew_lead_id = %(id)s::bigint ORDER BY id",
                   {"id": lead_id})


def statuses(result: dict) -> dict[int, str]:
    return {r["ew_lead_id"]: r["status"] for r in result["results"]}


# ── Tests ─────────────────────────────────────────────────────────────────────


async def test_1_resolvers(ctx):
    check("the server's EW_TRANSITIONS equals §C2.3", ew_resolvers.EW_TRANSITIONS == EXPECTED,
          ew_resolvers.EW_TRANSITIONS)
    bad = []
    for frm in STATES:
        for to in STATES:
            lead_id = await new_lead(ctx, state=frm)
            args = value({"branch_id": ctx.branch_id, "ew_lead_id": lead_id, "to_state": to})
            if to == "MESSAGE_SENT":
                err = await raised(ew_resolvers.transition_ew_lead(DB_NAME, SCHEMA, args, ctx.user_id))
                if err != "ValidationException":
                    bad.append(f"{frm}→MESSAGE_SENT: {err}")
                continue
            result = await ew_resolvers.transition_ew_lead(DB_NAME, SCHEMA, args, ctx.user_id)
            expected = to in EXPECTED[frm]
            if result["ok"] != expected or (not expected and result.get("reason") != "STALE"):
                bad.append(f"{frm}→{to}: {result}")
    check("transitionEwLead: all 49 pairs — allowed ones move, the rest STALE, MESSAGE_SENT refused",
          not bad, "; ".join(bad))

    lead_id = await new_lead(ctx)
    await ew_resolvers.transition_ew_lead(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_id": lead_id, "notes": " customer phoned ", "to_state": "LOST"}),
        ctx.user_id)
    ev = (await events(ctx, lead_id))[0]
    check("the event is stamped with the signed-in user and trimmed notes",
          ev["created_by"] == ctx.user_id and ev["created_by_name"] == ctx.user_name
          and ev["notes"] == "customer phoned", ev)

    ip = await new_lead(ctx, state="IN_PROGRESS")
    result = await ew_resolvers.transition_ew_lead(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_id": ip, "progress_stage": 2, "to_state": "IN_PROGRESS"}), ctx.user_id)
    check("stage advance 1 → 2 through the resolver", result.get("ok") and result.get("progress_stage") == 2, result)

    bad_inputs = [
        ("an unknown to_state", {"ew_lead_id": ip, "to_state": "FOO"}),
        ("a stage of 5", {"ew_lead_id": ip, "progress_stage": 5, "to_state": "IN_PROGRESS"}),
        ("a missing lead id", {"to_state": "WON"}),
        ("notes over 1000 characters", {"ew_lead_id": ip, "notes": "x" * 1001, "to_state": "WON"}),
    ]
    for label, payload in bad_inputs:
        err = await raised(ew_resolvers.transition_ew_lead(
            DB_NAME, SCHEMA, value({"branch_id": ctx.branch_id, **payload}), ctx.user_id))
        check(f"transitionEwLead refuses {label}", err == "ValidationException", err)

    def follow_up(lead, **overrides):
        payload = {"action": "call", "branch_id": ctx.branch_id, "ew_lead_id": lead, "notes": "spoke to customer",
                   "next_follow_up_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                   **overrides}
        return ew_resolvers.add_ew_follow_up(DB_NAME, SCHEMA, value(payload), ctx.user_id)

    result = await follow_up(ip)
    check("addEwFollowUp records a follow-up (action upper-cased)",
          result.get("ok") and (await events(ctx, ip))[-1]["action"] == "CALL", result)
    result = await follow_up(await new_lead(ctx))
    check("addEwFollowUp on a New Lead → NOT_IN_PROGRESS", result == {"ok": False, "reason": "NOT_IN_PROGRESS"},
          result)
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    for label, overrides in [("an unknown action", {"action": "EMAIL"}), ("blank notes", {"notes": "   "}),
                             ("a past next date", {"next_follow_up_at": past}),
                             ("a date with no time zone", {"next_follow_up_at": "2030-01-01T10:00:00"}),
                             ("an unreadable date", {"next_follow_up_at": "tomorrow"}),
                             ("stage 0", {"progress_stage": 0})]:
        err = await raised(follow_up(ip, **overrides))
        check(f"addEwFollowUp refuses {label}", err == "ValidationException", err)


async def test_10_alert_once(ctx):
    SETTINGS.update(staff_whatsapp_number="98765 43210")
    lead_id = await new_lead(ctx, state="MESSAGE_SENT")
    token = sign_ew(DB_NAME, SCHEMA, lead_id, await add_msg(ctx, lead_id))
    first = await interest(token, customer_remarks="call after 5")
    second = await interest(token, customer_remarks="again")
    v = await view(ctx, lead_id)
    alerts = await messages(ctx, lead_id, "LEAD_ALERT")
    check("both taps get a thank-you page", first.status_code == 200 and second.status_code == 200
          and b"Thank you" in first.body)
    check("the first tap wins: Interested, and no preference is invented",
          v["state"] == "INTERESTED" and v["preferred_contact"] is None, v)
    check("exactly one staff alert is sent", len(SENDS) == 1 and SENDS[0]["template"] == ALERT_TEMPLATE, SENDS)
    if SENDS:
        body = SENDS[0]["body"]
        check("…to the staff number, with the lead id as the button suffix",
              SENDS[0]["to"] == "919876543210" and SENDS[0]["buttons"] == [str(lead_id)], SENDS[0])
        check("…with five one-line params (name, device, warranty + band, contact, remarks)",
              len(body) == 5 and "EW SQL TEST" in body[0] and "Warranty ends" in body[2]
              and "8–30 days left" in body[2] and "Please call back" in body[3] and body[4] == "call after 5", body)
        check("…and one LEAD_ALERT row, ACCEPTED, named in the callback data",
              len(alerts) == 1 and alerts[0]["delivery_status"] == "ACCEPTED" and alerts[0]["wamid"]
              and SENDS[0]["callback"] == f"{DB_NAME}|{SCHEMA}|EL|{alerts[0]['id']}", alerts)

    SENDS.clear()
    SETTINGS["staff_whatsapp_number"] = "12345"
    lead2 = await new_lead(ctx, state="MESSAGE_SENT")
    await interest(sign_ew(DB_NAME, SCHEMA, lead2, await add_msg(ctx, lead2)))
    alerts = await messages(ctx, lead2, "LEAD_ALERT")
    check("an invalid staff number records a FAILED alert and sends nothing",
          not SENDS and len(alerts) == 1 and alerts[0]["delivery_status"] == "FAILED", alerts)

    SETTINGS["staff_whatsapp_number"] = ""
    lead3 = await new_lead(ctx, state="MESSAGE_SENT")
    await interest(sign_ew(DB_NAME, SCHEMA, lead3, await add_msg(ctx, lead3)))
    check("a blank staff number sends nothing and records no alert — the interest still counts",
          not SENDS and not await messages(ctx, lead3, "LEAD_ALERT")
          and (await view(ctx, lead3))["state"] == "INTERESTED")

    SETTINGS["staff_whatsapp_number"] = "9876543210"
    SEND_MODE["mode"] = "fail"
    lead4 = await new_lead(ctx, state="MESSAGE_SENT")
    response = await interest(
        sign_ew(DB_NAME, SCHEMA, lead4, await add_msg(ctx, lead4)))
    alerts = await messages(ctx, lead4, "LEAD_ALERT")
    check("a Meta failure is recorded as a FAILED alert; the customer still gets a thank-you",
          response.status_code == 200 and len(alerts) == 1 and alerts[0]["delivery_status"] == "FAILED"
          and alerts[0]["error"], alerts)

    SEND_MODE["mode"] = "ok"
    result = await ew_resolvers.resend_ew_lead_alert(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_id": lead3}))
    check("resendEwLeadAlert sends the missing alert",
          result == {"ok": True, "status": "SENT"} and len(await messages(ctx, lead3, "LEAD_ALERT")) == 1, result)
    result = await ew_resolvers.resend_ew_lead_alert(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_id": await new_lead(ctx)}))
    check("resendEwLeadAlert refuses a lead with no interest", result == {"ok": False, "reason": "NO_INTEREST"},
          result)


async def test_11_tokens(ctx):
    lead_a = await new_lead(ctx, state="MESSAGE_SENT")
    lead_b = await new_lead(ctx, state="MESSAGE_SENT")
    msg_a = await add_msg(ctx, lead_a)
    msg_b = await add_msg(ctx, lead_b)
    alert_a = await add_msg(ctx, lead_a, kind="LEAD_ALERT")
    token = sign_ew(DB_NAME, SCHEMA, lead_a, msg_a)

    check("sign_ew → verify_ew round-trips", verify_ew(token) == (DB_NAME, SCHEMA, lead_a, msg_a), verify_ew(token))
    payload, signature = token.split(".")
    tampered = f"{payload[:-1]}{'A' if payload[-1] != 'A' else 'B'}.{signature}"
    cases = [
        ("a tampered token", tampered),
        ("an expired token", sign_ew(DB_NAME, SCHEMA, lead_a, msg_a, ttl_days=-1)),
        ("a money-receipt token (same five-number shape, no tag)", sign_receipt(DB_NAME, SCHEMA, lead_a, msg_a)),
        ("a job status-link token", sign(DB_NAME, SCHEMA, [lead_a])),
        ("garbage", "abc"),
        ("an empty string", ""),
    ]
    for label, bad in cases:
        check(f"verify_ew rejects {label}", verify_ew(bad) is None)
    check("the job and receipt verifiers reject a lead token",
          verify(token) is None and verify_receipt(token) is None)

    page = await ew_router.get_extended_warranty_page(token)
    check("GET with a valid token shows the form with the promised button wording",
          page.status_code == 200 and b"EW SQL TEST" in page.body
          and ew_router.INTEREST_BUTTON_LABEL.encode() in page.body, page.status_code)
    page = await ew_router.get_extended_warranty_page(sign_ew(DB_NAME, SCHEMA, lead_a, msg_b))
    check("GET with another lead's message → 404", page.status_code == 404)
    page = await ew_router.get_extended_warranty_page(sign_ew(DB_NAME, SCHEMA, lead_a, alert_a))
    check("GET with a LEAD_ALERT message id → 404", page.status_code == 404)
    page = await ew_router.get_extended_warranty_page(tampered)
    check("GET with a tampered token → 404, no exception", page.status_code == 404)

    page = await ew_router.post_extended_warranty_opt_out(token)
    v = await view(ctx, lead_a)
    check("opt-out → unsubscribed page, flag set", b"unsubscribed" in page.body and v["is_opted_out"], v)
    page = await ew_router.get_extended_warranty_page(token)
    check("GET after opt-out → unsubscribed page", b"You have unsubscribed" in page.body)
    await interest(token)
    check("interest after opt-out records nothing", (await view(ctx, lead_a))["interest_at"] is None)

    won = await new_lead(ctx, state="WON")
    page = await ew_router.get_extended_warranty_page(sign_ew(DB_NAME, SCHEMA, won, await add_msg(ctx, won)))
    check("GET on a Won lead → 'being handled'", b"being handled" in page.body)
    token_b = sign_ew(DB_NAME, SCHEMA, lead_b, msg_b)
    await interest(token_b)
    page = await ew_router.get_extended_warranty_page(token_b)
    check("GET after interest → 'we have your request'", b"we have your request" in page.body)


async def test_14_access(ctx):
    def info(**context):
        return SimpleNamespace(context=context)

    restricted = info(access_rights=["CUSTOM_MENU"], user_id=ctx.user_id, user_type="U")
    passes = [("with the right", info(access_rights=["CUSTOM_EXTENDED_WARRANTY"], user_type="U")),
              ("business admin (A)", info(user_type="A")), ("super admin (S)", info(user_type="S"))]
    resolvers = [("addEwFollowUp", mutation_module.resolve_add_ew_follow_up),
                 ("resendEwLeadAlert", mutation_module.resolve_resend_ew_lead_alert),
                 ("sendEwReminders", mutation_module.resolve_send_ew_reminders),
                 ("transitionEwLead", mutation_module.resolve_transition_ew_lead)]
    for name, fn in resolvers:
        err = await raised(fn(None, restricted, db_name=DB_NAME, schema=SCHEMA, value=value({})))
        check(f"{name}: refused without CUSTOM_EXTENDED_WARRANTY", err == "AuthorizationException", err)
        # An empty payload proves the guard let the call through without writing anything.
        for label, allowed in passes:
            err = await raised(fn(None, allowed, db_name=DB_NAME, schema=SCHEMA, value=value({})))
            check(f"{name}: {label} passes the guard", err == "ValidationException", err)

    update = value({"tableName": "ew_lead", "xData": {"id": -1, "remarks": "x"}})
    err = await raised(mutation_module.resolve_generic_update(None, restricted, db_name=DB_NAME, schema=SCHEMA,
                                                              value=update))
    check("genericUpdate on ew_lead: refused without the right", err == "AuthorizationException", err)
    for label, allowed in passes:
        err = await raised(asyncio.to_thread(
            mutation_module._require_generic_update_table_right, allowed, update))  # pylint: disable=protected-access
        check(f"genericUpdate on ew_lead: {label} passes the guard", err is None, err)
    check("ew_lead is in the merged genericUpdate rights map",
          mutation_module.GENERIC_UPDATE_TABLE_RIGHTS.get("ew_lead") == "CUSTOM_EXTENDED_WARRANTY")


async def test_15_send_and_cap(ctx):
    SETTINGS.update(contact_phone="9830012345", enabled=True, whatsapp_number="9830098300")
    sent_today = (await q(ctx.conn, W.GET_EW_SENT_TODAY_COUNT))[0]["sent_today"]
    SETTINGS["daily_send_cap"] = sent_today + 2
    ids = [await new_lead(ctx) for _ in range(3)]
    result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value({"branch_id": ctx.branch_id,
                                                                       "ew_lead_ids": ids}), ctx.user_id)
    got = sorted(statuses(result).values())
    check("cap = today's count + 2, three selected → 2 SENT, 1 CAPPED",
          got == ["CAPPED", "SENT", "SENT"] and len(SENDS) == 2, result)

    sent_ids = [i for i, s in statuses(result).items() if s == "SENT"]
    capped_id = next((i for i, s in statuses(result).items() if s == "CAPPED"), None)
    if sent_ids:
        lead_id = sent_ids[0]
        msgs = await messages(ctx, lead_id)
        send = next(s for s in SENDS if s["callback"] == f"{DB_NAME}|{SCHEMA}|EW|{msgs[0]['id']}")
        check("the reminder uses the approved template with six body params and the settings' numbers",
              send["template"] == REMINDER_TEMPLATE and len(send["body"]) == 6 and send["body"][0] == "EW SQL TEST"
              and send["body"][4] == "9830012345" and send["body"][5] == "9830098300", send)
        check("…its button carries a lead link bound to this lead and this message",
              verify_ew(send["buttons"][0]) == (DB_NAME, SCHEMA, lead_id, msgs[0]["id"]), send["buttons"])
        v = await view(ctx, lead_id)
        evs = await events(ctx, lead_id)
        check("the sent lead is Message Sent, its reminder ACCEPTED with a wamid",
              v["state"] == "MESSAGE_SENT" and msgs[0]["delivery_status"] == "ACCEPTED" and msgs[0]["wamid"], msgs)
        check("…and the event is stamped with the sender's name",
              len(evs) == 1 and evs[0]["created_by_name"] == ctx.user_name, evs)
    if capped_id:
        check("the capped lead is untouched",
              (await view(ctx, capped_id))["state"] == "NEW_LEAD" and not await messages(ctx, capped_id))

    SENDS.clear()
    SETTINGS["daily_send_cap"] = 0
    ids = [await new_lead(ctx) for _ in range(3)]
    result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value({"branch_id": ctx.branch_id,
                                                                       "ew_lead_ids": ids}), ctx.user_id)
    check("cap 0 = unlimited → 3 SENT", sorted(statuses(result).values()) == ["SENT"] * 3, result)

    SENDS.clear()
    won = await new_lead(ctx, state="WON")
    bad_mobile = await new_lead(ctx, mobile="12345")
    fine = await new_lead(ctx)
    result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_ids": [won, bad_mobile, fine]}), ctx.user_id)
    got = statuses(result)
    check("a Won lead is SKIPPED, an invalid mobile is SKIPPED, the good one SENT",
          got == {won: "SKIPPED", bad_mobile: "SKIPPED", fine: "SENT"} and len(SENDS) == 1, result)
    result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_ids": [fine]}), ctx.user_id)
    check("sending the same lead again in the same band → SKIPPED, no second send",
          statuses(result) == {fine: "SKIPPED"} and len(SENDS) == 1, result)
    result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value(
        {"branch_id": -1, "ew_lead_ids": [await new_lead(ctx)]}), ctx.user_id)
    check("another branch → SKIPPED", list(statuses(result).values()) == ["SKIPPED"], result)

    for mode in ("fail", "raise"):
        SEND_MODE["mode"] = mode
        lead_id = await new_lead(ctx)
        result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value(
            {"branch_id": ctx.branch_id, "ew_lead_ids": [lead_id]}), ctx.user_id)
        msgs = await messages(ctx, lead_id)
        v = await view(ctx, lead_id)
        check(f"a Meta {'failure' if mode == 'fail' else 'exception'} → FAILED result, FAILED row (never PENDING), "
              f"lead in Message Sent and sendable again",
              statuses(result) == {lead_id: "FAILED"} and [m["delivery_status"] for m in msgs] == ["FAILED"]
              and v["state"] == "MESSAGE_SENT" and v["can_send"], (result, msgs))
    SEND_MODE["mode"] = "ok"
    result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value(
        {"branch_id": ctx.branch_id, "ew_lead_ids": [lead_id]}), ctx.user_id)
    check("…and the retry is SENT", statuses(result) == {lead_id: "SENT"}, result)

    for label, payload in [("no lead ids", {"branch_id": ctx.branch_id, "ew_lead_ids": []}),
                           ("non-numeric ids", {"branch_id": ctx.branch_id, "ew_lead_ids": ["abc"]}),
                           ("no branch", {"ew_lead_ids": [1]})]:
        err = await raised(ew_sender.send_ew_reminders(DB_NAME, SCHEMA, value(payload), ctx.user_id))
        check(f"sendEwReminders refuses {label}", err == "ValidationException", err)


async def test_16_switches(ctx):
    check("is_ew_enabled: true only for the boolean true",
          ew_sender.is_ew_enabled({"enabled": True}) and not ew_sender.is_ew_enabled({"enabled": "true"})
          and not ew_sender.is_ew_enabled({"enabled": 1}) and not ew_sender.is_ew_enabled({}))
    real = await REAL_GET_EW_SETTINGS(DB_NAME, SCHEMA)
    check("get_ew_settings reads the real row and always has the six keys",
          {"contact_phone", "daily_send_cap", "enabled", "notify_email", "staff_whatsapp_number",
           "whatsapp_number"} <= set(real), real)
    print(f"  INFO  {SCHEMA}.extended_warranty right now: enabled={real['enabled']!r}, "
          f"daily_send_cap={real['daily_send_cap']!r}")

    lead_id = await new_lead(ctx)
    args = value({"branch_id": ctx.branch_id, "ew_lead_ids": [lead_id]})
    for label, enabled, event_on in [("enabled = the string \"true\"", "true", True),
                                     ("enabled missing", None, True),
                                     ("enabled on but the WhatsApp switch off", True, False)]:
        SETTINGS["enabled"] = enabled if enabled is not None else False
        EVENT_ENABLED["on"] = event_on
        result = await ew_sender.send_ew_reminders(DB_NAME, SCHEMA, args, ctx.user_id)
        check(f"{label} → disabled, nothing sent", result == {"disabled": True, "results": []} and not SENDS, result)
    check("…and the lead is untouched",
          (await view(ctx, lead_id))["state"] == "NEW_LEAD" and not await messages(ctx, lead_id))


async def test_w_webhook(ctx):
    lead_id = await new_lead(ctx, state="MESSAGE_SENT")
    wamid = f"wamid.EWTEST.{uuid4().hex}"
    msg_id = await add_msg(ctx, lead_id, wamid=wamid)
    callback = _build_biz_opaque_callback_data(DB_NAME, SCHEMA, "EXTENDED_WARRANTY", [msg_id])
    check("callback data is db|schema|EW|<message id> and decodes back",
          callback == f"{DB_NAME}|{SCHEMA}|EW|{msg_id}"
          and webhook._decode_callback_data(callback) == (DB_NAME, SCHEMA, "EXTENDED_WARRANTY", [msg_id]))  # pylint: disable=protected-access

    def status(s, w=wamid, cb=callback, **extra):
        return {"biz_opaque_callback_data": cb, "id": w, "status": s, **extra}

    await webhook._apply_status_callback(status("delivered"))  # pylint: disable=protected-access
    check("DELIVERED applies and publishes kind EW / target CUSTOMER",
          (await messages(ctx, lead_id))[0]["delivery_status"] == "DELIVERED"
          and PUBLISHED == [{"db_name": DB_NAME, "error": None, "event": "whatsapp_delivery_status",
                             "ew_lead_id": lead_id, "ew_message_id": msg_id, "kind": "EW",
                             "schema": SCHEMA, "status": "DELIVERED", "target": "CUSTOMER"}], PUBLISHED)
    PUBLISHED.clear()
    await webhook._apply_status_callback(status("sent"))  # pylint: disable=protected-access
    check("a late SENT is ignored, nothing published",
          (await messages(ctx, lead_id))[0]["delivery_status"] == "DELIVERED" and not PUBLISHED)
    await webhook._apply_status_callback(status("read"))  # pylint: disable=protected-access
    check("READ applies", (await view(ctx, lead_id))["message_group"] == "READ")

    lead2 = await new_lead(ctx, state="MESSAGE_SENT")
    wamid2 = f"wamid.EWTEST.{uuid4().hex}"
    msg2 = await add_msg(ctx, lead2, wamid=wamid2)
    await webhook._apply_status_callback(status(  # pylint: disable=protected-access
        "failed", w=wamid2, cb=_build_biz_opaque_callback_data(DB_NAME, SCHEMA, "EXTENDED_WARRANTY", [msg2]),
        errors=[{"code": 131049, "title": "Marketing message throttled"}]))
    m = (await messages(ctx, lead2))[0]
    check("FAILED stores Meta's code and title", m["delivery_status"] == "FAILED"
          and m["error"] == "131049: Marketing message throttled", m)

    PUBLISHED.clear()
    alert_wamid = f"wamid.EWTEST.{uuid4().hex}"
    alert_id = await add_msg(ctx, lead_id, kind="LEAD_ALERT", wamid=alert_wamid)
    await webhook._apply_status_callback(status(  # pylint: disable=protected-access
        "delivered", w=alert_wamid, cb=_build_biz_opaque_callback_data(DB_NAME, SCHEMA, "EXTENDED_WARRANTY_LEAD",
                                                                       [alert_id])))
    check("a LEAD_ALERT status publishes target STAFF",
          len(PUBLISHED) == 1 and PUBLISHED[0]["target"] == "STAFF"
          and (await view(ctx, lead_id))["alert_status"] == "DELIVERED", PUBLISHED)

    PUBLISHED.clear()
    err = await raised(webhook._apply_status_callback(status(  # pylint: disable=protected-access
        "delivered", w=f"wamid.UNKNOWN.{uuid4().hex}")))
    check("an unknown wamid is ignored — no exception, nothing published", err is None and not PUBLISHED, err)


TESTS = [
    ("Test 1 — transitions and follow-ups through the resolvers", test_1_resolvers),
    ("Test 10 — one staff alert per first tap", test_10_alert_once),
    ("Test 11 — signed lead links and the public page", test_11_tokens),
    ("Test 14 — access rights on the four mutations and genericUpdate", test_14_access),
    ("Test 15 — send path and daily cap", test_15_send_and_cap),
    ("Test 16 — the two switches fail closed", test_16_switches),
    ("Test W — webhook dispatch", test_w_webhook),
]


async def main() -> int:
    print(f"Extended Warranty server test — db={DB_NAME} schema={SCHEMA}")
    ew_sender.send_template = fake_send_template
    ew_sender.get_ew_settings = fake_get_ew_settings
    ew_router.get_ew_settings = fake_get_ew_settings
    ew_sender._is_event_enabled = fake_is_event_enabled  # pylint: disable=protected-access
    webhook.pubsub = SimpleNamespace(publish=fake_publish)

    lead_ids: list[int] = []
    try:
        async with get_service_db_connection(DB_NAME, autocommit=True) as conn:
            await conn.execute(pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(SCHEMA)))
            branch = await q(conn, "SELECT id FROM branch ORDER BY id LIMIT 1")
            brand = await q(conn, "SELECT id FROM brand ORDER BY id LIMIT 1")
            user = await q(conn, 'SELECT id, full_name FROM security."user" ORDER BY id LIMIT 1')
            if not branch or not brand or not user:
                print(f"ABORT: {SCHEMA} needs a branch, a brand and a security user.")
                return 2
            ctx = SimpleNamespace(branch_id=branch[0]["id"], brand_id=brand[0]["id"], conn=conn, lead_ids=lead_ids,
                                  user_id=user[0]["id"], user_name=user[0]["full_name"])
            print(f"Using branch_id={ctx.branch_id}, brand_id={ctx.brand_id}, user_id={ctx.user_id}")
            try:
                for name, fn in TESTS:
                    print(f"\n{name}")
                    reset_state()
                    try:
                        await fn(ctx)
                    except Exception as e:  # pylint: disable=broad-exception-caught
                        check(f"{name} ran without an unexpected error", False, f"{type(e).__name__}: {e}")
            finally:
                print("\nCleanup")
                if lead_ids:
                    await q(conn, "DELETE FROM ew_lead WHERE id = ANY(%(ids)s::bigint[])", {"ids": lead_ids})
                left = await q(conn, "SELECT COUNT(*) AS n FROM ew_lead WHERE id = ANY(%(ids)s::bigint[])",
                               {"ids": lead_ids})
                check(f"all {len(lead_ids)} fixture leads deleted (with their messages and events)",
                      left[0]["n"] == 0, left)
    finally:
        await pool_manager.close_all()

    failed = [name for name, ok in _results if not ok]
    print(f"\n{len(_results) - len(failed)} passed, {len(failed)} failed")
    for name in failed:
        print(f"  FAILED: {name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
