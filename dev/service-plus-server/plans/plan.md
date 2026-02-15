# Login Mechanism Implementation Plan

## Overview
Implement a secure authentication and login system for the Service Plus server using FastAPI and GraphQL.

## Architecture Decision
**Best Practice Recommendation:**
- **Login/Register endpoints**: Use REST API (FastAPI router) - these are unprotected, public endpoints
- **Protected operations**: Use GraphQL with token-based authentication
- **Rationale**:
  - Login is a simple request-response, doesn't benefit from GraphQL's flexibility
  - REST is simpler for authentication flows and widely adopted
  - GraphQL for authenticated business logic provides better type safety and query flexibility
  - Separates authentication concerns from application logic

## Workflow
```
User Login Flow:
1. User sends credentials to REST endpoint (/api/auth/login)
2. Server validates credentials against database
3. Server generates JWT token on success
4. Client stores token
5. Client sends token in Authorization header for GraphQL requests
6. GraphQL middleware validates token before processing queries/mutations
7. GraphQL resolvers access authenticated user context

User Registration Flow:
1. User sends registration data to REST endpoint (/api/auth/register)
2. Server validates input and checks for existing users
3. Server hashes password and stores user in database
4. Server returns success or error response

Protected GraphQL Operations:
1. Client includes JWT token in Authorization header
2. GraphQL middleware extracts and validates token
3. User information attached to context
4. Resolvers access user context for authorization checks
5. Execute business logic based on permissions
```

## Step 1: Create Messages/Exceptions Class
**File**: `app/core/messages.py`
- Create a centralized Messages class for all custom messages
- Include authentication-related messages (invalid credentials, token expired, etc.)
- Include authorization messages (unauthorized, forbidden, etc.)
- Include general application messages

## Step 2: Create Database Models
**File**: `app/models/user.py`
- Create User model with fields:
  - id (UUID/Integer primary key)
  - username (unique, indexed)
  - email (unique, indexed)
  - hashed_password
  - full_name
  - is_active (boolean)
  - is_superuser (boolean)
  - created_at (timestamp)
  - updated_at (timestamp)

**File**: `app/models/session.py` (optional)
- Create Session/Token model for tracking active sessions
- Fields: token_id, user_id, token, expires_at, created_at

## Step 3: Create Authentication SQL Class
**File**: `app/db/auth_queries.py`
- Create AuthQueries class containing all authentication/authorization SQL:
  - get_user_by_username(username)
  - get_user_by_email(email)
  - get_user_by_id(user_id)
  - create_user(user_data)
  - update_user_password(user_id, hashed_password)
  - update_user_active_status(user_id, is_active)
  - verify_user_exists(username, email)

## Step 4: Create Application SQL Class
**File**: `app/db/app_queries.py`
- Create AppQueries class for all non-auth business logic SQL
- Placeholder for future service management queries
- Example methods:
  - get_services()
  - create_service()
  - update_service()
  - etc.

## Step 5: Implement Password Hashing Utility
**File**: `app/core/security.py`
- Implement password hashing using bcrypt or passlib
- Functions:
  - hash_password(plain_password) -> hashed_password
  - verify_password(plain_password, hashed_password) -> bool
  - create_access_token(data, expires_delta) -> JWT token
  - decode_access_token(token) -> payload or None

## Step 6: Create Pydantic Schemas
**File**: `app/schemas/auth.py`
- UserCreate (registration input)
- UserLogin (login input)
- UserResponse (user output, exclude password)
- Token (access_token, token_type)
- TokenPayload (JWT payload)

## Step 7: Create Authentication Router
**File**: `app/routers/auth.py`
- Create FastAPI router for authentication endpoints
- Endpoints:
  - POST /api/auth/register - User registration
  - POST /api/auth/login - User login
  - POST /api/auth/logout - User logout (optional, invalidate token)
  - GET /api/auth/me - Get current user info
  - POST /api/auth/refresh - Refresh token (optional)

## Step 8: Implement Authentication Dependency
**File**: `app/core/dependencies.py`
- Create `get_current_user` dependency
- Extract JWT token from Authorization header
- Validate token and decode payload
- Retrieve user from database
- Raise exception if token invalid or user not found
- Return authenticated user

