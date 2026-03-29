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
    INVALID_JSON_OBJECT = "value must be a JSON object"
    INVALID_JSON_VALUE = "value is not valid JSON"
    OPERATION_FAILED = "Operation failed"

    # Error messages - Not Found
    CLIENT_NOT_FOUND = "Client not found"
    NOT_FOUND = "Record not found."
    CUSTOMER_NOT_FOUND = "Customer not found"
    DEVICE_NOT_FOUND = "Device not found"
    RESOURCE_NOT_FOUND = "Requested resource not found"
    SERVICE_ORDER_NOT_FOUND = "Service order not found"

    # Success messages - Application
    CLIENT_CREATED = "Client created successfully"
    CLIENTS_RETRIEVED = "Clients retrieved successfully"

    # Error messages - Validation
    BU_CODE_EXISTS          = "A business unit with this code already exists"
    BU_NAME_EXISTS          = "A business unit with this name already exists"
    BU_SCHEMA_CREATE_FAILED = "Failed to create business unit schema"
    BU_SEED_FEED_FAILED     = "Failed to seed business unit data"
    BU_SCHEMA_DROP_FAILED   = "Failed to drop the business unit schema"
    BU_SCHEMA_NAME_MISMATCH = "Schema name does not match. Please type the exact name."
    CLIENT_CODE_EXISTS = "A client with this code already exists"
    CLIENT_MUST_BE_DISABLED = "Client must be disabled before deletion."
    CLIENT_DB_NAME_EXISTS = "A client with this database name already exists"
    CLIENT_NAME_EXISTS = "A client with this name already exists"
    VALIDATION_ERROR = "Validation error occurred"
    REQUIRED_FIELD_MISSING = "Required field is missing"
    INVALID_EMAIL_FORMAT = "Invalid email format"
    INVALID_PHONE_FORMAT = "Invalid phone number format"
    INVALID_DATE_FORMAT = "Invalid date format"

    # Error messages - Authorization / Authentication
    ADMIN_EMAIL_EXISTS = "This email is already registered for this client"
    ADMIN_USER_NOT_FOUND = "Admin user not found"
    BUSINESS_USER_EMAIL_EXISTS = "This email is already registered as a business user"
    BUSINESS_USER_USERNAME_EXISTS = "This username is already taken by another business user"
    ADMIN_USER_UPDATE_FAILED = "Failed to update admin user"
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

    # Password reset messages
    PASSWORD_RESET_SUCCESS = "Password has been reset successfully"
    RESET_TOKEN_INVALID = "Password reset link is invalid or has expired"
    RESET_TOKEN_WRONG_TYPE = "Token is not a valid reset token"

    # Validation messages
    PASSWORD_TOO_SHORT = "Password must be at least 8 characters long"

    # Email messages
    EMAIL_CLIENT_WELCOME_BODY = (
        "Hello,\n\n"
        "Welcome to Service Plus! Your client account has been created.\n\n"
        "  Client Name : {name}\n"
        "  Client Code : {code}\n\n"
        "Your Super Admin will share further setup and login details with you shortly.\n\n"
        "-- Service Plus"
    )
    EMAIL_CLIENT_WELCOME_SUBJECT = "Welcome to Service Plus"

    EMAIL_NEW_ADMIN_LINK_BODY = (
        "Hello {full_name},\n\n"
        "Your admin account has been created.\n\n"
        "  Login ID : {username}\n\n"
        "Click the link below to set your password (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "If you did not expect this email, please ignore it.\n\n"
        "-- Service Plus"
    )
    EMAIL_NEW_ADMIN_LINK_SUBJECT = "Your Admin Account — Set Your Password"

    EMAIL_RESET_LINK_BODY = (
        "Hello {full_name},\n\n"
        "A Super Admin has requested a password reset for your admin account.\n\n"
        "Click the link below to set your new password (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "If you did not request this, please contact your Super Admin.\n\n"
        "-- Service Plus"
    )
    EMAIL_RESET_LINK_SUBJECT = "Reset Your Admin Password"

    EMAIL_ADMIN_CREDENTIALS_BODY = (
        "Hello {full_name},\n\n"
        "Your admin account has been created.\n\n"
        "  Login ID   : {username}\n"
        "  Access key : {password}\n\n"
        "Use the above details to sign in, then update your access key immediately.\n"
    )
    EMAIL_ADMIN_CREDENTIALS_SUBJECT = "Admin Account Created"
    EMAIL_RESET_CREDENTIALS_BODY = (
        "Hello {full_name},\n\n"
        "Your admin account access key has been reset by a Super Admin.\n\n"
        "  Login ID : {username}\n\n"
        "Please obtain your new access key from the Super Admin and sign in immediately.\n"
    )
    EMAIL_RESET_CREDENTIALS_SUBJECT = "Admin Account Access Reset"

    EMAIL_NEW_BU_USER_LINK_BODY = (
        "Hello {full_name},\n\n"
        "Your account has been created.\n\n"
        "  Login ID : {username}\n\n"
        "Click the link below to set your password (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "If you did not expect this email, please ignore it.\n\n"
        "-- Service Plus"
    )
    EMAIL_NEW_BU_USER_LINK_SUBJECT = "Your Account — Set Your Password"

    EMAIL_BU_RESET_LINK_BODY = (
        "Hello {full_name},\n\n"
        "A password reset has been requested for your account.\n\n"
        "Click the link below to set your new password (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "If you did not request this, please contact your administrator.\n\n"
        "-- Service Plus"
    )
    EMAIL_BU_RESET_LINK_SUBJECT = "Reset Your Password"

    # Error messages - Database
    DATABASE_CONNECTION_FAILED = "Failed to connect to database"
    DATABASE_QUERY_FAILED = "Database query failed"
    DB_DROP_FAILED = "Failed to drop the database"
    DB_DROP_FORBIDDEN = "Cannot drop a database that is still linked to a client"
    DB_NOT_ORPHAN = "Database is not an orphan — it is still linked to a client"
    DUPLICATE_ENTRY = "Duplicate entry exists"

    # Test email
    EMAIL_TEST_SUBJECT = "Service Plus - Connectivity Test"
    EMAIL_TEST_BODY = (
        "Hello,\n\n"
        "This is an automated connectivity test from the Service Plus system.\n\n"
        "If you received this message, the mail server is configured correctly\n"
        "and outbound delivery is working as expected.\n\n"
        "No action is required.\n\n"
        "-- Service Plus"
    )
    EMAIL_TEST_RECIPIENT = "capitalch@gmail.com"
    EMAIL_TEST_SENT = "Test email dispatched successfully"
    EMAIL_TEST_FAILED = "Failed to dispatch test email"

    # Audit log messages
    AUDIT_LOG_RETRIEVED   = "Audit log entries retrieved."
    AUDIT_STATS_RETRIEVED = "Audit log statistics retrieved."

    # System settings messages
    SETTINGS_RETRIEVED = "System settings retrieved."

    # Usage & health messages
    USAGE_HEALTH_RETRIEVED = "Usage and health data retrieved."

    # Import messages
    IMPORT_COMPLETE          = "Import completed successfully"
    IMPORT_FILE_REQUIRED     = "A file must be provided for import"
    IMPORT_INVALID_FILE_TYPE = "Invalid file type. Allowed: .csv, .xlsx, .xls"
    IMPORT_MISSING_MANDATORY = "Mandatory columns (part_code, part_name) must be mapped"
    IMPORT_PARSE_ERROR       = "Failed to parse the uploaded file"
    IMPORT_UPLOAD_NOT_FOUND  = "Upload session not found or expired"

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
