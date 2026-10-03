"""Daily billing reminders (plans/plan.md Step 13).

Once a day, at settings.billing_reminder_hour IST, every billed BU of every active client
database gets at most one email to its Managers and its database's admins:

- due_soon      — inside the last 5 days before paid_through (once per period)
- due_today     — on paid_through, the last paid day
- lapsed        — from the day after, when the BU is view-only (once per period)
- first_payment — once, while a newly approved BU has no payment yet

`last_reminder_on` / `last_reminder_kind` on security.bu prevent repeats. A Postgres
advisory lock (held for the run) lets only one server process send.
"""

from datetime import date, timedelta

from app.core.billing import DUE_SOON_DAYS, today_ist
from app.core.exceptions import AppMessages
from app.db.connection.psycopg_driver import exec_sql, get_client_db_connection
from app.db.sql.sql_base import SqlStore
from app.db.sql.sql_billing import BillingServerSql
from app.logger import logger
from app.services.signup_emails import send_text_email

# Arbitrary, fixed keys for pg_try_advisory_xact_lock: one per scheduled job.
BILLING_REMINDER_LOCK_KEY = 72_310_001
STOCK_SNAPSHOT_LOCK_KEY = 72_310_002

_TEXTS = {
    "due_soon": AppMessages.BILLING_EMAIL_REMINDER_DUE_SOON,
    "due_today": AppMessages.BILLING_EMAIL_REMINDER_DUE_TODAY,
    "first_payment": AppMessages.BILLING_EMAIL_REMINDER_FIRST,
    "lapsed": AppMessages.BILLING_EMAIL_REMINDER_LAPSED,
}


def reminder_kind(bu: dict, today: date) -> str | None:
    """Which reminder (if any) one billed BU should get today."""
    if bu.get("billing_hold") or bu.get("last_reminder_on") == today:
        return None
    paid_through = bu.get("paid_through")
    last_kind = bu.get("last_reminder_kind")
    if paid_through is None:
        return None if last_kind == "first_payment" else "first_payment"
    days_left = (paid_through - today).days
    if days_left == 0:
        kind = "due_today"
    elif days_left < 0:
        kind = "lapsed"
    elif days_left <= DUE_SOON_DAYS:
        kind = "due_soon"
    else:
        return None
    period_start = paid_through - timedelta(days=DUE_SOON_DAYS)
    last_on = bu.get("last_reminder_on")
    if last_kind == kind and last_on and last_on >= period_start:
        return None
    return kind


async def _remind_database(db_name: str, today: date) -> int:
    sent = 0
    for bu in await exec_sql(db_name, "security", BillingServerSql.GET_REMINDER_BUS):
        kind = reminder_kind(bu, today)
        if not kind:
            continue
        text = _TEXTS[kind].format(bu_name=bu["name"], due_date=bu["paid_through"])
        subject = AppMessages.BILLING_EMAIL_REMINDER_SUBJECT.format(bu_name=bu["name"])
        recipients = await exec_sql(db_name, "security", BillingServerSql.GET_BU_BILLING_RECIPIENTS, {"bu_id": bu["id"]})
        for row in recipients:
            await send_text_email(row["email"], subject, text)
        await exec_sql(db_name, "security", BillingServerSql.SET_BU_REMINDER, {"id": bu["id"], "kind": kind, "on": today})
        sent += 1
    return sent


async def run_billing_reminders() -> None:
    """The daily job. Only the process that wins the advisory lock sends."""
    async with get_client_db_connection() as conn:
        cur = await conn.execute("SELECT pg_try_advisory_xact_lock(%s) AS got", (BILLING_REMINDER_LOCK_KEY,))
        if not (await cur.fetchone())[0]:
            logger.info("Billing reminders: another process holds the lock; skipping")
            return
        today = today_ist()
        total = 0
        for client in await exec_sql(None, "public", SqlStore.GET_ACTIVE_CLIENTS):
            try:
                total += await _remind_database(client["db_name"], today)
            except Exception as e:  # pylint: disable=broad-except
                logger.error("Billing reminders failed for %s: %s", client["db_name"], e)
        logger.info("Billing reminders sent for %d BU(s)", total)
