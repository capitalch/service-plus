"""
Shared GraphQL resolver guards for access-right enforcement.
"""
import re

from app.core.exceptions import AppMessages, AuthorizationException
from app.db.sql.sql_base import SqlStore

# userType tiers that bypass every access-right check, everywhere —
# matches the client's `hasAccessRight` bypass ("no restrictions on Admin").
BYPASS_USER_TYPES = {"S", "A"}

# A SqlStore text naming a tenant-wide or catalog schema reaches past the BU schema
# the caller sends: `search_path` only resolves unqualified names, so
# `security."user"` reads the whole tenant's users whatever `schema` says.
_TENANT_WIDE_SQL_PATTERN = re.compile(
    r'"?\b(security|public|pg_catalog|information_schema)\b"?\s*\.'
    r"|\bpg_(namespace|database|roles|user|authid|shadow|stat_activity|tables)\b",
    re.IGNORECASE,
)

# Built once at import: every SqlStore id whose text names a tenant-wide schema.
# genericQuery / genericBatchQuery refuse these to non-admins (plans/plan.md Step 1)
# unless the id is on NON_ADMIN_SECURITY_SQL_IDS below.
ADMIN_ONLY_SQL_IDS: frozenset[str] = frozenset(
    name
    for name in dir(SqlStore)
    if not name.startswith("_")
    and isinstance(getattr(SqlStore, name), str)
    and _TENANT_WIDE_SQL_PATTERN.search(getattr(SqlStore, name))
)

# Tenant-wide ids a business user's screens legitimately run. Each one only joins
# security."user" to show the name of whoever acted on a row of the caller's own BU
# (the join key comes from that BU's rows, never from a caller-sent user id), and
# selects nothing but id / full_name / username. Check any new entry the same way.
NON_ADMIN_SECURITY_SQL_IDS: frozenset[str] = frozenset({
    "GET_EW_LEADS_PAGED",
    "GET_EW_LEAD_DETAIL",
    "GET_EW_LEAD_TIMELINE",
    "GET_JOB_TRANSACTIONS_BY_JOB",
    "GET_JOB_TRANSACTION_DETAIL",
})


def require_authenticated(info) -> None:
    """
    Raise AuthorizationException unless the request carried a valid token.
    An expired/invalid token keeps its distinct TOKEN_EXPIRED answer so the
    client still refreshes and retries; a missing token is UNAUTHORIZED.
    """
    context = info.context or {}
    _reject_bad_token(context)
    if not context.get("user_type"):
        raise AuthorizationException(
            message=AppMessages.UNAUTHORIZED,
            extensions={"reason": "unauthenticated"},
        )


def require_default_customer_db(info, db_name: str | None) -> None:
    """
    Raise AuthorizationException unless `db_name` is the default customer database
    (settings.default_customer_db_name). Guards the platform owner's sign-up and
    subscription screens; pair it with require_own_tenant and require_user_type.
    """
    # Imported here: app.services.default_customer pulls in the DB driver, which the
    # pure guard tests in tests/test_auth_guards.py otherwise never load.
    from app.services.default_customer import is_default_customer_db  # pylint: disable=import-outside-toplevel

    context = info.context or {}
    _reject_bad_token(context)
    if not is_default_customer_db(db_name):
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"reason": "not_default_customer_db"},
        )


def require_sql_id_access(info, sql_id: str | None) -> None:
    """
    Raise AuthorizationException when a non-admin asks genericQuery /
    genericBatchQuery for a SqlStore id that names a tenant-wide schema
    (ADMIN_ONLY_SQL_IDS) and is not allowlisted. Super Admin and Admin pass.
    """
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") in BYPASS_USER_TYPES:
        return
    if sql_id in ADMIN_ONLY_SQL_IDS and sql_id not in NON_ADMIN_SECURITY_SQL_IDS:
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"reason": "admin_only_sql_id", "sql_id": sql_id},
        )


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
    only), not by a specific access-right code. E.g. createAdminUser is
    `require_user_type(info, {"S"})`, while createBuSchemaAndFeedSeedData pairs
    `require_own_tenant` with `{"S", "A"}` (plans/revert.md, constraint 2).
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
