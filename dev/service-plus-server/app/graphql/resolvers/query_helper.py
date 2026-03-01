from datetime import datetime
from app.db.database import exec_sql
from app.db.sql_auth import SqlAuth
from app.logger import logger
from app.exceptions import AppMessages
from app.config import settings


async def resolve_generic_query_helper(db_name: str, value: str):
    logger.info("Generic query requested")
    query_data = {
        "status": "OK",
        "message": AppMessages.HEALTH_CHECK_OK,
        "timestamp": datetime.now().isoformat(),
        "version": settings.app_version,
        "db_name": db_name,
        "value": value
    }
    logger.info("Generic query completed successfully")
    return query_data


async def resolve_super_admin_dashboard_stats_helper():
    logger.info("Super admin dashboard stats requested")

    client_stats_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.GET_CLIENT_STATS)
    client_stats = client_stats_rows[0] if client_stats_rows else {}

    client_rows = await exec_sql(db_name=None, schema="public", sql=SqlAuth.GET_CLIENT_DB_NAMES)

    active_admin_users = active_bu = active_users = inactive_admin_users = inactive_bu = inactive_users = total_admin_users = total_bu = total_users = 0
    clients_data = []

    for client_row in client_rows:
        db_name_val = client_row.get("db_name")
        active_admin   = 0
        inactive_admin = 0

        if db_name_val:
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
                active_admin   = r.get("active_admin_users", 0)
                inactive_admin = r.get("inactive_admin_users", 0)

        clients_data.append({
            "activeAdminCount":   active_admin,
            "code":               client_row.get("code"),
            "created_at":         client_row["created_at"].isoformat() if client_row.get("created_at") else None,
            "db_name":            db_name_val,
            "id":                 client_row.get("id"),
            "inactiveAdminCount": inactive_admin,
            "is_active":          client_row.get("is_active"),
            "name":               client_row.get("name"),
            "updated_at":         client_row["updated_at"].isoformat() if client_row.get("updated_at") else None,
        })

    logger.info("Super admin dashboard stats completed successfully")
    return {
        "activeAdminUsers":   active_admin_users,
        "activeBu":           active_bu,
        "activeClients":      client_stats.get("active_clients", 0),
        "activeUsers":        active_users,
        "clients":            clients_data,
        "inactiveAdminUsers": inactive_admin_users,
        "inactiveBu":         inactive_bu,
        "inactiveClients":    client_stats.get("inactive_clients", 0),
        "inactiveUsers":      inactive_users,
        "totalAdminUsers":    total_admin_users,
        "totalBu":            total_bu,
        "totalClients":       client_stats.get("total_clients", 0),
        "totalUsers":         total_users,
    }