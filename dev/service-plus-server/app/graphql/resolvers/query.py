"""
GraphQL Query resolvers.
"""
from datetime import datetime
from typing import Any
from ariadne import QueryType
from app.logger import logger
from app.exceptions import GraphQLException, AppMessages
from app.config import settings
from .query_helper import resolve_generic_query_helper, resolve_super_admin_dashboard_stats_helper


# Create QueryType instance
query = QueryType()

@query.field("genericQuery")
async def resolve_generic_query(_, info, db_name="", value="") -> Any:
    """
    Generic query resolver.

    Returns:
        Result of the generic query
    """
    try:
        return await resolve_generic_query_helper(db_name, value)

    except Exception as e:
        # Catch-all ONLY for unexpected crashes
        logger.error(f"Unexpected generic query failure: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.INTERNAL_SERVER_ERROR,
            extensions={"details": AppMessages.UNEXPECTED_ERROR}
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

