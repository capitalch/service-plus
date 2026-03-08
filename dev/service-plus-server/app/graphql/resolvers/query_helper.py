import json
from urllib.parse import unquote

from app.db.psycopg_driver import exec_sql
from app.db.sql_auth import SqlAuth
from app.exceptions import AppMessages, ValidationException
from app.logger import logger


async def resolve_generic_query_helper(db_name: str, schema: str = "public", value: str = ""):
    logger.info("Generic query requested")

    if not value:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "value"},
        )

    try:
        params: dict = json.loads(unquote(value))
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Invalid JSON in genericQuery value: {e}")
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_VALUE},
        )

    sql_id:   str  = params.get("sqlId", "")
    sql_args: dict = params.get("sqlArgs", {}) or {}

    sql = getattr(SqlAuth, sql_id, None)
    if not sql:
        logger.error(f"Unknown sqlId in genericQuery: {sql_id!r}")
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": f"Unknown sqlId: {sql_id}"},
        )

    db_name_arg = db_name if db_name else None
    rows = await exec_sql(db_name_arg, schema or "public", sql, sql_args, text_dates=True)

    logger.info(f"Generic query completed successfully: sqlId={sql_id!r}")
    return rows


async def resolve_super_admin_clients_data_helper():
    logger.info("Super admin clients data requested")

    client_stats_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.GET_CLIENT_STATS)
    client_stats = client_stats_rows[0] if client_stats_rows else {}

    client_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.GET_CLIENT_DB_NAMES)

    clients_data = []

    for client_row in client_rows:
        db_name_val = client_row.get("db_name")
        active_admin   = 0
        inactive_admin = 0

        db_name_valid = False
        if db_name_val:
            exists_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.CHECK_DB_NAME_EXISTS, sql_args={"db_name": db_name_val})
            if exists_rows and exists_rows[0].get("exists"):
                db_name_valid = True
                bu_rows = await exec_sql(db_name=db_name_val, schema="security", sql=SqlAuth.GET_BU_USER_STATS)
                if bu_rows:
                    r = bu_rows[0]
                    active_admin   = r.get("active_admin_users", 0)
                    inactive_admin = r.get("inactive_admin_users", 0)
            else:
                logger.warning(f"Database '{db_name_val}' not found – flagging client")

        clients_data.append({
            "activeAdminCount":   active_admin,
            "address_line1":      client_row.get("address_line1"),
            "address_line2":      client_row.get("address_line2"),
            "city":               client_row.get("city"),
            "code":               client_row.get("code"),
            "country_code":       client_row.get("country_code"),
            "created_at":         client_row["created_at"].isoformat() if client_row.get("created_at") else None,
            "db_name":            db_name_val,
            "db_name_valid":      db_name_valid,
            "email":              client_row.get("email"),
            "gstin":              client_row.get("gstin"),
            "id":                 client_row.get("id"),
            "inactiveAdminCount": inactive_admin,
            "is_active":          client_row.get("is_active"),
            "name":               client_row.get("name"),
            "pan":                client_row.get("pan"),
            "phone":              client_row.get("phone"),
            "pincode":            client_row.get("pincode"),
            "state":              client_row.get("state"),
            "updated_at":         client_row["updated_at"].isoformat() if client_row.get("updated_at") else None,
        })

    logger.info("Super admin clients data completed successfully")
    return {
        "activeClients":   client_stats.get("active_clients", 0),
        "clients":         clients_data,
        "inactiveClients": client_stats.get("inactive_clients", 0),
        "totalClients":    client_stats.get("total_clients", 0),
    }


async def resolve_super_admin_dashboard_stats_helper():
    logger.info("Super admin dashboard stats requested")

    client_stats_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.GET_CLIENT_STATS)
    client_stats = client_stats_rows[0] if client_stats_rows else {}

    client_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.GET_CLIENT_DB_NAMES)

    active_admin_users = active_bu = active_users = inactive_admin_users = inactive_bu = inactive_users = total_admin_users = total_bu = total_users = 0

    for client_row in client_rows:
        db_name_val = client_row.get("db_name")

        if db_name_val:
            exists_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.CHECK_DB_NAME_EXISTS, sql_args={"db_name": db_name_val})
            if not (exists_rows and exists_rows[0].get("exists")):
                logger.warning(f"Database '{db_name_val}' not found – skipping")
                continue

            bu_rows = await exec_sql(db_name=db_name_val, schema="security", sql=SqlAuth.GET_BU_USER_STATS)
            if bu_rows:
                r = bu_rows[0]
                active_admin_users   += r.get("active_admin_users", 0)
                active_bu            += r.get("active_bu", 0)
                active_users         += r.get("active_users", 0)
                inactive_admin_users += r.get("inactive_admin_users", 0)
                inactive_bu          += r.get("inactive_bu", 0)
                inactive_users       += r.get("inactive_users", 0)
                total_admin_users    += r.get("total_admin_users", 0)
                total_bu             += r.get("total_bu", 0)
                total_users          += r.get("total_users", 0)

    logger.info("Super admin dashboard stats completed successfully")
    return {
        "activeAdminUsers":   active_admin_users,
        "activeBu":           active_bu,
        "activeClients":      client_stats.get("active_clients", 0),
        "activeUsers":        active_users,
        "inactiveAdminUsers": inactive_admin_users,
        "inactiveBu":         inactive_bu,
        "inactiveClients":    client_stats.get("inactive_clients", 0),
        "inactiveUsers":      inactive_users,
        "totalAdminUsers":    total_admin_users,
        "totalBu":            total_bu,
        "totalClients":       client_stats.get("total_clients", 0),
        "totalUsers":         total_users,
    }