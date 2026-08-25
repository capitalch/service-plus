"""Mobile-number validation/normalization for WhatsApp sends."""
import re


def normalize_mobile(mobile: str | None) -> str:
    """Digits-only with a leading 91 country code — the `to` format the Cloud API expects."""
    digits = re.sub(r"\D", "", mobile or "")
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def is_valid_mobile(mobile: str | None) -> bool:
    """Mirrors the client's isValidMobile: a 10-digit Indian mobile number, after
    stripping a +91/91 prefix."""
    digits = re.sub(r"\D", "", mobile or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return len(digits) == 10
