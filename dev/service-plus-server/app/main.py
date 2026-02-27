"""
FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.logger import logger
from app.exceptions import AppMessages
from app.graphql.schema import create_graphql_app
from app.routers.base_router import router as base_router
from app.routers.auth_router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan event handler."""
    logger.info("=" * 80)
    logger.info(f"{settings.app_name} v{settings.app_version}")
    logger.info("=" * 80)
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"GraphQL endpoint: http://{settings.host}:{settings.port}{settings.graphql_path}")
    logger.info(f"GraphQL Playground: {'Enabled' if settings.graphql_playground else 'Disabled'}")
    logger.info("=" * 80)
    logger.info(AppMessages.SERVER_STARTED)
    yield # Shutdown
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
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(base_router)
app.include_router(auth_router)

# Mount GraphQL application
graphql_app = create_graphql_app()
app.mount(settings.graphql_path, graphql_app)


# Main entry point for running with uvicorn
if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting {settings.app_name}...")

    uvicorn.run(
        "app.main:app",
        # host=settings.host,
        # port=settings.port,
        reload=settings.debug,
        log_level="info" if settings.debug else "warning"
    )
