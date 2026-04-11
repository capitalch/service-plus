import asyncio
import json
import socket
import time as _time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote

from app.config import settings
from app.core.audit_log import audit_logger
from app.db.psycopg_driver import exec_sql
from app.db.sql_store import SqlStore
from app.exceptions import AppMessages, ValidationException
from app.logger import logger

_MODULE_LOAD_TIME: float = _time.time()


async def resolve_admin_dashboard_stats_helper(db_name: str) -> dict:
    """Return BU/user stats and 7-day audit event count for a single client DB."""
    logger.info(f"Admin dashboard stats requested for db_name={db_name!r}")

    today    = date.today()
    week_ago = today - timedelta(days=6)

    bu_rows = await exec_sql(db_name=db_name, schema="security", sql=SqlStore.GET_BU_USER_STATS)
    row = bu_rows[0] if bu_rows else {}

    audit_stats = await audit_logger.stats(week_ago, today)

    return {
        "activeAdminUsers":    int(row.get("active_admin_users",   0)),
        "activeBusinessUsers": int(row.get("active_users",   0)) - int(row.get("active_admin_users",   0)),
        "activeBu":            int(row.get("active_bu",            0)),
        "auditEventsWeek":     int(audit_stats.get("totalEvents",  0)),
        "inactiveAdminUsers":    int(row.get("inactive_admin_users", 0)),
        "inactiveBusinessUsers": int(row.get("inactive_users", 0)) - int(row.get("inactive_admin_users", 0)),
        "inactiveBu":          int(row.get("inactive_bu",          0)),
        "totalAdminUsers":    int(row.get("total_admin_users",    0)),
        "totalBusinessUsers": int(row.get("total_users",    0)) - int(row.get("total_admin_users",    0)),
        "totalBu":            int(row.get("total_bu",             0)),
    }


