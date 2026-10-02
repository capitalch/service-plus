"""
GraphQL schema loader and configuration.
"""
from pathlib import Path
from typing import Any
from ariadne import make_executable_schema, load_schema_from_path
from ariadne.asgi import GraphQL
from ariadne.asgi.handlers import GraphQLTransportWSHandler
from app.logger import logger
from app.core.exceptions import AppMessages, format_graphql_error, AuthorizationException
from app.config import settings
from app.core.security import decode_token
from app.graphql.resolvers.query import query
from app.graphql.resolvers.mutation import mutation
from app.graphql.resolvers.subscription import subscription


async def get_graphql_context(request: Any, _data: Any) -> dict:
    """
    Build per-request GraphQL context from the `Authorization` header.

    A missing or invalid token leaves `access_rights` empty and `user_id`/
    `role_code` unset rather than raising — this keeps every existing
    unauthenticated query/mutation working as before. Only resolvers that
    call `require_access_right` (see `app/graphql/resolvers/auth_guards.py`)
    actually reject on a missing right.
    """
    context: dict = {
        "request": request,
        "user_id": None,
        "user_type": None,
        "role_code": None,
        "access_rights": [],
        "client_id": None,
        "db_name": None,
        "bu_codes": [],
        "auth_error": None,
    }

    # A subscription socket: on_ws_connect verified its token once, at connect, and
    # left the claims in the connection scope. Browsers cannot set headers on a
    # WebSocket, so the token travels in connection_init's payload, not a header.
    scope = getattr(request, "scope", None) or {}
    if WS_CLAIMS_SCOPE_KEY in scope:
        return _apply_claims(context, scope[WS_CLAIMS_SCOPE_KEY])

    auth_header = request.headers.get("authorization") if hasattr(request, "headers") else None
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return context

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except AuthorizationException as exc:
        # A token was presented but rejected (expired/invalid). Record why so
        # guarded resolvers can surface a distinct TOKEN_EXPIRED error instead
        # of a misleading "Access forbidden"; a *missing* token stays a plain
        # unauthenticated context (auth_error=None) and public queries work.
        context["auth_error"] = exc.message
        return context

    return _apply_claims(context, payload)


def _apply_claims(context: dict, payload: dict) -> dict:
    """Copy the token claims the guards read into the GraphQL context."""
    context.update({
        "user_id": payload.get("sub"),
        "user_type": payload.get("user_type"),
        "role_code": payload.get("role_code"),
        "access_rights": payload.get("access_rights") or [],
        "client_id": payload.get("client_id"),
        "db_name": payload.get("db_name"),
        "bu_codes": payload.get("bu_codes") or [],
    })
    return context


# Where on_ws_connect leaves a socket's verified token claims (the ASGI scope dict
# lives as long as the connection; the context is rebuilt for every subscribe).
WS_CLAIMS_SCOPE_KEY = "service_plus_claims"


def on_ws_connect(websocket: Any, payload: Any) -> None:
    """
    graphql-transport-ws `connection_init` hook (plans/plan.md Step 6). The client
    sends `{Authorization: "Bearer <token>"}` as connectionParams. A missing,
    expired or invalid token raises, and Ariadne then closes the socket without an
    ack; graphql-ws reconnects, re-reading the (by then refreshed) token.
    """
    params = payload if isinstance(payload, dict) else {}
    auth = params.get("Authorization") or params.get("authorization") or ""
    if not isinstance(auth, str) or not auth.lower().startswith("bearer "):
        raise AuthorizationException(AppMessages.UNAUTHORIZED)
    claims = decode_token(auth.split(" ", 1)[1].strip())
    if not claims.get("user_type"):
        raise AuthorizationException(AppMessages.TOKEN_INVALID)
    websocket.scope[WS_CLAIMS_SCOPE_KEY] = claims


# Get the path to the schema file
SCHEMA_PATH = Path(__file__).parent / "schema.graphql"


def create_schema():
    """
    Load GraphQL schema and bind resolvers.

    Returns:
        Executable GraphQL schema
    """
    try:
        logger.info("Loading GraphQL schema from: %s", SCHEMA_PATH)

        # Load schema from file
        type_defs = load_schema_from_path(str(SCHEMA_PATH))

        # Create executable schema with all resolvers
        schema = make_executable_schema(
            type_defs,
            query,
            mutation,
            subscription
        )

        logger.info("GraphQL schema created successfully")
        return schema

    except Exception as e:
        logger.error("Error creating GraphQL schema: %s", e)
        raise


def create_graphql_app() -> GraphQL:
    """
    Create and configure the GraphQL ASGI application.

    Returns:
        Configured GraphQL ASGI app
    """
    try:
        # Create the schema
        schema = create_schema()

        # Create GraphQL ASGI app with subscriptions enabled.
        # Use the graphql-transport-ws handler to match the client's `graphql-ws`
        # library (Ariadne defaults to the legacy subscriptions-transport-ws protocol,
        # which is incompatible and silently delivers no subscription events).
        graphql_app = GraphQL(
            schema,
            context_value=get_graphql_context,
            debug=settings.debug,
            websocket_handler=GraphQLTransportWSHandler(on_connect=on_ws_connect),
            error_formatter=lambda error, debug: format_graphql_error(error, debug)
        )

        logger.info("GraphQL ASGI app created with graphql-transport-ws WebSocket support")
        return graphql_app

    except Exception as e:
        logger.error("Error creating GraphQL app: %s", e)
        raise
