"""Remove phone numbers and email addresses before a question leaves the server
(the Gemini free tier may use requests to improve Google's products)."""

import re

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# 8 or more digits, with spaces or dashes allowed between them (+91 98765-43210, 0657 2345678).
NUMBER_RE = re.compile(r"\+?\d(?:[ -]?\d){7,}")


def redact(text: str) -> str:
    """`text` with emails as [email] and long digit runs as [number]."""
    return NUMBER_RE.sub("[number]", EMAIL_RE.sub("[email]", text))
