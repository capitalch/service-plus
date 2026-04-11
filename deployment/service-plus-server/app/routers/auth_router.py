"""
Authentication router.

Endpoints:
    POST /api/auth/clients   - Return all clients (public)
    POST /api/auth/login     - Authenticate user and return JWT
"""
from fastapi import APIRouter
from app.logger import logger
from app.schemas.auth_schema import (
    ClientRequest,
    ClientResponse,
    LoginRequest,
    LoginResponse,
    SetPasswordRequest,
    SetPasswordResponse,
    ValidateResetTokenRequest,
    ValidateResetTokenResponse,
)
from app.routers.auth_router_helper import (
    get_clients_helper,
    login_helper,
    set_password_helper,
    validate_reset_token_helper,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/clients", response_model=list[ClientResponse])
async def get_clients(body: ClientRequest) -> list[ClientResponse]:
    """Return all clients, optionally filtered by name prefix."""
    logger.info(f"Clients endpoint called with criteria='{body.criteria}'")
    return await get_clients_helper(body.criteria)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """Authenticate a user and return a JWT access token."""
    logger.info(f"Login endpoint called for identity='{body.identity}', client_id='{body.client_id}'")
    return await login_helper(body)


@router.post("/set-password", response_model=SetPasswordResponse)
async def set_password(body: SetPasswordRequest) -> SetPasswordResponse:
    """Set a new password using a valid reset token."""
    logger.info("Set-password endpoint called")
    return await set_password_helper(body)


@router.post("/validate-reset-token", response_model=ValidateResetTokenResponse)
async def validate_reset_token(body: ValidateResetTokenRequest) -> ValidateResetTokenResponse:
    """Validate a password reset token and return user info."""
    logger.info("Validate-reset-token endpoint called")
    return await validate_reset_token_helper(body.token)
