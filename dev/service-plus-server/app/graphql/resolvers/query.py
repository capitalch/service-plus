"""
GraphQL Query resolvers.
"""
from typing import Any
from ariadne import QueryType
from app.graphql.resolvers.error_handling import handle_query_errors
from app.graphql.resolvers.reports_audit.queries import (
    resolve_admin_dashboard_stats_helper,
    resolve_audit_log_stats_helper,
    resolve_audit_logs_helper,
    resolve_super_admin_clients_data_helper,
    resolve_super_admin_dashboard_stats_helper,
    resolve_system_settings_helper,
    resolve_usage_health_helper,
)
from app.graphql.resolvers.shared.generic_query import (
    resolve_generic_batch_query_helper,
    resolve_generic_query_helper,
)
from app.whatsapp.sender import get_job_delivery_otp_pending


# Create QueryType instance
query = QueryType()


@query.field("adminDashboardStats")
@handle_query_errors("Unexpected admin dashboard stats failure")
async def resolve_admin_dashboard_stats(_, info, db_name: str = "") -> Any:
    return await resolve_admin_dashboard_stats_helper(db_name)


@query.field("auditLogs")
@handle_query_errors("Unexpected audit logs failure")
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
    return await resolve_audit_logs_helper(
        action=action, actor=actor, from_date=from_date,
        outcome=outcome, page=page, page_size=page_size,
        search=search, to_date=to_date,
    )


@query.field("auditLogStats")
@handle_query_errors("Unexpected audit log stats failure")
async def resolve_audit_log_stats(
    _, info,
    from_date: str | None = None,
    to_date: str | None = None,
) -> Any:
    return await resolve_audit_log_stats_helper(from_date=from_date, to_date=to_date)


@query.field("genericBatchQuery")
@handle_query_errors("Unexpected genericBatchQuery failure")
async def resolve_generic_batch_query(_, info, db_name="", items=None) -> Any:
    return await resolve_generic_batch_query_helper(db_name, items or [])


@query.field("genericQuery")
@handle_query_errors("Unexpected generic query failure")
async def resolve_generic_query(_, info, db_name="", schema="public", value="") -> Any:
    """
    Generic query resolver.

    Returns:
        Result of the generic query
    """
    return await resolve_generic_query_helper(db_name, schema, value)


@query.field("getJobDeliveryOtpPending")
@handle_query_errors("Unexpected getJobDeliveryOtpPending failure")
async def resolve_get_job_delivery_otp_pending(_, info, db_name="", schema="public", value="") -> Any:
    """Whether a still-valid, unconfirmed delivery OTP is already waiting for
    this exact job set — feeds the "Verify Code" affordance (plans/plan.md,
    Step 4) so a staff member who loses the OTP dialog can resume verification
    without a fresh (and first-code-invalidating) resend."""
    return await get_job_delivery_otp_pending(db_name, schema, value)


@query.field("superAdminClientsData")
@handle_query_errors("Unexpected super admin clients data failure")
async def resolve_super_admin_clients_data(_, info) -> Any:
    """
    Super admin clients data resolver.

    Returns:
        Client rows with per-client admin counts and client-level stats
    """
    return await resolve_super_admin_clients_data_helper()


@query.field("usageHealth")
@handle_query_errors("Unexpected usage health failure")
async def resolve_usage_health(_, info) -> Any:
    return await resolve_usage_health_helper()


@query.field("systemSettings")
@handle_query_errors("Unexpected system settings failure")
async def resolve_system_settings(_, info) -> Any:
    return await resolve_system_settings_helper()


@query.field("superAdminDashboardStats")
@handle_query_errors("Unexpected super admin dashboard stats failure")
async def resolve_super_admin_dashboard_stats(_, info) -> Any:
    """
    Super admin dashboard stats resolver.

    Returns:
        Aggregated stats across all clients, BUs and admin users
    """
    return await resolve_super_admin_dashboard_stats_helper()
