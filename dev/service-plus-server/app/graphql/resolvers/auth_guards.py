"""
Shared GraphQL resolver guards for access-right enforcement.
"""
from app.exceptions import AppMessages, AuthorizationException

# userType tiers that bypass every access-right check, everywhere —
# matches the client's `hasAccessRight` bypass ("no restrictions on Admin").
BYPASS_USER_TYPES = {"S", "A"}


def _reject_bad_token(context: dict) -> None:
    """
    Raise a distinctly-coded AuthorizationException when the request presented
    a token that was rejected (expired/invalid). Keeping this separate from the
    FORBIDDEN path lets the client tell "your session lapsed, refresh & retry"
    apart from "you genuinely lack this right".
    """
    if context.get("auth_error"):
        raise AuthorizationException(
            message=context["auth_error"],
            code="TOKEN_EXPIRED",
        )


def require_access_right(info, code: str) -> None:
    """
    Raise AuthorizationException unless the requesting user's token carries
    the given access-right code (or the user is Super Admin / Business Admin,
    both of which bypass every right check).
    """
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") in BYPASS_USER_TYPES:
        return
    if code not in (context.get("access_rights") or []):
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"required_access_right": code},
        )


def require_any_access_right(info, codes: list[str]) -> None:
    """
    Raise AuthorizationException unless the requesting user's token carries
    at least one of the given access-right codes (or bypasses via userType).

    Used where a single resolver legitimately serves more than one gated
    area (e.g. `createJobPayment`, called from both the Receipts screen and
    the Deliver Job payment step) — see plans/plan.md's "Bonus" note.
    """
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") in BYPASS_USER_TYPES:
        return
    granted = context.get("access_rights") or []
    if not any(code in granted for code in codes):
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"required_access_right_any_of": codes},
        )
