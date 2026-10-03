"""Plan change and monthly billing (plans/plan.md Steps 12, 13).

- lt (the default customer database's admin): `changeBuPlan`, `recordBuSubscriptionPayment`.
- Enterprise (Super Admin, run in the client's own database): `recordClientSubscriptionPayment`,
  `setClientMonthlyFee`, `extendClientPaidThrough`, `setClientBillingHold`, `startClientBilling`.

Every change happens in one transaction with the affected security.bu row(s) locked
FOR UPDATE — the same lock addBranch takes — so two payments, or a plan change and a branch
insert, queue instead of racing. Fees are read from the locked rows, never from the browser.
The ledger (security.bu_payment) is only ever appended to. Each change clears the billing
cache, so the next write in this process sees it.
"""

from datetime import date, timedelta
from typing import Any

import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.core.audit_log import AuditAction, audit_logger
from app.core.billing import (
    MAX_PREPAID_MONTHS,
    add_months,
    exceeds_prepaid_limit,
    extend_paid_through,
    rebase_paid_through,
    today_ist,
)
from app.core.exceptions import AppMessages, CodedValidationException, ValidationException
from app.core.plan_prices import PAISE_PER_RUPEE, get_plan_price, get_price_list
from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection
from app.db.sql.sql_billing import BillingServerSql
from app.db.sql.sql_signups import SignupServerSql
from app.graphql.resolvers.bu_admin.signups import actor_username, parse_payment
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.services.bu_billing import clear_bu_billing
from app.services.signup_emails import rupees, send_text_email

LT_PLAN_CODES = ("basic", "lite", "standard")
ONE_BRANCH_PLAN_CODES = ("basic", "lite")


def _invalid(message: str, **extensions: Any) -> ValidationException:
    return ValidationException(message=message, extensions=extensions or None)


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def period_text(months: int) -> str:
    """'24 months' reads as '2 years' when it is a whole number of years."""
    if months % 12 == 0:
        years = months // 12
        return f"{years} year" if years == 1 else f"{years} years"
    return f"{months} month" if months == 1 else f"{months} months"


def _parse_months(payload: dict) -> int:
    try:
        months = int(payload.get("months"))
    except (TypeError, ValueError) as e:
        raise _invalid(AppMessages.PAYMENT_MONTHS_INVALID, field="months") from e
    if not 1 <= months <= MAX_PREPAID_MONTHS:
        raise _invalid(AppMessages.PAYMENT_MONTHS_INVALID, field="months")
    return months


def _check_amount(payment: dict, due_paise: int) -> None:
    """At least fee × months (no discount); more only with a note."""
    if payment["amount_paise"] < due_paise:
        raise _invalid(AppMessages.PAYMENT_AMOUNT_BELOW_DUE, field="amount")
    if payment["amount_paise"] > due_paise and not payment["note"]:
        raise _invalid(AppMessages.PAYMENT_EXTRA_NOTE_REQUIRED, field="note")


def _new_paid_through(paid_through: date | None, months: int, today: date) -> tuple[date, date]:
    """(period_from, period_to) of a payment; refuses one beyond the 60-month cap."""
    period_to = extend_paid_through(paid_through, today, months)
    if exceeds_prepaid_limit(period_to, today):
        raise CodedValidationException(
            message=AppMessages.PREPAID_LIMIT_EXCEEDED,
            code="PREPAID_LIMIT_EXCEEDED",
            extensions={"limit": _iso(add_months(today, MAX_PREPAID_MONTHS))},
        )
    start = max(paid_through, today - timedelta(days=1)) if paid_through else today - timedelta(days=1)
    return start + timedelta(days=1), period_to


async def _send_receipt(db_name: str, bu: dict, amount_paise: int, months: int, paid_through: date) -> None:
    rows = await exec_sql(db_name, "security", BillingServerSql.GET_BU_BILLING_RECIPIENTS, {"bu_id": bu["id"]})
    subject = AppMessages.BILLING_EMAIL_RECEIPT_SUBJECT.format(bu_name=bu["name"])
    text = AppMessages.BILLING_EMAIL_RECEIPT_TEXT.format(
        amount=rupees(amount_paise).lstrip("₹"), bu_name=bu["name"], paid_through=paid_through, period=period_text(months)
    )
    for row in rows:
        await send_text_email(row["email"], subject, text)


