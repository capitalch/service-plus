"""
Application SQL queries for business logic.

All non-authentication SQL is consolidated here.
Placeholder implementation — expand as service management features are built.
"""
import psycopg
from psycopg.rows import dict_row

from app.logger import logger
from app.exceptions import AppMessages, DatabaseException


class AppQueries:
    """Centralized class for all application business-logic SQL queries."""

    # ------------------------------------------------------------------
    # Service Orders (examples — implement when schema is ready)
    # ------------------------------------------------------------------

    @staticmethod
    async def get_service_orders(conn: psycopg.AsyncConnection) -> list[dict]:
        """Retrieve all service orders."""
        raise NotImplementedError("get_service_orders not yet implemented")

    @staticmethod
    async def get_service_order_by_id(
        conn: psycopg.AsyncConnection, order_id: int
    ) -> dict | None:
        """Retrieve a single service order by ID."""
        raise NotImplementedError("get_service_order_by_id not yet implemented")

    @staticmethod
    async def create_service_order(
        conn: psycopg.AsyncConnection, order_data: dict
    ) -> dict:
        """Create a new service order."""
        raise NotImplementedError("create_service_order not yet implemented")

    @staticmethod
    async def update_service_order(
        conn: psycopg.AsyncConnection, order_id: int, order_data: dict
    ) -> dict | None:
        """Update an existing service order."""
        raise NotImplementedError("update_service_order not yet implemented")
