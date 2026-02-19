"""
Authentication router.

Endpoints:
    POST /api/auth/clients   - Return all clients (public)
"""
from fastapi import APIRouter
from app.logger import logger
from app.schemas.auth_schema import ClientRequest, ClientResponse
from app.routers.auth_router_helper import get_clients_helper

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/clients", response_model=list[ClientResponse])
async def get_clients(body: ClientRequest) -> list[ClientResponse]:
    """Return all clients, optionally filtered by name prefix."""
    logger.info(f"Clients endpoint called with criteria='{body.criteria}'")
    return await get_clients_helper(body.criteria)