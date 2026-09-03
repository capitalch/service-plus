"""One-time confirmation codes for paperless job delivery (plans/plan.md) — proof
that the customer read a code, delivered only via the WhatsApp message body, back
to a staff member at the counter. Deliberately a separate module from token.py:
that one signs a long-lived, self-contained link (no DB round-trip to verify);
this one hashes a short-lived, attempt-limited shared secret that a *person*
reads aloud, verified against a value stored server-side. Different shape,
different trust boundary, its own dedicated secret
(whatsapp_delivery_otp_secret) — never whatsapp_link_token_secret.
"""

import hashlib
import hmac
import secrets

from app.config import settings


def generate() -> str:
    """4-digit numeric code, cryptographically random — `secrets.randbelow`, not
    `random`, since this is a value someone could try to guess."""
    return f"{secrets.randbelow(10_000):04d}"


def hash_code(code: str) -> str:
    """HMAC-SHA256 over the plaintext code with the dedicated OTP secret — never
    store the code itself, only this. A 4-digit code has a small keyspace
    (10,000 possibilities) — online brute-force, not offline hash-cracking, is
    the real threat, which is why the short expiry and the 5-attempt lockout
    (sql_jobs.py) carry the actual security weight here, not the hash
    algorithm. That lockout is load-bearing precisely because the keyspace is
    this small — see plans/plan.md's Watch-outs."""
    return hmac.new(
        settings.whatsapp_delivery_otp_secret.encode("utf-8"), code.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def verify(code: str, otp_hash: str) -> bool:
    """Constant-time compare against a stored hash — never a plain `==`, which
    would leak timing information about how many leading characters matched."""
    return hmac.compare_digest(hash_code(code), otp_hash)
