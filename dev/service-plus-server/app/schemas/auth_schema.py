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