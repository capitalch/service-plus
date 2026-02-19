"""
Base router for non-GraphQL endpoints.
"""
from fastapi import APIRouter
from app.config import settings
from app.exceptions import AppMessages
from app.logger import logger

router = APIRouter()


@router.get("/")
async def root():
    """Root endpoint."""
    logger.debug(AppMessages.ROOT_ENDPOINT_ACCESSED)
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "graphql": settings.graphql_path,
        "status": "running"
    }


@router.get("/health")
async def health():
    """Health check endpoint."""
    logger.debug(AppMessages.HEALTH_ENDPOINT_ACCESSED)
    return {
        "status": "OK",
        "message": AppMessages.HEALTH_CHECK_OK
    }
