"""
FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.audit_log import audit_logger
from app.exceptions import AppMessages
from app.graphql.schema import create_graphql_app
from app.logger import logger, configure_for_uvicorn
from app.routers.auth_router import router as auth_router
from app.routers.base_router import router as base_router
from app.routers.image_router import router as image_router, uploads_router as uploads_router
from app.scheduler import start_scheduler, stop_scheduler



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan event handler."""
    # Align logging with Uvicorn after it has configured the root logger.
    configure_for_uvicorn(suppress_access_log=True)

    logger.info("=" * 80)
    logger.info("%s v%s", settings.app_name, settings.app_version)
    logger.info("=" * 80)
    logger.info("Debug mode: %s", settings.debug)
    logger.info(
        "GraphQL endpoint: http://%s:%s%s",
        settings.host,
        settings.port,
        settings.graphql_path,
    )
    logger.info(
        "GraphQL Playground: %s",
        "Enabled" if settings.graphql_playground else "Disabled",
    )
    logger.info("=" * 80)
    # Ensure audit log directory exists and purge old files
    Path(settings.audit_log_dir).mkdir(parents=True, exist_ok=True)
    purged = await audit_logger.purge_old_files()
    if purged:
        logger.info("Purged %d old audit log file(s)", purged)
    logger.info(AppMessages.SERVER_STARTED)
    start_scheduler()
    yield  # Shutdown
    stop_scheduler()
    logger.info(AppMessages.SERVER_STOPPED)


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(base_router)
app.include_router(image_router)
app.include_router(uploads_router)

# Serve uploaded files via file server proxy (see uploads_router in image_router.py)

# Mount GraphQL application
graphql_app = create_graphql_app()
app.mount(settings.graphql_path, graphql_app)


# Main entry point for running with uvicorn
if __name__ == "__main__":
    import uvicorn

    logger.info("Starting %s...", settings.app_name)

    uvicorn.run(
        "app.main:app",
        # host=settings.host,
        # port=settings.port,
        reload=settings.debug,
        log_level="info" if settings.debug else "warning"
    )