async def _audit(action: str, actor: str, db_name: str, detail: str, resource: str | None = None) -> None:
    await audit_logger.log(
        action=action,
        actor_type="super_admin" if actor == "super_admin" else "admin",
        actor_username=actor,
        detail=detail,
        resource_name=resource or db_name,
        resource_type="billing",
    )


async def _security_cursor(conn):
    cur = conn.cursor(row_factory=dict_row)
    await cur.execute("SET search_path TO security")
    return cur


# ── Step 12: plan change (lt) ─────────────────────────────────────────────────


async def _blocking_branches(cur, schema: str) -> list[dict]:
    """Every branch other than HO, with its row counts per table that references branch
    (found from the schema's foreign keys; division is left out — it goes with its branch)."""
    await cur.execute(pgsql.SQL("SET LOCAL search_path TO {}").format(pgsql.Identifier(schema)))
    await cur.execute(BillingServerSql.GET_NON_HO_BRANCHES)
    branches = await cur.fetchall()
    if not branches:
        await cur.execute("SET LOCAL search_path TO security")
        return []
    await cur.execute(BillingServerSql.GET_BRANCH_FOREIGN_KEYS, {"branch_table": f"{schema}.branch"})
    keys = [k for k in await cur.fetchall() if k["table_name"].split(".")[-1] != "division"]
    ids = [b["id"] for b in branches]
    counts: dict[int, dict[str, int]] = {b["id"]: {} for b in branches}
    for key in keys:
        table = pgsql.Identifier(*key["table_name"].split("."))
        column = pgsql.Identifier(key["column_name"])
        await cur.execute(
            pgsql.SQL("SELECT {c} AS branch_id, COUNT(*)::int AS n FROM {t} WHERE {c} = ANY(%(ids)s) GROUP BY {c}").format(
                c=column, t=table
            ),
            {"ids": ids},
        )
        for row in await cur.fetchall():
            counts[row["branch_id"]][key["table_name"].split(".")[-1]] = row["n"]
    await cur.execute("SET LOCAL search_path TO security")
    return [{"code": b["code"], "counts": counts[b["id"]], "name": b["name"]} for b in branches]


