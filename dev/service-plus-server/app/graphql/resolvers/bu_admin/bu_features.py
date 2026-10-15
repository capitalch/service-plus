"""Optional features per BU, switched on by the Super Admin (app/core/bu_features.py).

`setBuFeatures` replaces the feature list of one or more BUs of one client database in a
single transaction, with every BU row locked, then clears the billing cache — features are
read with the cached billing row (services/bu_billing.py), so the change is seen at once by
this process and within BU_BILLING_CACHE_SECONDS by any other. It also rebuilds this process's
public company directory, so the website's Spare Parts page follows at once (other processes
within its 5-minute TTL).
"""

from typing import Any

from app.core.audit_log import AuditAction, audit_logger
from app.core.bu_features import BU_FEATURES
from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import get_service_db_connection
from app.db.sql.sql_billing import BillingServerSql
from app.graphql.resolvers.bu_admin.billing import _security_cursor
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.services.bu_billing import clear_bu_billing
from app.services.public_directory import public_directory


def _parse_bus(payload: dict) -> list[tuple[int, list[str]]]:
    """[(bu_id, sorted unique features)] from {bus: [{id, features}]}; refuses unknown names."""
    bus = payload.get("bus")
    if not isinstance(bus, list) or not bus:
        raise ValidationException(message=AppMessages.VALIDATION_ERROR, extensions={"field": "bus"})
    parsed: list[tuple[int, list[str]]] = []
    for bu in bus:
        features = bu.get("features") if isinstance(bu, dict) else None
        if not isinstance(features, list):
            raise ValidationException(message=AppMessages.VALIDATION_ERROR, extensions={"field": "features"})
        for feature in features:
            if feature not in BU_FEATURES:
                raise ValidationException(
                    message=AppMessages.BU_FEATURE_UNKNOWN.format(feature=feature),
                    extensions={"feature": feature},
                )
        try:
            bu_id = int(bu.get("id"))
        except (TypeError, ValueError) as e:
            raise ValidationException(message=AppMessages.VALIDATION_ERROR, extensions={"field": "id"}) from e
        parsed.append((bu_id, sorted(set(features))))
    return parsed


async def resolve_set_bu_features_helper(db_name: str, value: str) -> dict[str, Any]:
    """Value: { bus: [{ id, features: [name, …] }] }. Returns { bus: [{ id, features }] }."""
    bus = _parse_bus(_decode_value(value, "setBuFeatures"))

    async with get_service_db_connection(db_name) as conn:
        cur = await _security_cursor(conn)
        await cur.execute(BillingServerSql.LOCK_ALL_BUS)
        codes = {row["id"]: row["code"] for row in await cur.fetchall()}
        for bu_id, _ in bus:
            if bu_id not in codes:
                raise ValidationException(
                    message=AppMessages.BU_FEATURES_BU_UNKNOWN.format(bu_id=bu_id), extensions={"bu_id": bu_id}
                )
        for bu_id, features in bus:
            await cur.execute(BillingServerSql.SET_BU_FEATURES, {"features": features, "id": bu_id})

    clear_bu_billing(db_name)
    # The website's Spare Parts page reads parts_enabled from the directory's own cache.
    public_directory.invalidate()
    await audit_logger.log(
        action=AuditAction.SET_BU_FEATURES,
        actor_type="super_admin",
        actor_username="super_admin",
        detail="; ".join(f"{codes[bu_id]}: {', '.join(features) or 'none'}" for bu_id, features in bus),
        resource_name=db_name,
        resource_type="bu_features",
    )
    return {"bus": [{"features": features, "id": bu_id} for bu_id, features in bus]}
