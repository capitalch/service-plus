"""
GraphQL schema loader and configuration.
"""
from pathlib import Path
from typing import Any
from ariadne import make_executable_schema, load_schema_from_path
from ariadne.asgi import GraphQL
from ariadne.asgi.handlers import GraphQLTransportWSHandler
from app.logger import logger
from app.exceptions import format_graphql_error, AuthorizationException
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
    }

    auth_header = request.headers.get("authorization") if hasattr(request, "headers") else None
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return context

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except AuthorizationException:
        return context

    context.update({
        "user_id": payload.get("sub"),
        "user_type": payload.get("user_type"),
        "role_code": payload.get("role_code"),
        "access_rights": payload.get("access_rights") or [],
        "client_id": payload.get("client_id"),
        "db_name": payload.get("db_name"),
    })
    return context


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
            websocket_handler=GraphQLTransportWSHandler(),
            error_formatter=lambda error, debug: format_graphql_error(error, debug)
        )

        logger.info("GraphQL ASGI app created with graphql-transport-ws WebSocket support")
        return graphql_app

    except Exception as e:
        logger.error("Error creating GraphQL app: %s", e)
        raise
