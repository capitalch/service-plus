"""
Connection pool manager for GraphQL query resolvers (read-only, SELECT paths).

Mutation resolvers use fresh per-request connections via psycopg_driver.py
and are not affected by this module.
"""

import asyncio
import os

from psycopg_pool import AsyncConnectionPool

from app.config import settings
from app.logger import logger

_APP_ENV: str = os.environ.get("APP_ENV", "development")

# _POOL_MIN_SIZE: int = 2
_POOL_MAX_SIZE: int = 10
_POOL_MAX_IDLE: float = 300.0      # seconds before an idle connection is closed
_POOL_MAX_LIFETIME: float = 600.0  # seconds max before a connection is recycled
_POOL_RECONNECT_TIMEOUT: float = 30.0


async def _reset_conn(conn) -> None:
    """Reset session state before a connection is returned to the pool."""
    await conn.execute("RESET search_path")


def _build_conninfo(host: str, port: int, user: str, password: str, dbname: str) -> str:
    return (
        f"host={host} port={port} user={user} password={password} dbname={dbname} "
        f"connect_timeout=50 keepalives=1 keepalives_idle=30 "
        f"keepalives_interval=5 keepalives_count=3"
    )


class PoolManager:
    """Manages AsyncConnectionPool instances for query-time DB access."""

    def __init__(self) -> None:
        self._client_pool: AsyncConnectionPool | None = None
        self._service_pools: dict[str, AsyncConnectionPool] = {}
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Open the client-DB pool. Call once during application startup."""
        host = settings.client_db_ip_address if _APP_ENV == "production" else settings.client_db_host
        port = settings.client_db_internal_port if _APP_ENV == "production" else settings.client_db_port
        conninfo = _build_conninfo(
            host, port,
            settings.client_db_user,
            settings.client_db_password,
            settings.client_db_name,
        )
        self._client_pool = AsyncConnectionPool(
            conninfo=conninfo,
            min_size= 0,
            max_size=_POOL_MAX_SIZE,
            max_idle=_POOL_MAX_IDLE,
            max_lifetime=_POOL_MAX_LIFETIME,
            reconnect_timeout=_POOL_RECONNECT_TIMEOUT,
            kwargs={"autocommit": True},
            reset=_reset_conn,
            open=False,
        )
        await self._client_pool.open(wait=True)
        logger.info(
            "Client DB connection pool opened (min=%d, max=%d)",
            0,
            _POOL_MAX_SIZE,
        )

    async def get_service_pool(self, db_name: str) -> AsyncConnectionPool:
        """Return the pool for a service/tenant DB, creating it lazily on first use."""
        if db_name not in self._service_pools:
            async with self._lock:
                if db_name not in self._service_pools:
                    host = settings.service_db_ip_address if _APP_ENV == "production" else settings.service_db_host
                    port = settings.service_db_internal_port if _APP_ENV == "production" else settings.service_db_port
                    conninfo = _build_conninfo(
                        host, port,
                        settings.service_db_user,
                        settings.service_db_password,
                        db_name,
                    )
                    pool = AsyncConnectionPool(
                        conninfo=conninfo,
                        min_size= 0,
                        max_size=_POOL_MAX_SIZE,
                        max_idle=_POOL_MAX_IDLE,
                        max_lifetime=_POOL_MAX_LIFETIME,
                        reconnect_timeout=_POOL_RECONNECT_TIMEOUT,
                        kwargs={"autocommit": True},
                        reset=_reset_conn,
                        open=False,
                    )
                    await pool.open(wait=True)
                    self._service_pools[db_name] = pool
                    logger.info("Service DB pool opened for '%s'", db_name)
        return self._service_pools[db_name]

    @property
    def client_pool(self) -> AsyncConnectionPool:
        if self._client_pool is None:
            raise RuntimeError(
                "Pool not initialized — call await pool_manager.initialize() during app startup"
            )
        return self._client_pool

    async def close_all(self) -> None:
        """Close all pools gracefully. Call during application shutdown."""
        pools: list[AsyncConnectionPool] = []
        if self._client_pool:
            pools.append(self._client_pool)
        pools.extend(self._service_pools.values())
        for pool in pools:
            await pool.close()
        logger.info("All DB connection pools closed (%d pool(s))", len(pools))


pool_manager = PoolManager()
