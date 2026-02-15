# Plan: Implement Login Mechanism with Access Token Management

## Overview
Create a complete login mechanism for the Service Plus server. The login screen has a "Select Client" dropdown (fetched from database `service_plus_client`, schema `public`, table `client`), plus username/password fields. JWT-based access token management will secure all GraphQL endpoints.

---

## Step 1: Install Required Dependencies
- Install `python-jose[cryptography]` for JWT token creation and verification
- Install `passlib[bcrypt]` for password hashing and verification
- Update `requirements.txt`

## Step 2: Add Auth-Related Settings to `app/config.py`
- Add `auth_db_name: str = "service_plus_client"` (separate database for client/user data)
- Add `jwt_secret_key` setting
- Add `jwt_algorithm: str = "HS256"`
- Add `jwt_access_token_expire_minutes: int = 30`
- Add a property `auth_db_connection_string` to build connection string for the `service_plus_client` database

## Step 3: Add Auth-Related Messages to `app/exceptions.py`
Add new constants to `AppMessages`:
- `LOGIN_SUCCESS = "Login successful"`
- `LOGOUT_SUCCESS = "Logout successful"`
- `TOKEN_EXPIRED = "Access token has expired"`
- `TOKEN_INVALID = "Invalid access token"`
- `INVALID_USERNAME_OR_PASSWORD = "Invalid username or password"`
- `CLIENT_NOT_FOUND = "Client not found"`
- `CLIENT_LIST_FETCHED = "Client list fetched successfully"`
- `USER_NOT_FOUND = "User not found"`
- `AUTHENTICATION_REQUIRED = "Authentication required"`

## Step 4: Create Database Utility Module `app/db/connection.py`
- Create `app/db/__init__.py`
- Create `app/db/connection.py` with:
  - Async function `get_db_connection(connection_string)` — returns a `psycopg` async connection
  - Async function `get_auth_db_connection()` — returns connection to `service_plus_client` database
  - Async function `get_app_db_connection()` — returns connection to main `service_plus_demo` database
  - Use context manager pattern for connection lifecycle
  - Logger for all connection events and errors

## Step 5: Create Auth Service Module `app/auth/service.py`
- Create `app/auth/__init__.py`
- Create `app/auth/service.py` with:
  - `verify_password(plain_password, hashed_password)` — uses passlib to verify
  - `hash_password(password)` — uses passlib to hash
  - `create_access_token(data: dict, expires_delta: timedelta | None)` — creates JWT with sub, client_id, exp claims
  - `decode_access_token(token: str)` — decodes and validates JWT, raises AuthorizationException on failure
  - `authenticate_user(client_id, username, password)` — queries `service_plus_client` database, verifies credentials, returns user data or raises exception

## Step 6: Create Auth Middleware `app/auth/middleware.py`
- Create `app/auth/middleware.py` with:
  - `get_current_user(request)` — extracts Bearer token from `Authorization` header, decodes it, returns user context dict
  - This function will be used in GraphQL context to inject authenticated user info
- Public operations (like `health` query and `clients` query) should be accessible without auth
- All other GraphQL operations require valid token

## Step 7: Update GraphQL Schema `app/graphql/types/schema.graphql`
Add new types and operations:
- **Type `Client`**: `id: ID!`, `name: String!`, `code: String`, `address: String`, `isActive: Boolean!`
- **Type `AuthPayload`**: `accessToken: String!`, `tokenType: String!`, `expiresIn: Int!`, `user: AuthUser!`
- **Type `AuthUser`**: `id: ID!`, `username: String!`, `fullName: String!`, `clientId: ID!`, `clientName: String!`
- **Input `LoginInput`**: `clientId: ID!`, `username: String!`, `password: String!`
- **Query `clients`**: `clients: [Client!]!` — public, no auth required (for login dropdown)
- **Mutation `login(input: LoginInput!)`**: `AuthPayload!` — public, returns access token

## Step 8: Create Auth Query Resolver `app/graphql/resolvers/auth_query.py`
- Create resolver for `clients` query:
  - Connects to `service_plus_client` database
  - Queries `public.client` table
  - Returns list of active clients for the dropdown
  - No authentication required

## Step 9: Create Auth Mutation Resolver `app/graphql/resolvers/auth_mutation.py`
- Create resolver for `login` mutation:
  - Accepts `clientId`, `username`, `password`
  - Calls `authenticate_user()` from auth service
  - On success: generates JWT access token and returns `AuthPayload`
  - On failure: raises `AuthorizationException` with appropriate message

## Step 10: Update GraphQL Schema Loader `app/graphql/schema.py`
- Import new auth query and auth mutation resolvers
- Bind them to the schema alongside existing resolvers

## Step 11: Integrate Auth Context into GraphQL App
- Update `create_graphql_app()` in `app/graphql/schema.py` to pass a `context_value` function
- The context function will:
  - Extract the request object
  - Attempt to decode the Bearer token (if present)
  - Attach `user` info to the GraphQL context (or `None` if no token / public endpoint)
- Update existing resolvers (`query.py`, `mutation.py`) to check `info.context["user"]` and raise `AuthorizationException` if user is not authenticated
- Exempt public resolvers: `health`, `clients`, `login`

## Step 12: Test and Verify
- Start the server and verify:
  - `clients` query returns list of clients without auth
  - `login` mutation returns access token on valid credentials
  - `login` mutation returns error on invalid credentials
  - Existing queries/mutations return `UNAUTHORIZED` error without token
  - Existing queries/mutations work correctly with valid Bearer token
  - Expired token returns proper error message

---

## Files to Create
| File | Purpose |
|------|---------|
| `app/db/__init__.py` | DB package init |
| `app/db/connection.py` | Database connection utilities |
| `app/auth/__init__.py` | Auth package init |
| `app/auth/service.py` | JWT + password + user authentication logic |
| `app/auth/middleware.py` | Token extraction and user context injection |
| `app/graphql/resolvers/auth_query.py` | Resolver for `clients` query |
| `app/graphql/resolvers/auth_mutation.py` | Resolver for `login` mutation |

## Files to Modify
| File | Changes |
|------|---------|
| `requirements.txt` | Add python-jose, passlib, bcrypt |
| `app/config.py` | Add auth DB + JWT settings |
| `app/exceptions.py` | Add auth-related messages |
| `app/graphql/types/schema.graphql` | Add Client, AuthPayload, AuthUser types + login mutation + clients query |
| `app/graphql/schema.py` | Bind new resolvers + add auth context |
| `app/graphql/resolvers/query.py` | Add auth checks to existing resolvers |
| `app/graphql/resolvers/mutation.py` | Add auth checks to existing resolvers |
