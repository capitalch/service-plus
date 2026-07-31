"""
Smoke test for the Step 4 resolver split: reports_audit/queries.py.

This one actually runs against the real dev DB (read-only query, no mutation) —
see plans/plan.md Step 6.2. Requires DB connectivity via app/config.py's .env.
"""
import pytest

from app.graphql.resolvers.reports_audit.queries import (
    resolve_admin_dashboard_stats_helper,
    resolve_usage_health_helper,
)

# A real, existing client database in this dev environment. If your local
# .env points at a different set of client DBs, update this name.
_DEV_CLIENT_DB = "service_plus_demo"


@pytest.mark.asyncio
async def test_admin_dashboard_stats_returns_expected_shape():
    stats = await resolve_admin_dashboard_stats_helper(_DEV_CLIENT_DB)

    assert isinstance(stats, dict)
    for key in (
        "totalAdminUsers",
        "activeAdminUsers",
        "totalBusinessUsers",
        "activeBusinessUsers",
        "totalBu",
        "activeBu",
    ):
        assert key in stats
        assert isinstance(stats[key], int)


@pytest.mark.asyncio
async def test_usage_health_reports_healthy_services():
    health = await resolve_usage_health_helper()

    assert isinstance(health, dict)
    assert "services" in health
    assert isinstance(health["services"], list)
    assert len(health["services"]) > 0
    for service in health["services"]:
        assert "name" in service
        assert "status" in service
