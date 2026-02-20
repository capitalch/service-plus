"""
Authentication router.

Endpoints:
    POST /api/auth/clients   - Return all clients (public)
    POST /api/auth/login     - Authenticate user and return JWT
"""
from fastapi import APIRouter
from app.logger import logger
from app.schemas.auth_schema import ClientRequest, ClientResponse, LoginRequest, LoginResponse
from app.routers.auth_router_helper import get_clients_helper, login_helper

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
