"""
GraphQL Query resolvers.
"""
# from datetime import datetime
from typing import Any
from ariadne import QueryType
from app.logger import logger
from app.exceptions import GraphQLException, AppMessages
# from app.config import settings
from .query_helper import (
    resolve_admin_dashboard_stats_helper,
    resolve_audit_log_stats_helper,
    resolve_audit_logs_helper,
    resolve_generic_query_helper,
    resolve_super_admin_clients_data_helper,
    resolve_super_admin_dashboard_stats_helper,
    resolve_system_settings_helper,
    resolve_usage_health_helper,
)


# Create QueryType instance
query = QueryType()


@query.field("adminDashboardStats")
async def resolve_admin_dashboard_stats(_, info, db_name: str = "") -> Any:
    try:
        return await resolve_admin_dashboard_stats_helper(db_name)
    except Exception as e:
        logger.error(f"Unexpected admin dashboard stats failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR},
        )


@query.field("auditLogs")
async def resolve_audit_logs(
    _, info,
    action: str | None = None,
    actor: str | None = None,
    from_date: str | None = None,
    outcome: str | None = None,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    to_date: str | None = None,
) -> Any:
    try:
        return await resolve_audit_logs_helper(
            action=action, actor=actor, from_date=from_date,
            outcome=outcome, page=page, page_size=page_size,
            search=search, to_date=to_date,
        )
    except Exception as e:
        logger.error(f"Unexpected audit logs failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR},
        )


@query.field("auditLogStats")
async def resolve_audit_log_stats(
    _, info,
    from_date: str | None = None,
    to_date: str | None = None,
) -> Any:
    try:
        return await resolve_audit_log_stats_helper(from_date=from_date, to_date=to_date)
    except Exception as e:
        logger.error(f"Unexpected audit log stats failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR},
        )


@query.field("genericQuery")
async def resolve_generic_query(_, info, db_name="", schema="public", value="") -> Any:
    """
    Generic query resolver.

    Returns:
        Result of the generic query
    """
    try:
        return await resolve_generic_query_helper(db_name, schema, value)

    except Exception as e:
        # Catch-all ONLY for unexpected crashes
        logger.error(f"Unexpected generic query failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR}
        )


@query.field("superAdminClientsData")
async def resolve_super_admin_clients_data(_, info) -> Any:
    """
    Super admin clients data resolver.

    Returns:
        Client rows with per-client admin counts and client-level stats
    """
    try:
        return await resolve_super_admin_clients_data_helper()

    except Exception as e:
        logger.error(f"Unexpected super admin clients data failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR}
        )


@query.field("usageHealth")
async def resolve_usage_health(_, info) -> Any:
    try:
        return await resolve_usage_health_helper()
    except Exception as e:
        logger.error(f"Unexpected usage health failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR},
        )


@query.field("systemSettings")
async def resolve_system_settings(_, info) -> Any:
    try:
        return await resolve_system_settings_helper()
    except Exception as e:
        logger.error(f"Unexpected system settings failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR},
        )


@query.field("superAdminDashboardStats")
async def resolve_super_admin_dashboard_stats(_, info) -> Any:
    """
    Super admin dashboard stats resolver.

    Returns:
        Aggregated stats across all clients, BUs and admin users
    """
    try:

        return await resolve_super_admin_dashboard_stats_helper()

    except Exception as e:
        # Catch-all ONLY for unexpected crashes
        logger.error(f"Unexpected super admin dashboard stats failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR}
        )
