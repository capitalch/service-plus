"""
Pydantic schemas for authentication endpoints.
"""
from pydantic import BaseModel, ConfigDict, Field


class ClientRequest(BaseModel):
    """Request body for POST /api/auth/clients."""

    criteria: str = Field(
        default="", description="Filter clients by name prefix")


class ClientResponse(BaseModel):
    """Client record returned by POST /api/auth/clients."""

    id: int
    is_active: bool
    name: str


class LoginRequest(BaseModel):
    """Request body for POST /api/auth/login."""

    client_id: str = Field(
        alias="clientId", description="ID of the client application")
    identity: str = Field(alias="emailOrUsername",
                          description="email or username")
    password: str


class LoginResponse(BaseModel):
    """Response for POST /api/auth/login."""

    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(
        alias="accessToken", description="JWT access token")
    access_rights: list[str] = Field(
        alias="accessRights", description="List of access rights/permissions")
    
    email: str = Field(description="User's email address")
    full_name: str = Field(alias="fullName", description="User's full name")
    id: int | None = Field(default=None, description="User's unique identifier")

    mobile: str = Field(description="User's mobile number")
    role_name: str = Field(alias="roleName", description="User's role name")
    username: str = Field(description="User's username")
    user_type: str = Field(
        alias="userType", description="User type (e.g., 'S' for Super Admin)")
