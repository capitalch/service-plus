"""
Base router for non-GraphQL endpoints.
"""
from fastapi import APIRouter
import smtplib
from app.config import settings
from app.core.email import send_email
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


@router.post("/api/utils/test-email")
async def test_email():
    """Send a fixed test email to verify SMTP connectivity."""
    try:
        await send_email(
            to=AppMessages.EMAIL_TEST_RECIPIENT,
            subject=AppMessages.EMAIL_TEST_SUBJECT,
            body=AppMessages.EMAIL_TEST_BODY,
        )
        logger.info("Test email sent to %s", AppMessages.EMAIL_TEST_RECIPIENT)
        return {"status": "ok", "message": AppMessages.EMAIL_TEST_SENT}
    except (smtplib.SMTPException, OSError, RuntimeError) as exc:
        logger.error("Test email failed: %s", exc)
        return {"status": "error", "message": AppMessages.EMAIL_TEST_FAILED, "detail": str(exc)}
