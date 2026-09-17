"""
Shared GraphQL resolver guards for access-right enforcement.
"""
from app.core.exceptions import AppMessages, AuthorizationException

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


def require_user_type(info, allowed: set[str]) -> None:
    """
    Raise AuthorizationException unless the caller's userType is one of `allowed`.

    Unlike require_access_right, this checks WHO is calling directly and has no
    bypass — use it for resolvers gated by identity (Super Admin only, or Admin
    only), not by a specific access-right code. E.g. createBuSchemaAndFeedSeedData
    is `require_user_type(info, {"S"})` — no tenant's own Admin ever reaches it.
    """
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") not in allowed:
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"required_user_type": sorted(allowed)},
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


def require_own_tenant(info, db_name: str | None) -> None:
    """
    Raise AuthorizationException unless the requested db_name matches the
    caller's own tenant (from their token). Super Admin's token always
    carries db_name=None and is the only identity allowed to name any
    db_name — its provisioning resolvers (bu_admin/provisioning.py) don't
    call this guard at all, they're cross-tenant by construction. Business
    Admin ("A") is deliberately NOT bypassed here: an Admin's token still
    carries one fixed db_name and must never reach another tenant's database.
    """
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") == "S":
        return
    if context.get("db_name") != db_name:
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"reason": "tenant_mismatch"},
        )


def require_bu_access(info, schema: str | None) -> None:
    """
    Raise AuthorizationException unless `schema` is one of the caller's
    assigned BU codes (or the caller is Super Admin/Business Admin, who
    bypass — Admin owns every BU in their own tenant). `security`/`public`/
    falsy schemas are tenant-wide, not BU schemas, and always pass.

    A token minted before this guard existed carries no `bu_codes` claim at
    all; `context.get("bu_codes") or []` turns that into an empty list, so a
    real BU-schema request FAILS CLOSED on an old token instead of silently
    passing everything.
    """
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") in BYPASS_USER_TYPES:
        return
    normalized = (schema or "").lower()
    if not normalized or normalized in {"security", "public"}:
        return
    if normalized not in (context.get("bu_codes") or []):
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"reason": "bu_mismatch"},
        )