async def resolve_audit_log_stats_helper(
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict:
    today = date.today()
    fd = date.fromisoformat(from_date) if from_date else (today - timedelta(days=30))
    td = date.fromisoformat(to_date)   if to_date   else today
    if (td - fd).days > settings.audit_log_max_read_days:
        fd = td - timedelta(days=settings.audit_log_max_read_days)
    logger.info(f"Audit log stats requested: {fd} to {td}")
    return await audit_logger.stats(fd, td)


async def resolve_audit_logs_helper(
    action: str | None = None,
    actor: str | None = None,
    from_date: str | None = None,
    outcome: str | None = None,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    to_date: str | None = None,
) -> dict:
    today = date.today()
    fd = date.fromisoformat(from_date) if from_date else (today - timedelta(days=30))
    td = date.fromisoformat(to_date)   if to_date   else today
    if (td - fd).days > settings.audit_log_max_read_days:
        fd = td - timedelta(days=settings.audit_log_max_read_days)
    page_size = min(page_size or 50, 200)
    logger.info(f"Audit logs requested: {fd} to {td}, page={page}")
    return await audit_logger.query(
        action=action,
        actor=actor,
        from_date=fd,
        outcome=outcome,
        page=page,
        page_size=page_size,
        search=search,
        to_date=td,
    )


async def resolve_system_settings_helper() -> dict:
    logger.info("System settings requested")
    return {
        "application": {
            "app_name":    settings.app_name,
            "app_version": settings.app_version,
            "debug":       settings.debug,
            "host":        settings.host,
            "port":        settings.port,
        },
        "audit_log": {
            "audit_log_dir":            settings.audit_log_dir,
            "audit_log_max_read_days":  settings.audit_log_max_read_days,
            "audit_log_retention_days": settings.audit_log_retention_days,
        },
        "security": {
            "access_token_expire_minutes": settings.access_token_expire_minutes,
            "algorithm":                   settings.algorithm,
            "refresh_token_expire_days":   settings.refresh_token_expire_days,
        },
        "smtp": {
            "smtp_from":     settings.smtp_from,
            "smtp_host":     settings.smtp_host,
            "smtp_password": "***",
            "smtp_port":     settings.smtp_port,
            "smtp_user":     settings.smtp_user,
        },
        "super_admin": {
            "super_admin_email":         settings.super_admin_email,
            "super_admin_mobile":        settings.super_admin_mobile,
            "super_admin_password_hash": "***",
            "super_admin_username":      settings.super_admin_username,
        },
    }


async def resolve_usage_health_helper() -> dict:
    logger.info("Usage health data requested")

    async def _check_api() -> dict:
        elapsed = int(_time.time() - _MODULE_LOAD_TIME)
        hours, rem = divmod(elapsed, 3600)
        minutes = rem // 60
        return {
            "detail":     f"Running — uptime {hours}h {minutes}m",
            "latency_ms": None,
            "name":       "API Server",
            "status":     "Healthy",
        }

    async def _check_platform_db() -> dict:
        try:
            t0 = _time.perf_counter()
            await exec_sql(db_name=None, schema="public", sql="SELECT 1 AS ok")
            latency_ms = round((_time.perf_counter() - t0) * 1000)
            return {
                "detail":     "service_plus_client",
                "latency_ms": latency_ms,
                "name":       "Platform Database",
                "status":     "Healthy",
            }
        except Exception as e:
            return {
                "detail":     str(e)[:100],
                "latency_ms": None,
                "name":       "Platform Database",
                "status":     "Down",
            }

    async def _check_smtp() -> dict:
        try:
            loop = asyncio.get_event_loop()
            t0 = _time.perf_counter()
            sock = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: socket.create_connection(
                        (settings.smtp_host, settings.smtp_port), timeout=3
                    ),
                ),
                timeout=4.0,
            )
            sock.close()
            latency_ms = round((_time.perf_counter() - t0) * 1000)
            return {
                "detail":     f"{settings.smtp_host}:{settings.smtp_port}",
                "latency_ms": latency_ms,
                "name":       "SMTP Server",
                "status":     "Healthy",
            }
        except Exception as e:
            return {
                "detail":     str(e)[:100],
                "latency_ms": None,
                "name":       "SMTP Server",
                "status":     "Down",
            }

    async def _check_audit_log_health() -> dict:
        log_dir = Path(settings.audit_log_dir)
        if not log_dir.exists():
            return {
                "detail":     f"Directory not found: {settings.audit_log_dir}",
                "latency_ms": None,
                "name":       "Audit Log",
                "status":     "Down",
            }
        files = list(log_dir.glob("audit_*.jsonl"))
        last_write_ts = max((f.stat().st_mtime for f in files), default=None)
        detail = f"{len(files)} file(s)"
        if last_write_ts:
            last_write = datetime.fromtimestamp(last_write_ts).strftime("%Y-%m-%d %H:%M")
            detail += f" — last write {last_write}"
        return {
            "detail":     detail,
            "latency_ms": None,
            "name":       "Audit Log",
            "status":     "Healthy",
        }

    async def _get_audit_log_stats() -> dict:
        today_date = date.today()
        week_start = today_date - timedelta(days=6)
        today_stats = await audit_logger.stats(today_date, today_date)
        week_stats  = await audit_logger.stats(week_start, today_date)
        log_dir = Path(settings.audit_log_dir)
        files = list(log_dir.glob("audit_*.jsonl")) if log_dir.exists() else []
        total_bytes = sum(f.stat().st_size for f in files)
        last_write = None
        if files:
            latest = max(files, key=lambda f: f.stat().st_mtime)
            last_write = datetime.fromtimestamp(latest.stat().st_mtime).isoformat()
        return {
            "file_count":  len(files),
            "last_write":  last_write,
            "size_bytes":  total_bytes,
            "today_count": today_stats.get("totalEvents", 0),
            "week_count":  week_stats.get("totalEvents", 0),
        }

    async def _get_db_sizes() -> list:
        try:
            sql = """
                SELECT datname, pg_database_size(datname) AS size_bytes
                FROM pg_database
                WHERE datname LIKE 'service_plus_%%'
                ORDER BY size_bytes DESC
            """
            rows = await exec_sql(db_name=None, schema="public", sql=sql)
            return [{"db_name": r["datname"], "size_bytes": int(r["size_bytes"])} for r in rows]
        except Exception as e:
            logger.warning(f"DB size query failed: {e}")
            return []

    async def _get_platform_stats() -> dict:
        try:
            client_stats_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_CLIENT_STATS)
            client_stats = client_stats_rows[0] if client_stats_rows else {}
            client_rows  = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_CLIENT_DB_NAMES)
            total_dbs    = sum(1 for r in client_rows if r.get("db_name"))
            total_admins = 0
            for client_row in client_rows:
                db_name_val = client_row.get("db_name")
                if not db_name_val:
                    continue
                try:
                    exists_rows = await exec_sql(
                        db_name=None, schema="public",
                        sql=SqlStore.CHECK_DB_NAME_EXISTS,
                        sql_args={"db_name": db_name_val},
                    )
                    if not (exists_rows and exists_rows[0].get("exists")):
                        continue
                    bu_rows = await exec_sql(db_name=db_name_val, schema="security", sql=SqlStore.GET_BU_USER_STATS)
                    if bu_rows:
                        total_admins += int(bu_rows[0].get("total_admin_users", 0))
                except Exception:
                    pass
            return {
                "active_clients":   int(client_stats.get("active_clients", 0)),
                "inactive_clients": int(client_stats.get("inactive_clients", 0)),
                "total_admins":     total_admins,
                "total_clients":    int(client_stats.get("total_clients", 0)),
                "total_dbs":        total_dbs,
            }
        except Exception as e:
            logger.warning(f"Platform stats query failed: {e}")
            return {
                "active_clients": 0, "inactive_clients": 0,
                "total_admins": 0, "total_clients": 0, "total_dbs": 0,
            }

    # Run all checks concurrently
    (
        api_check, db_check, smtp_check, audit_health,
        audit_stats, db_sizes, platform_stats,
    ) = await asyncio.gather(
        _check_api(),
        _check_platform_db(),
        _check_smtp(),
        _check_audit_log_health(),
        _get_audit_log_stats(),
        _get_db_sizes(),
        _get_platform_stats(),
    )

    # Derive overall status from service checks
    services = [api_check, db_check, smtp_check, audit_health]
    statuses = {s["status"] for s in services}
    if statuses == {"Healthy"}:
        overall_status = "Healthy"
    elif "Healthy" in statuses:
        overall_status = "Degraded"
    else:
        overall_status = "Down"

    # Server info
    elapsed = int(_time.time() - _MODULE_LOAD_TIME)
    hours, rem = divmod(elapsed, 3600)
    minutes = rem // 60

    logger.info("Usage health data assembled successfully")
    return {
        "audit_log":      audit_stats,
        "db_sizes":       db_sizes,
        "overall_status": overall_status,
        "platform_stats": platform_stats,
        "server_info": {
            "algorithm":   settings.algorithm,
            "app_name":    settings.app_name,
            "app_version": settings.app_version,
            "debug":       settings.debug,
            "host":        settings.host,
            "port":        settings.port,
            "uptime":      f"{hours}h {minutes}m",
        },
        "services": services,
    }


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

    sql = getattr(SqlStore, sql_id, None)
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

    client_stats_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_CLIENT_STATS)
    client_stats = client_stats_rows[0] if client_stats_rows else {}

    client_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_CLIENT_DB_NAMES)

    clients_data = []
    total_active_admins   = 0
    total_inactive_admins = 0

    for client_row in client_rows:
        db_name_val = client_row.get("db_name")
        active_admin   = 0
        active_bu      = 0
        admins         = []
        inactive_admin = 0
        inactive_bu    = 0

        db_name_valid = False
        if db_name_val:
            exists_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.CHECK_DB_NAME_EXISTS, sql_args={"db_name": db_name_val})
            if exists_rows and exists_rows[0].get("exists"):
                db_name_valid = True
                bu_rows = await exec_sql(db_name=db_name_val, schema="security", sql=SqlStore.GET_BU_USER_STATS)
                if bu_rows:
                    r = bu_rows[0]
                    active_admin   = r.get("active_admin_users", 0)
                    active_bu      = r.get("active_bu", 0)
                    inactive_admin = r.get("inactive_admin_users", 0)
                    inactive_bu    = r.get("inactive_bu", 0)

                admin_rows = await exec_sql(db_name=db_name_val, schema="security", sql=SqlStore.GET_ADMIN_USERS)
                for a in admin_rows:
                    admins.append({
                        "created_at": a["created_at"].isoformat() if a.get("created_at") else None,
                        "email":      a.get("email"),
                        "full_name":  a.get("full_name"),
                        "id":         a.get("id"),
                        "is_active":  a.get("is_active"),
                        "mobile":     a.get("mobile"),
                        "updated_at": a["updated_at"].isoformat() if a.get("updated_at") else None,
                        "username":   a.get("username"),
                    })
            else:
                logger.warning(f"Database '{db_name_val}' not found – flagging client")

        total_active_admins   += active_admin
        total_inactive_admins += inactive_admin

        clients_data.append({
            "activeAdminCount":   active_admin,
            "activeBuCount":      active_bu,
            "address_line1":      client_row.get("address_line1"),
            "address_line2":      client_row.get("address_line2"),
            "admins":             admins,
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
            "inactiveBuCount":    inactive_bu,
            "is_active":          client_row.get("is_active"),
            "name":               client_row.get("name"),
            "pan":                client_row.get("pan"),
            "phone":              client_row.get("phone"),
            "pincode":            client_row.get("pincode"),
            "state":              client_row.get("state"),
            "updated_at":         client_row["updated_at"].isoformat() if client_row.get("updated_at") else None,
        })

    orphan_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_ORPHAN_DATABASES)
    orphan_databases = [row["datname"] for row in orphan_rows]

    logger.info("Super admin clients data completed successfully")
    return {
        "activeAdmins":        total_active_admins,
        "activeClients":       client_stats.get("active_clients", 0),
        "clients":             clients_data,
        "inactiveAdmins":      total_inactive_admins,
        "inactiveClients":     client_stats.get("inactive_clients", 0),
        "orphanDatabaseCount": len(orphan_databases),
        "orphanDatabases":     orphan_databases,
        "totalAdmins":         total_active_admins + total_inactive_admins,
        "totalClients":        client_stats.get("total_clients", 0),
    }


async def resolve_super_admin_dashboard_stats_helper():
    logger.info("Super admin dashboard stats requested")

    client_stats_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_CLIENT_STATS)
    client_stats = client_stats_rows[0] if client_stats_rows else {}

    client_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.GET_CLIENT_DB_NAMES)

    active_admin_users = active_bu = active_users = inactive_admin_users = inactive_bu = inactive_users = total_admin_users = total_bu = total_users = 0

    for client_row in client_rows:
        db_name_val = client_row.get("db_name")

        if db_name_val:
            exists_rows = await exec_sql(db_name=None, schema="public", sql=SqlStore.CHECK_DB_NAME_EXISTS, sql_args={"db_name": db_name_val})
            if not (exists_rows and exists_rows[0].get("exists")):
                logger.warning(f"Database '{db_name_val}' not found – skipping")
                continue

            bu_rows = await exec_sql(db_name=db_name_val, schema="security", sql=SqlStore.GET_BU_USER_STATS)
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