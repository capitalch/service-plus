"""A Manager adding Receptionist / Technician users (Configurations -> User Management).

createBusinessUser stays Admin-only for every other caller. A Manager may call it only when
every BU they name is one of their own and is on Standard or above, and the role they pick is
Receptionist or Technician: never Manager, never an Admin. The client hides the screen on
Lite / Basic, but this guard is what actually refuses.
"""

from app.core.exceptions import AppMessages, AuthorizationException
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_base import SqlStore
from app.graphql.resolvers.auth_guards import require_user_type
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.services.bu_billing import get_bu_billing

STAFF_ROLE_CODES = frozenset({"RECEPTIONIST", "TECHNICIAN"})

# Plans whose Manager may add users. A BU with no plan is not billed (no limits), like Enterprise.
USER_MANAGEMENT_PLAN_CODES = frozenset({"standard", "enterprise"})


def plan_allows_user_management(plan_code: str | None) -> bool:
    """Standard and above; a BU with no plan counts as unlimited."""
    return plan_code is None or plan_code in USER_MANAGEMENT_PLAN_CODES


async def require_manager_creates_staff_user(info, db_name: str, value: str) -> None:
    """Raise unless the caller is a Manager adding a Receptionist / Technician to their own
    BU(s) on a plan that allows it."""
    require_user_type(info, {"B"})
    context = info.context or {}
    if context.get("role_code") != "MANAGER":
        raise AuthorizationException(message=AppMessages.FORBIDDEN, extensions={"reason": "manager_only"})

    payload = _decode_value(value, "createBusinessUser")
    role_rows = await exec_sql(db_name, "security", SqlStore.GET_ROLE_CODE_BY_ID, {"id": payload.get("role_id") or 0})
    if not role_rows or role_rows[0]["code"] not in STAFF_ROLE_CODES:
        raise AuthorizationException(
            message=AppMessages.STAFF_USER_ROLE_NOT_ALLOWED,
            extensions={"reason": "staff_role_not_allowed"},
        )

    bu_ids = payload.get("bu_ids") or []
    bu_rows = await exec_sql(db_name, "security", SqlStore.GET_BU_CODES_BY_IDS, {"ids": bu_ids})
    own_codes = {c.lower() for c in context.get("bu_codes") or []}
    if not bu_ids or len(bu_rows) != len(set(bu_ids)) or any(r["code"].lower() not in own_codes for r in bu_rows):
        raise AuthorizationException(message=AppMessages.FORBIDDEN, extensions={"reason": "bu_mismatch"})

    for row in bu_rows:
        billing = await get_bu_billing(db_name, row["code"])
        if not plan_allows_user_management(billing["planCode"]):
            raise AuthorizationException(
                message=AppMessages.STAFF_USER_PLAN_REQUIRED,
                code="STAFF_USER_PLAN_REQUIRED",
                extensions={"planCode": billing["planCode"], "reason": "plan_too_low"},
            )
