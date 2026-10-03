"""
Custom exceptions and error messages for the application.
"""
import traceback
from typing import Any, Dict, Optional
from graphql import GraphQLError


class AppMessages:
    """Centralized class for all application messages."""

    # General messages
    SERVER_STARTED = "Service+ Server started successfully"
    SERVER_STOPPED = "Service+ Server stopped"
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
    BU_NAME_FORMAT = (
        "Name must be 3 to 100 characters, start with a letter or digit, and use only letters, "
        "digits, spaces and . & ' ( ) / , -"
    )
    BU_SCHEMA_CREATE_FAILED = "Failed to create business unit schema"
    BU_SEED_FEED_FAILED     = "Failed to seed business unit data"
    SECURITY_SEED_FEED_FAILED = "Failed to seed security data"
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

    # Error messages - Branches and default divisions (plans/plan2.md)
    BRANCH_CREATE_FAILED = "Failed to create the branch"
    BRANCH_INSERT_VIA_ADD_BRANCH = "Branches are added through Add Branch only."
    BRANCH_LIMIT_REACHED = "Your plan includes one branch. Upgrade to Standard for more branches."
    DEFAULT_DIVISION_LOCKED = "The default division of a branch cannot be deleted or deactivated."

    # Error messages - Sign-up and billing (plans/plan.md)
    DEFAULT_DB_NOT_CONFIGURED = (
        "Sign-ups are not available right now: the default customer database is not configured."
    )
    ENQUIRY_BUSY = "This request is already being processed. Try again in a few minutes."
    ENQUIRY_NOT_FOUND = "Request not found."
    ENQUIRY_NOT_PENDING = "Only a pending request can be changed."
    ENQUIRY_NOTE_REQUIRED = "Enter a note."
    ENQUIRY_PAYMENT_AMOUNT_LOW = "The amount is less than the setup fee."
    ENQUIRY_PAYMENT_DATE_FUTURE = "The payment date cannot be in the future."
    ENQUIRY_PAYMENT_NOT_ALLOWED = "A setup payment can be recorded only for a pending Basic or Standard request."
    ENQUIRY_REASON_REQUIRED = "Enter a reason."
    ENQUIRY_REJECT_NOT_ALLOWED = (
        "This request can no longer be rejected: it is not pending, or its business unit already exists."
    )
    ENQUIRY_CONTACT_NOT_ALLOWED = "Only a new enquiry can be marked as contacted."
    ENQUIRY_FEE_NOT_ALLOWED = "The setup fee can be changed only while the payment is outstanding."
    EXTRA_BU_CONFIRM_REQUIRED = (
        "This business unit is outside the {included} included in the plan and adds ₹{fee} to the "
        "monthly fee. Confirm to continue."
    )
    INVALID_CLIENT_CODE = "Client code must be 4–20 letters or digits."
    INVALID_CLIENT_NAME = "Client name must be 6–100 letters, digits, spaces or - _ . ,"
    INVALID_DB_NAME = "Database name must look like service_plus_<lower-case letters, digits or _>."
    INVALID_USERNAME = "Username must be at least 5 letters or digits."
    BILLING_EMAIL_RECEIPT_SUBJECT = "Service+ payment received — {bu_name}"
    BILLING_EMAIL_RECEIPT_TEXT = (
        "Thank you. Payment of ₹{amount} received for {period} for {bu_name}.\n\n"
        "Paid through {paid_through}."
    )
    BILLING_EMAIL_REMINDER_SUBJECT = "Service+ payment reminder — {bu_name}"
    BILLING_EMAIL_REMINDER_DUE_SOON = "Your Service+ payment for {bu_name} is due on {due_date}. Pay before then to keep adding and changing data."
    BILLING_EMAIL_REMINDER_DUE_TODAY = "Today is the last paid day of Service+ for {bu_name}. From tomorrow it becomes view-only until the next payment."
    BILLING_EMAIL_REMINDER_LAPSED = "Service+ for {bu_name} is now view-only: the monthly payment has not been received. You can still view and print your data. Pay to continue adding and changing data."
    BILLING_EMAIL_REMINDER_FIRST = "Welcome to Service+. {bu_name} is view-only until the first monthly payment is recorded. Pay to start adding data."
    SIGNUP_EMAIL_EXTRA_BU_SUBJECT = "Service+ Enterprise: extra business unit {bu_code} for {client_name}"
    SIGNUP_EMAIL_EXTRA_BU_TEXT = (
        "Client {client_name} ({db_name}) added business unit {bu_code}, number {bu_number} — beyond the "
        "{included} included. Its monthly fee is ₹{fee}; the client's monthly fee is now ₹{total}.{rebase}"
    )
    INVALID_BU_CODE = "Code must be 3–30 lower-case letters, digits or underscores, and not a reserved name."
    BU_NOT_BILLED = "This business unit is not on a paid plan."
    DOWNGRADE_BLOCKED_BRANCHES = (
        "Lite and Basic include the head office only. Delete the other branches and their data first."
    )
    PAID_THROUGH_INVALID = "The paid-through date must be today or later, and at most 5 years ahead."
    PAYMENT_AMOUNT_BELOW_DUE = "The amount is less than the monthly fee × months."
    PAYMENT_EXTRA_NOTE_REQUIRED = "Add a note explaining an amount above the monthly fee × months."
    PAYMENT_MONTHS_INVALID = "Pay for 1 to 60 months."
    PLAN_CHANGE_INVALID = "Choose Lite, Basic or Standard, different from the current plan."
    PREPAID_LIMIT_EXCEEDED = "This payment would take the paid period more than 5 years ahead."
    PART_ORDER_UNAVAILABLE = "This shop is not taking online orders right now. Please call the shop."
    PAYMENT_NOT_RECEIVED = "The setup payment has not been received yet."
    SUBSCRIPTION_READ_ONLY = (
        "This business unit is view-only because its monthly payment is due. "
        "Pay to continue adding and changing data."
    )
    SIGNUP_BRANCHES_ONE = "The Lite and Basic plans include one branch only."
    SIGNUP_DUPLICATE = (
        "A request with this mobile number or email already exists. "
        "Check its progress on the sign-up status page."
    )
    SIGNUP_NOT_FOUND = "No request found for this mobile number and email."
    SIGNUP_WRONG_ENDPOINT = "This plan is signed up through the sign-up form, not the enquiry form."

    # Sign-up emails (plans/plan.md Step 7). Plain-text templates; the HTML version is
    # built from the same text by app.services.signup_emails. {placeholders} are filled
    # with str.format.
    SIGNUP_EMAIL_LITE_SUBJECT = "Your Service+ Lite request {reference}"
    SIGNUP_EMAIL_LITE_TEXT = (
        "Dear {name},\n\n"
        "Thank you for signing up for Service+ Lite for {business_name}.\n\n"
        "Your request {reference} is pending approval. Once it is approved you will get an email "
        "with your login details.\n\n"
        "Check the progress of your request at any time: {status_url}"
    )
    SIGNUP_EMAIL_PAID_SUBJECT = "Your Service+ {plan_name} request {reference}"
    SIGNUP_EMAIL_PAID_TEXT = (
        "Dear {name},\n\n"
        "Thank you for choosing Service+ {plan_name} for {business_name}. Our sales team will "
        "contact you shortly.\n\n"
        "Your reference is {reference}. The one-time setup cost is ₹{setup_fee}. Your account is "
        "created once it is received. The monthly fee of ₹{monthly_fee} is paid separately, "
        "each month in advance."
    )
    SIGNUP_EMAIL_ENTERPRISE_SUBJECT = "Your Service+ Enterprise enquiry {reference}"
    SIGNUP_EMAIL_ENTERPRISE_TEXT = (
        "Dear {name},\n\n"
        "Thank you for your interest in Service+ Enterprise for {business_name}. Our sales team "
        "will contact you shortly.\n\n"
        "Your reference is {reference}."
    )
    SIGNUP_EMAIL_REJECTED_SUBJECT = "Your Service+ request {reference}"
    SIGNUP_EMAIL_REJECTED_TEXT = (
        "Dear {name},\n\n"
        "We are sorry, your Service+ request {reference} for {business_name} was not approved.\n\n"
        "Reason: {reason}\n\n"
        "You can see this on the sign-up status page: {status_url}"
    )
    SIGNUP_EMAIL_APPROVER_SUBJECT = "New Service+ {plan_name} sign-up {reference} — {business_name}"
    SIGNUP_EMAIL_APPROVER_TEXT = (
        "A new {plan_name} sign-up is waiting.\n\n"
        "Reference: {reference}\n"
        "Business: {business_name}\n"
        "Applicant: {name}, {mobile}, {email}\n"
        "City: {city}\n"
        "Setup payment: {setup_status}\n\n"
        "Review it on the Enquiries page: {enquiries_url}"
    )

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
        "Welcome to Service+! Your client account has been created.\n\n"
        "  Client Name : {name}\n"
        "  Client Code : {code}\n\n"
        "Your Super Admin will share further setup and login details with you shortly.\n\n"
        "-- Service+"
    )
    EMAIL_CLIENT_WELCOME_SUBJECT = "Welcome to Service+"

    EMAIL_NEW_ADMIN_LINK_BODY = (
        "Hello {full_name},\n\n"
        "Welcome to Service+ — your service management software.\n\n"
        "An administrator account has been created for you in Service+. With it you can "
        "manage business units, users, and the overall configuration of the platform.\n\n"
        "Here are your sign-in details:\n\n"
        "  Login ID : {username}\n\n"
        "To get started, please set your password using the secure link below. "
        "For your security, this link is valid for 48 hours:\n\n"
        "  {reset_link}\n\n"
        "Once your password is set, you can sign in to Service+ with your Login ID "
        "and the password you chose.\n\n"
        "If you did not expect this email, please ignore it or contact your Super Admin.\n\n"
        "Welcome aboard,\n"
        "The Service+ Team"
    )
    EMAIL_NEW_ADMIN_LINK_SUBJECT = "Welcome to Service+ — Set Your Admin Password to Get Started"

    EMAIL_RESET_LINK_BODY = (
        "Hello {full_name},\n\n"
        "A Super Admin has requested a password reset for your admin account.\n\n"
        "Click the link below to set your new password (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "If you did not request this, please contact your Super Admin.\n\n"
        "-- Service+"
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
        "Welcome to Service+ — your service management software.\n\n"
        "An account has been created for you in Service+. You can use it to manage "
        "jobs, customers, inventory, and day-to-day service operations for your business.\n\n"
        "Here are your sign-in details:\n\n"
        "  Login ID : {username}\n\n"
        "To get started, please set your password using the secure link below. "
        "For your security, this link is valid for 48 hours:\n\n"
        "  {reset_link}\n\n"
        "Once your password is set, you can sign in to Service+ with your Login ID "
        "and the password you chose.\n\n"
        "If you did not expect this email, please ignore it or contact your administrator.\n\n"
        "Welcome aboard,\n"
        "The Service+ Team"
    )
    EMAIL_NEW_BU_USER_LINK_SUBJECT = "Welcome to Service+ — Set Your Password to Get Started"

    # Login email for a sign-up approved on the portal (plans/plan.md Step 9): names the
    # client to pick on the login screen, since the shared database holds many customers.
    EMAIL_SIGNUP_USER_LINK_BODY = (
        "Hello {full_name},\n\n"
        "Your Service+ sign-up has been approved. Welcome!\n\n"
        "Here are your sign-in details:\n\n"
        "  Client   : {client_name}\n"
        "  Login ID : {username}\n\n"
        "Set your password with the secure link below (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "Then sign in to Service+: choose the client \"{client_name}\", enter your Login ID and "
        "the password you chose.\n\n"
        "Welcome aboard,\n"
        "The Service+ Team"
    )
    EMAIL_SIGNUP_USER_LINK_SUBJECT = "Your Service+ account is ready — set your password"

    EMAIL_BU_RESET_LINK_BODY = (
        "Hello {full_name},\n\n"
        "A password reset has been requested for your account.\n\n"
        "Click the link below to set your new password (valid for 48 hours):\n\n"
        "  {reset_link}\n\n"
        "If you did not request this, please contact your administrator.\n\n"
        "-- Service+"
    )
    EMAIL_BU_RESET_LINK_SUBJECT = "Reset Your Password"

    # Error messages - Database
    DATABASE_CONNECTION_FAILED = "Failed to connect to database"
    DATABASE_QUERY_FAILED = "Database query failed"
    DATABASE_UNAVAILABLE = "Database is temporarily unavailable. Please try again later."
    DB_DROP_FAILED = "Failed to drop the database"
    DB_DROP_FORBIDDEN = "Cannot drop a database that is still linked to a client"
    DB_NOT_ORPHAN = "Database is not an orphan — it is still linked to a client"
    DUPLICATE_ENTRY = "Duplicate entry exists"

    # Test email
    EMAIL_TEST_SUBJECT = "Service+ - Connectivity Test"
    EMAIL_TEST_BODY = (
        "Hello,\n\n"
        "This is an automated connectivity test from the Service+ system.\n\n"
        "If you received this message, the mail server is configured correctly\n"
        "and outbound delivery is working as expected.\n\n"
        "No action is required.\n\n"
        "-- Service+"
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
    """Base exception class for Service+ application."""

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


class CodedValidationException(ValidationException):
    """A validation refusal with its own error code, which reaches the client as
    extensions.code (format_graphql_error sets it from `code`, so a "code" key put in
    `extensions` of a plain ValidationException would be overwritten by VALIDATION_ERROR)."""

    def __init__(self, message: str, code: str, extensions: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, extensions=extensions)
        self.code = code


class AuthorizationException(ServicePlusException):
    """Exception raised when authorization fails."""

    def __init__(
        self,
        message: str = AppMessages.UNAUTHORIZED,
        extensions: Optional[Dict[str, Any]] = None,
        code: str = "UNAUTHORIZED"
    ):
        super().__init__(message=message, code=code, extensions=extensions)


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
