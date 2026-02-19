"""
Pydantic schemas for authentication endpoints.
"""
import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.exceptions import AppMessages


class ClientRequest(BaseModel):
    """Request body for POST /api/auth/clients."""

    criteria: str = Field(default="", description="Filter clients by name prefix")


class ClientResponse(BaseModel):
    """Client record returned by POST /api/auth/clients."""

    id: int
    is_active: bool
    name: str


# class LoginRequest(BaseModel):
#     """Payload for POST /api/auth/login."""

#     username: str = Field(..., min_length=3, description="Username")
#     password: str = Field(..., min_length=1, description="Password")


# class RegisterRequest(BaseModel):
#     """Payload for POST /api/auth/register."""

#     username: str = Field(..., min_length=3, max_length=50, description="Username")
#     email: str = Field(..., description="Email address")
#     password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
#     full_name: str = Field(..., min_length=1, max_length=100, description="Full name")

#     @field_validator("email")
#     @classmethod
#     def validate_email(cls, v: str) -> str:
#         pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
#         if not re.match(pattern, v):
#             raise ValueError(AppMessages.INVALID_EMAIL_FORMAT)
#         return v.lower()

#     @field_validator("password")
#     @classmethod
#     def validate_password(cls, v: str) -> str:
#         if len(v) < 8:
#             raise ValueError(AppMessages.PASSWORD_TOO_SHORT)
#         return v


# class RefreshRequest(BaseModel):
#     """Payload for POST /api/auth/refresh."""

#     refresh_token: str = Field(..., description="Valid refresh token")


# class TokenResponse(BaseModel):
#     """Returned on successful login or token refresh."""

#     access_token: str
#     refresh_token: str
#     token_type: str = "bearer"


# class UserResponse(BaseModel):
#     """User data returned by /me and /register (password excluded)."""

#     id: int
#     username: str
#     email: str
#     full_name: str
#     is_active: bool
#     is_superuser: bool
#     created_at: Optional[datetime] = None
#     updated_at: Optional[datetime] = None
