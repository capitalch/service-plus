"""
Pydantic schemas for authentication endpoints.
"""
from pydantic import BaseModel, ConfigDict, Field


class SetPasswordRequest(BaseModel):
    """Request body for POST /api/auth/set-password."""

    new_password: str
    token: str


class SetPasswordResponse(BaseModel):
    """Response for POST /api/auth/set-password."""

    message: str
    success: bool


class ValidateResetTokenRequest(BaseModel):
    """Request body for POST /api/auth/validate-reset-token."""

    token: str


class ValidateResetTokenResponse(BaseModel):
    """Response for POST /api/auth/validate-reset-token."""

    full_name: str
    username: str
    valid: bool


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
        default="", alias="clientId", description="ID of the client application")
    identity: str = Field(alias="emailOrUsername",
                          description="email or username")
    password: str


class LoginResponse(BaseModel):
    """Response for POST /api/auth/login."""

    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(
        alias="accessToken", description="JWT access token")
    refresh_token: str = Field(
        alias="refreshToken", description="JWT refresh token")
    access_rights: list[str] = Field(
        alias="accessRights", description="List of access rights/permissions")
    
    email: str = Field(description="User's email address")
    full_name: str = Field(alias="fullName", description="User's full name")
    id: int | None = Field(default=None, description="User's unique identifier")

    available_bus: list[dict] = Field(default_factory=list, alias="availableBus", description="BUs available to the user")
    client_code: str | None = Field(default=None, alias="clientCode", description="Client code for file hierarchy")
    db_name: str | None = Field(default=None, alias="dbName", description="Tenant database name")
    last_used_branch_id: int | None = Field(default=None, alias="lastUsedBranchId", description="Last used branch ID")
    last_used_bu_id: int | None = Field(default=None, alias="lastUsedBuId", description="Last used BU ID")
    mobile: str = Field(description="User's mobile number")
    role_name: str = Field(alias="roleName", description="User's role name")
    username: str = Field(description="User's username")
    user_type: str = Field(
        alias="userType", description="User type (e.g., 'S' for Super Admin)")


class RefreshTokenRequest(BaseModel):
    """Request body for POST /api/auth/refresh."""

    refresh_token: str = Field(alias="refreshToken", description="JWT refresh token")


class RefreshTokenResponse(BaseModel):
    """Response for POST /api/auth/refresh."""

    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(
        alias="accessToken", description="New JWT access token")
    refresh_token: str = Field(
        alias="refreshToken", description="New JWT refresh token")