## Step 9: Configure GraphQL Authentication
**File**: `app/graphql/context.py`
- Create context builder function
- Extract user from request (using get_current_user)
- Return context dict with user information
- Handle unauthenticated requests gracefully

**File**: `app/graphql/middleware.py`
- Create authentication middleware for GraphQL
- Check if query/mutation requires authentication
- Validate user in context
- Allow introspection queries without authentication

## Step 10: Update GraphQL Schema
**File**: `app/graphql/schema.graphql`
- Add User type
- Add authenticated queries (me, users)
- Add authenticated mutations (updateProfile, changePassword)
- Add proper directives or documentation for protected fields

## Step 11: Implement GraphQL Resolvers
**File**: `app/graphql/resolvers/user_resolvers.py`
- Implement resolvers for user-related queries/mutations
- Access user from context: `info.context["user"]`
- Check permissions before executing operations
- Use AuthQueries for database operations

## Step 12: Update Main Application
**File**: `app/main.py`
- Import and include authentication router
- Configure CORS for authentication endpoints
- Add authentication middleware to GraphQL
- Keep main.py minimal, delegate to routers

## Step 13: Create Configuration
**File**: `app/core/config.py`
- Add configuration for:
  - SECRET_KEY for JWT signing
  - ALGORITHM (HS256 or RS256)
  - ACCESS_TOKEN_EXPIRE_MINUTES
  - Database connection settings
- Use pydantic-settings for environment variables

## Step 14: Implement Logger
**File**: `app/core/logger.py`
- Configure structured logging
- Log authentication attempts (success/failure)
- Log authorization failures
- Log important application events
- Use Python's logging module with custom formatters

## Step 15: Create Database Connection Manager
**File**: `app/db/database.py`
- Create database connection pool using psycopg
- Connection context manager
- Transaction management helpers
- Error handling for database operations

## Step 16: Write Tests
**File**: `tests/test_auth.py`
- Test user registration (success, duplicate, validation)
- Test login (success, wrong password, non-existent user)
- Test protected endpoints (with/without token, expired token)
- Test GraphQL authentication middleware

## Step 17: Create Environment Configuration
**File**: `.env.example`
- Document required environment variables
- SECRET_KEY, DATABASE_URL, TOKEN_EXPIRE, etc.

**File**: `.env`
- Create actual environment file (add to .gitignore)

## Step 18: Update Requirements
**File**: `requirements.txt`
- Add dependencies if missing:
  - python-jose[cryptography] or PyJWT (JWT handling)
  - passlib[bcrypt] (password hashing)
  - python-multipart (form data handling)

## Step 19: Documentation
**File**: `docs/authentication.md`
- Document authentication flow
- Document API endpoints
- Document GraphQL authentication
- Provide example requests/responses

## Step 20: Testing and Validation
- Test complete authentication flow
- Test token expiration and refresh
- Test GraphQL operations with/without authentication
- Test error handling and logging
- Verify all custom messages are used properly
- Security audit (SQL injection, XSS, password storage)

## Dependencies Between Steps
- Steps 1-2: Can be done in parallel
- Step 3-4: Depends on Step 2 (models)
- Step 5: Independent, can be done early
- Step 6: Depends on Step 2 (models)
- Step 7: Depends on Steps 3, 5, 6
- Step 8: Depends on Steps 5, 6
- Step 9: Depends on Step 8
- Step 10-11: Depends on Steps 2, 6, 9
- Step 12: Depends on Step 7
- Step 13: Can be done early
- Step 14: Can be done early
- Step 15: Can be done early
- Step 16: Depends on Steps 7-12
- Step 17-18: Can be done anytime
- Step 19-20: Final steps

## Security Considerations
1. Store passwords using strong hashing (bcrypt with high cost factor)
2. Use secure JWT secret key (generate random, keep private)
3. Set appropriate token expiration times
4. Validate all user inputs
5. Use HTTPS in production
6. Implement rate limiting for login endpoints
7. Log security events for monitoring
8. Use prepared statements to prevent SQL injection
9. Sanitize error messages to avoid information disclosure
10. Implement CORS properly to prevent unauthorized access
