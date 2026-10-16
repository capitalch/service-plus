"""Unit tests for the sign-up email codes (plans/plan.md Step 3) — no DB, no email:
exec_sql is replaced by a small in-memory security.signup_otp, the mailer is stubbed,
and the clock is a number the tests move forward."""
import asyncio
import json
import re

import pytest

from app.core.exceptions import AppMessages
from app.db.sql.sql_signups import SignupServerSql
from app.services import signup_otp
from app.services.signups import SignupException

EMAIL = "owner@example.com"
FORM = {"email": EMAIL, "name": "Asha Roy", "plan_code": "lite"}


class FakeOtpTable:
    """The rules of the five signup_otp statements, over a dict keyed by email."""

    def __init__(self):
        self.now = 0.0
        self.rows = {}

    async def exec_sql(self, db_name, schema, sql, sql_args=None):
        args = sql_args or {}
        row = self.rows.get(args.get("email"))
        if sql is SignupServerSql.PURGE_SIGNUP_OTP:
            self.rows = {k: r for k, r in self.rows.items() if r["last_sent_at"] >= self.now - 86400}
            return 0
        if sql is SignupServerSql.UPSERT_SIGNUP_OTP:
            fresh = {
                "attempts": 0,
                "code_hash": args["code_hash"],
                "expires_at": self.now + args["ttl_minutes"] * 60,
                "last_sent_at": self.now,
                "payload": args["payload"],
            }
            if row is None:
                self.rows[args["email"]] = {**fresh, "first_sent_at": self.now, "sent_count": 1}
                return [{"email": args["email"]}]
            window_over = row["first_sent_at"] < self.now - 3600
            if row["last_sent_at"] >= self.now - args["resend_seconds"] or (
                not window_over and row["sent_count"] >= args["max_sends"]
            ):
                return []
            row.update(fresh)
            row["first_sent_at"] = self.now if window_over else row["first_sent_at"]
            row["sent_count"] = 1 if window_over else row["sent_count"] + 1
            return [{"email": args["email"]}]
        if sql is SignupServerSql.GET_SIGNUP_OTP:
            if row is None:
                return []
            return [
                {
                    **row,
                    "expired": row["expires_at"] < self.now,
                    "too_soon": row["last_sent_at"] > self.now - args["resend_seconds"],
                }
            ]
        if sql is SignupServerSql.BUMP_SIGNUP_OTP_ATTEMPTS:
            if row is None or row["attempts"] >= args["max_attempts"]:
                return []
            row["attempts"] += 1
            return [{"attempts": row["attempts"]}]
        if sql is SignupServerSql.DELETE_SIGNUP_OTP:
            if row is None or row["code_hash"] != args["code_hash"] or row["expires_at"] < self.now:
                return []
            del self.rows[args["email"]]
            return [{"payload": json.loads(row["payload"])}]
        raise AssertionError(f"unexpected SQL: {sql[:60]}")


@pytest.fixture
def table(monkeypatch):
    fake = FakeOtpTable()
    fake.emails = []

    async def fake_client():
        return {"db_name": "service_plus_customers", "name": "Service Plus"}

    async def fake_send(to, subject, text, reply_to=None):
        fake.emails.append((to, subject, text))
        return True

    monkeypatch.setattr(signup_otp, "exec_sql", fake.exec_sql)
    monkeypatch.setattr(signup_otp, "get_default_customer_client", fake_client)
    monkeypatch.setattr(signup_otp, "send_text_email", fake_send)
    monkeypatch.setattr(signup_otp, "settings", type("S", (), {"signup_otp_secret": "x" * 32})())
    return fake


def sent_code(table) -> str:
    return re.search(r"\b(\d{6})\b", table.emails[-1][2]).group(1)


def refusal(coro) -> SignupException:
    with pytest.raises(SignupException) as e:
        asyncio.run(coro)
    return e.value


def test_code_is_six_digits():
    assert all(re.fullmatch(r"\d{6}", signup_otp.generate()) for _ in range(50))


def test_hash_is_bound_to_the_email(table):
    assert signup_otp.hash_code(EMAIL, "123456") != signup_otp.hash_code("other@example.com", "123456")


def test_right_code_returns_the_form_once(table):
    asyncio.run(signup_otp.send_code(EMAIL, FORM))
    assert table.emails[0][0] == EMAIL and table.emails[0][1] == AppMessages.SIGNUP_EMAIL_OTP_SUBJECT
    code = sent_code(table)
    assert table.rows[EMAIL]["code_hash"] == signup_otp.hash_code(EMAIL, code)  # the hash, never the code
    assert asyncio.run(signup_otp.verify_code(EMAIL, code)) == FORM
    assert refusal(signup_otp.verify_code(EMAIL, code)).code == "OTP_EXPIRED"


def test_wrong_code_counts_down_then_locks(table):
    asyncio.run(signup_otp.send_code(EMAIL, FORM))
    code = sent_code(table)
    wrong = "000000" if code != "000000" else "111111"
    for tries_left in (4, 3, 2, 1):
        e = refusal(signup_otp.verify_code(EMAIL, wrong))
        assert e.code == "OTP_INVALID" and e.extensions == {"tries_left": tries_left}
    assert refusal(signup_otp.verify_code(EMAIL, wrong)).code == "OTP_TOO_MANY"
    assert refusal(signup_otp.verify_code(EMAIL, code)).code == "OTP_TOO_MANY"


def test_code_expires_after_ten_minutes(table):
    asyncio.run(signup_otp.send_code(EMAIL, FORM))
    table.now += 10 * 60 + 1
    assert refusal(signup_otp.verify_code(EMAIL, sent_code(table))).code == "OTP_EXPIRED"


def test_resend_waits_a_minute_and_replaces_the_code(table):
    asyncio.run(signup_otp.send_code(EMAIL, FORM))
    first = sent_code(table)
    e = refusal(signup_otp.send_code(EMAIL, FORM))
    assert e.code == "OTP_TOO_MANY" and e.message == AppMessages.OTP_RESEND_WAIT
    table.now += 61
    asyncio.run(signup_otp.send_code(EMAIL, FORM))
    second = sent_code(table)
    if first != second:
        assert refusal(signup_otp.verify_code(EMAIL, first)).code == "OTP_INVALID"
    assert asyncio.run(signup_otp.verify_code(EMAIL, second)) == FORM


def test_at_most_five_codes_an_hour(table):
    for _ in range(5):
        asyncio.run(signup_otp.send_code(EMAIL, FORM))
        table.now += 61
    e = refusal(signup_otp.send_code(EMAIL, FORM))
    assert e.code == "OTP_TOO_MANY" and e.message == AppMessages.OTP_TOO_MANY_SENDS
    table.now += 3600
    asyncio.run(signup_otp.send_code(EMAIL, FORM))
    assert len(table.emails) == 6


def test_failed_email_is_refused(table, monkeypatch):
    async def failing_send(to, subject, text, reply_to=None):
        return False

    monkeypatch.setattr(signup_otp, "send_text_email", failing_send)
    assert refusal(signup_otp.send_code(EMAIL, FORM)).code == "OTP_EMAIL_FAILED"


def test_no_code_for_this_email(table):
    assert refusal(signup_otp.verify_code(EMAIL, "123456")).code == "OTP_EXPIRED"