async def resolve_change_bu_plan_helper(info, db_name: str, value: str) -> dict:
    """Move a Lite / Basic / Standard BU to another of those plans. Value: { bu_id, plan_code,
    preview? }. With preview nothing is written; the answer carries the new fee and, when the
    customer is prepaid, the rebased paid_through (constraint 8). A downgrade to one branch is
    refused while other branches exist (DOWNGRADE_BLOCKED_BRANCHES lists them)."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "changeBuPlan")
    new_plan = payload.get("plan_code")
    preview = bool(payload.get("preview"))
    by = await actor_username(info, db_name)
    today = today_ist()

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_BU_BY_ID, {"id": payload.get("bu_id")})
        bu = await cur.fetchone()
        if not bu:
            raise _invalid(AppMessages.RESOURCE_NOT_FOUND)
        if new_plan not in LT_PLAN_CODES or bu["plan_code"] not in LT_PLAN_CODES or new_plan == bu["plan_code"]:
            raise _invalid(AppMessages.PLAN_CHANGE_INVALID, field="plan_code")

        blocking = await _blocking_branches(cur, bu["code"]) if new_plan in ONE_BRANCH_PLAN_CODES else []
        new_fee = get_plan_price(new_plan).monthly_fee_paise
        billed = new_plan != "lite"
        paid_through = bu["paid_through"]
        if bu["billing_required"] and billed:
            paid_through = rebase_paid_through(paid_through, today, bu["monthly_fee_paise"] or 0, new_fee)
        result = {
            "blocking_branches": blocking,
            "monthly_fee_paise": new_fee,
            "paid_through_after": _iso(paid_through),
            "paid_through_before": _iso(bu["paid_through"]),
            "plan_code": new_plan,
        }
        if preview:
            return result
        if blocking:
            raise CodedValidationException(
                message=AppMessages.DOWNGRADE_BLOCKED_BRANCHES,
                code="DOWNGRADE_BLOCKED_BRANCHES",
                extensions={"branches": blocking},
            )

        await cur.execute(
            BillingServerSql.SET_BU_PLAN_FIELDS,
            {
                "billing_required": billed,
                "branch_limit": 1 if new_plan in ONE_BRANCH_PLAN_CODES else None,
                "id": bu["id"],
                "monthly_fee_paise": new_fee,
                "paid_through": paid_through,
                "plan_code": new_plan,
            },
        )
        if paid_through != bu["paid_through"]:
            await cur.execute(
                BillingServerSql.INSERT_FEE_REBASE,
                {
                    "bu_id": bu["id"],
                    "monthly_fee_paise": new_fee,
                    "note": (
                        f"Plan {bu['plan_code']} → {new_plan}: fee {rupees(bu['monthly_fee_paise'] or 0)} → "
                        f"{rupees(new_fee)}; paid_through {bu['paid_through']} → {paid_through}"
                    ),
                    "recorded_by": by,
                },
            )

    clear_bu_billing(db_name)
    await _audit(AuditAction.CHANGE_BU_PLAN, by, db_name, f"{bu['code']}: {bu['plan_code']} → {new_plan}", bu["code"])
    return result


# ── Step 13: payments ─────────────────────────────────────────────────────────


async def resolve_record_bu_subscription_payment_helper(info, db_name: str, value: str) -> dict:
    """One lt BU's monthly payment. Value: { bu_id, months, amount (rupees), mode, reference,
    received_on, note? }"""
    payload = _decode_value(value, "recordBuSubscriptionPayment")
    months = _parse_months(payload)
    payment = parse_payment(payload, 0)
    by = await actor_username(info, db_name)
    today = today_ist()

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_BU_BY_ID, {"id": payload.get("bu_id")})
        bu = await cur.fetchone()
        if not bu or not bu["billing_required"]:
            raise _invalid(AppMessages.BU_NOT_BILLED)
        fee = bu["monthly_fee_paise"] or 0
        _check_amount(payment, fee * months)
        period_from, period_to = _new_paid_through(bu["paid_through"], months, today)
        await cur.execute(
            BillingServerSql.INSERT_BU_PAYMENT,
            {
                **payment,
                "bu_id": bu["id"],
                "monthly_fee_paise": fee,
                "months": months,
                "period_from": period_from,
                "period_to": period_to,
                "recorded_by": by,
            },
        )
        await cur.execute(BillingServerSql.SET_BU_PAID_THROUGH, {"id": bu["id"], "paid_through": period_to})

    clear_bu_billing(db_name)
    await _audit(
        AuditAction.RECORD_BU_PAYMENT,
        by,
        db_name,
        f"{bu['code']}: {rupees(payment['amount_paise'])} for {period_text(months)}, paid through {period_to}",
        bu["code"],
    )
    await _send_receipt(db_name, bu, payment["amount_paise"], months, period_to)
    return {"bu_id": bu["id"], "paid_through": _iso(period_to)}


async def resolve_record_client_subscription_payment_helper(db_name: str, value: str) -> dict:
    """An Enterprise client's monthly payment for all its BUs: amount ≥ the sum of BU fees ×
    months; every BU moves to the same date, counted from the earliest paid_through."""
    payload = _decode_value(value, "recordClientSubscriptionPayment")
    months = _parse_months(payload)
    payment = parse_payment(payload, 0)
    today = today_ist()

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_BILLED_BUS)
        bus = await cur.fetchall()
        if not bus:
            raise _invalid(AppMessages.BU_NOT_BILLED)
        total = sum(b["monthly_fee_paise"] or 0 for b in bus)
        _check_amount(payment, total * months)
        dates = [b["paid_through"] for b in bus]
        base = None if any(d is None for d in dates) else min(dates)
        period_from, period_to = _new_paid_through(base, months, today)
        await cur.execute(
            BillingServerSql.INSERT_BU_PAYMENT,
            {
                **payment,
                "bu_id": None,
                "monthly_fee_paise": total,
                "months": months,
                "period_from": period_from,
                "period_to": period_to,
                "recorded_by": "super_admin",
            },
        )
        for bu in bus:
            await cur.execute(BillingServerSql.SET_BU_PAID_THROUGH, {"id": bu["id"], "paid_through": period_to})

    clear_bu_billing(db_name)
    await _audit(
        AuditAction.RECORD_BU_PAYMENT,
        "super_admin",
        db_name,
        f"{rupees(payment['amount_paise'])} for {period_text(months)}, paid through {period_to}",
    )
    await _send_receipt(db_name, bus[0], payment["amount_paise"], months, period_to)
    return {"paid_through": _iso(period_to)}


# ── Step 13: Enterprise controls (Super Admin) ────────────────────────────────


async def resolve_set_client_monthly_fee_helper(db_name: str, value: str) -> dict:
    """The client's base Enterprise fee (carried by its first BU; extra BUs keep theirs).
    Rebases the shared paid_through when prepaid. Value: { monthly_fee (rupees), preview? }"""
    payload = _decode_value(value, "setClientMonthlyFee")
    try:
        base_fee = round(float(payload.get("monthly_fee")) * PAISE_PER_RUPEE)
    except (TypeError, ValueError) as e:
        raise _invalid(AppMessages.INVALID_INPUT, field="monthly_fee") from e
    if base_fee <= 0:
        raise _invalid(AppMessages.INVALID_INPUT, field="monthly_fee")
    today = today_ist()

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_BILLED_BUS)
        bus = await cur.fetchall()
        if not bus:
            raise _invalid(AppMessages.BU_NOT_BILLED)
        old_total = sum(b["monthly_fee_paise"] or 0 for b in bus)
        new_total = old_total - (bus[0]["monthly_fee_paise"] or 0) + base_fee
        old_date = bus[0]["paid_through"]
        new_date = rebase_paid_through(old_date, today, old_total, new_total)
        result = {
            "monthly_fee_paise": new_total,
            "paid_through_after": _iso(new_date),
            "paid_through_before": _iso(old_date),
        }
        if payload.get("preview"):
            return result
        await cur.execute(BillingServerSql.SET_BU_FEE, {"id": bus[0]["id"], "monthly_fee_paise": base_fee})
        if new_date != old_date:
            for bu in bus:
                await cur.execute(BillingServerSql.SET_BU_PAID_THROUGH, {"id": bu["id"], "paid_through": new_date})
            await cur.execute(
                BillingServerSql.INSERT_FEE_REBASE,
                {
                    "bu_id": None,
                    "monthly_fee_paise": new_total,
                    "note": f"Fee {rupees(old_total)} → {rupees(new_total)}; paid_through {old_date} → {new_date}",
                    "recorded_by": "super_admin",
                },
            )

    clear_bu_billing(db_name)
    await _audit(AuditAction.SET_MONTHLY_FEE, "super_admin", db_name, f"{rupees(old_total)} → {rupees(new_total)}")
    if new_date != old_date:
        await _audit(AuditAction.REBASE_PAID_THROUGH, "super_admin", db_name, f"{old_date} → {new_date}")
    return result


async def resolve_extend_client_paid_through_helper(db_name: str, value: str) -> dict:
    """Move every billed BU's paid_through to a date (today .. 5 years ahead), with a note.
    Value: { paid_through (YYYY-MM-DD), note }"""
    payload = _decode_value(value, "extendClientPaidThrough")
    note = (payload.get("note") or "").strip()
    if not note:
        raise _invalid(AppMessages.ENQUIRY_NOTE_REQUIRED, field="note")
    today = today_ist()
    try:
        new_date = date.fromisoformat(str(payload.get("paid_through")))
    except ValueError as e:
        raise _invalid(AppMessages.PAID_THROUGH_INVALID, field="paid_through") from e
    if new_date < today or exceeds_prepaid_limit(new_date, today):
        raise _invalid(AppMessages.PAID_THROUGH_INVALID, field="paid_through")

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_BILLED_BUS)
        bus = await cur.fetchall()
        if not bus:
            raise _invalid(AppMessages.BU_NOT_BILLED)
        for bu in bus:
            await cur.execute(BillingServerSql.SET_BU_PAID_THROUGH, {"id": bu["id"], "paid_through": new_date})
        await cur.execute(
            BillingServerSql.INSERT_LEDGER_NOTE,
            {
                "bu_id": None,
                "entry_kind": "extension",
                "monthly_fee_paise": sum(b["monthly_fee_paise"] or 0 for b in bus),
                "note": note,
                "period_to": new_date,
                "recorded_by": "super_admin",
            },
        )

    clear_bu_billing(db_name)
    await _audit(AuditAction.EXTEND_PAID_THROUGH, "super_admin", db_name, f"→ {new_date}: {note}")
    return {"paid_through": _iso(new_date)}


async def resolve_set_client_billing_hold_helper(db_name: str, value: str) -> dict:
    """Put an Enterprise client on hold (view-only at once) or release it. Value: { hold, note }"""
    payload = _decode_value(value, "setClientBillingHold")
    note = (payload.get("note") or "").strip()
    if not note:
        raise _invalid(AppMessages.ENQUIRY_NOTE_REQUIRED, field="note")
    hold = bool(payload.get("hold"))

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_BILLED_BUS)
        bus = await cur.fetchall()
        if not bus:
            raise _invalid(AppMessages.BU_NOT_BILLED)
        await cur.execute(BillingServerSql.SET_CLIENT_BILLING_HOLD, {"hold": hold})
        await cur.execute(
            BillingServerSql.INSERT_LEDGER_NOTE,
            {
                "bu_id": None,
                "entry_kind": "correction",
                "monthly_fee_paise": sum(b["monthly_fee_paise"] or 0 for b in bus),
                "note": f"{'Hold' if hold else 'Hold released'}: {note}",
                "period_to": None,
                "recorded_by": "super_admin",
            },
        )

    clear_bu_billing(db_name)
    await _audit(AuditAction.SET_BILLING_HOLD, "super_admin", db_name, f"{'on' if hold else 'off'}: {note}")
    return {"hold": hold}


async def resolve_start_client_billing_helper(value: str) -> dict:
    """Put an existing customer on Enterprise billing in one transaction, so it is never
    view-only in between. Value: { client_id, monthly_fee (rupees), paid_through }.
    The oldest BU carries the fee; BUs up to the included count carry 0; later ones the
    extra-BU fee (as Step 10)."""
    payload = _decode_value(value, "startClientBilling")
    clients = await exec_sql(None, "public", SignupServerSql.GET_CLIENT_BY_ID, {"id": payload.get("client_id")})
    if not clients or not clients[0]["db_name"]:
        raise _invalid(AppMessages.CLIENT_NOT_FOUND)
    db_name = clients[0]["db_name"]
    try:
        base_fee = round(float(payload.get("monthly_fee")) * PAISE_PER_RUPEE)
        paid_through = date.fromisoformat(str(payload.get("paid_through")))
    except (TypeError, ValueError) as e:
        raise _invalid(AppMessages.INVALID_INPUT) from e
    today = today_ist()
    if base_fee <= 0:
        raise _invalid(AppMessages.INVALID_INPUT, field="monthly_fee")
    if paid_through < today or exceeds_prepaid_limit(paid_through, today):
        raise _invalid(AppMessages.PAID_THROUGH_INVALID, field="paid_through")
    prices = get_price_list()

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_ALL_BUS)
        bus = await cur.fetchall()
        if not bus:
            raise _invalid(AppMessages.RESOURCE_NOT_FOUND)
        total = 0
        for n, bu in enumerate(bus, start=1):
            fee = base_fee if n == 1 else (0 if n <= prices.enterprise_included_bus else prices.extra_bu_monthly_paise)
            total += fee
            await cur.execute(
                BillingServerSql.START_BU_BILLING, {"id": bu["id"], "monthly_fee_paise": fee, "paid_through": paid_through}
            )
        await cur.execute(
            BillingServerSql.INSERT_LEDGER_NOTE,
            {
                "bu_id": None,
                "entry_kind": "correction",
                "monthly_fee_paise": total,
                "note": f"Billing started: {rupees(total)} a month, paid through {paid_through}",
                "period_to": paid_through,
                "recorded_by": "super_admin",
            },
        )

    clear_bu_billing(db_name)
    await _audit(
        AuditAction.START_CLIENT_BILLING, "super_admin", db_name, f"{rupees(total)}/month, paid through {paid_through}"
    )
    logger.info("Billing started for %s: %d BU(s), paid through %s", db_name, len(bus), paid_through)
    return {"db_name": db_name, "monthly_fee_paise": total, "paid_through": _iso(paid_through)}
