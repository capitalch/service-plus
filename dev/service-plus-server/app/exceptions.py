"""
Custom exceptions and error messages for the application.
"""
from typing import Any, Dict, Optional
from graphql import GraphQLError


class AppMessages:
    """Centralized class for all application messages."""

    # General messages
    SERVER_STARTED = "Service Plus Server started successfully"
    SERVER_STOPPED = "Service Plus Server stopped"
    HEALTH_CHECK_OK = "Server is healthy and running"
    ROOT_ENDPOINT_ACCESSED = "Root endpoint accessed"
    HEALTH_ENDPOINT_ACCESSED = "Health check endpoint accessed"

    # Error messages - General
    INTERNAL_SERVER_ERROR = "An internal server error occurred"
    UNEXPECTED_ERROR = "An unexpected error occurred."
    INVALID_INPUT = "Invalid input provided"
    OPERATION_FAILED = "Operation failed"

    # Error messages - Not Found
    CLIENT_NOT_FOUND = "Client not found"
    CUSTOMER_NOT_FOUND = "Customer not found"
    DEVICE_NOT_FOUND = "Device not found"
    RESOURCE_NOT_FOUND = "Requested resource not found"
    SERVICE_ORDER_NOT_FOUND = "Service order not found"

    # Success messages - Application
    CLIENT_CREATED = "Client created successfully"
    CLIENTS_RETRIEVED = "Clients retrieved successfully"

    # Error messages - Validation
    CLIENT_CODE_EXISTS = "A client with this code already exists"
    CLIENT_DB_NAME_EXISTS = "A client with this database name already exists"
    CLIENT_NAME_EXISTS = "A client with this name already exists"
    VALIDATION_ERROR = "Validation error occurred"
    REQUIRED_FIELD_MISSING = "Required field is missing"
    INVALID_EMAIL_FORMAT = "Invalid email format"
    INVALID_PHONE_FORMAT = "Invalid phone number format"
    INVALID_DATE_FORMAT = "Invalid date format"

    # Error messages - Authorization / Authentication
    UNAUTHORIZED = "Unauthorized access"
    FORBIDDEN = "Access forbidden"
    INVALID_CREDENTIALS = "Invalid credentials provided"
    TOKEN_EXPIRED = "Authentication token has expired"
    TOKEN_INVALID = "Invalid authentication token"
    TOKEN_MISSING = "Authentication token is missing"
    USER_NOT_FOUND = "User not found"
    USER_ALREADY_EXISTS = "A user with this username or email already exists"

    # Success messages - Authentication
    LOGIN_SUCCESSFUL = "Login successful"
    LOGOUT_SUCCESSFUL = "Logout successful"
    REGISTRATION_SUCCESSFUL = "Registration successful"

    # Validation messages
    PASSWORD_TOO_SHORT = "Password must be at least 8 characters long"

    # Error messages - Database
    DATABASE_CONNECTION_FAILED = "Failed to connect to database"
    DATABASE_QUERY_FAILED = "Database query failed"
    DUPLICATE_ENTRY = "Duplicate entry exists"

    # Success messages
    RECORD_CREATED = "Record created successfully"
    RECORD_UPDATED = "Record updated successfully"
    RECORD_DELETED = "Record deleted successfully"


class ServicePlusException(Exception):
    """Base exception class for Service Plus application."""

    def __init__(
        self,
        message: str = AppMessages.INTERNAL_SERVER_ERROR,
        code: str = "INTERNAL_ERROR",
        extensions: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.extensions = extensions or {}
        super().__init__(self.message)


class NotFoundException(ServicePlusException):
    """Exception raised when a resource is not found."""

    def __init__(
        self,
        message: str = AppMessages.RESOURCE_NOT_FOUND,
        extensions: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message=message, code="NOT_FOUND", extensions=extensions)


class ValidationException(ServicePlusException):
    """Exception raised when validation fails."""

    def __init__(
        self,
        message: str = AppMessages.VALIDATION_ERROR,
        extensions: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message=message, code="VALIDATION_ERROR", extensions=extensions)


class AuthorizationException(ServicePlusException):
    """Exception raised when authorization fails."""

    def __init__(
        self,
        message: str = AppMessages.UNAUTHORIZED,
        extensions: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message=message, code="UNAUTHORIZED", extensions=extensions)


class DatabaseException(ServicePlusException):
    """Exception raised when database operations fail."""

    def __init__(
        self,
        message: str = AppMessages.DATABASE_QUERY_FAILED,
        extensions: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message=message, code="DATABASE_ERROR", extensions=extensions)


class GraphQLException(ServicePlusException):
    """Exception raised for GraphQL-specific errors."""

    def __init__(
        self,
        message: str = AppMessages.OPERATION_FAILED,
        extensions: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message=message, code="GRAPHQL_ERROR", extensions=extensions)


def format_graphql_error(error: GraphQLError, debug: bool = False) -> Dict[str, Any]:
    """
    Format GraphQL errors for consistent error responses.

    Args:
        error: GraphQL error object
        debug: Whether to include debug information

    Returns:
        Formatted error dictionary
    """
    formatted_error: Dict[str, Any] = {
        "message": str(error.message),
        "locations": error.locations,
        "path": error.path,
    }

    # Add custom extensions if present
    if hasattr(error, "extensions") and error.extensions:
        formatted_error["extensions"] = error.extensions
    elif hasattr(error.original_error, "extensions"):
        formatted_error["extensions"] = error.original_error.extensions

    # Add error code from custom exceptions
    if isinstance(error.original_error, ServicePlusException):
        if "extensions" not in formatted_error:
            formatted_error["extensions"] = {}
        formatted_error["extensions"]["code"] = error.original_error.code

    # Include stack trace in debug mode
    if debug and error.original_error:
        import traceback
        if "extensions" not in formatted_error:
            formatted_error["extensions"] = {}
        formatted_error["extensions"]["exception"] = {
            "stacktrace": traceback.format_exception(
                type(error.original_error),
                error.original_error,
                error.original_error.__traceback__
            )
        }

    return formatted_error
