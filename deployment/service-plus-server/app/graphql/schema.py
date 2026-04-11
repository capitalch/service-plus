"""
GraphQL schema loader and configuration.
"""
from pathlib import Path
from ariadne import make_executable_schema, load_schema_from_path
from ariadne.asgi import GraphQL
from app.logger import logger
from app.exceptions import format_graphql_error
from app.config import settings
from app.graphql.resolvers.query import query
from app.graphql.resolvers.mutation import mutation
from app.graphql.resolvers.subscription import subscription


# Get the path to the schema file
SCHEMA_PATH = Path(__file__).parent / "schema.graphql"


def create_schema():
    """
    Load GraphQL schema and bind resolvers.

    Returns:
        Executable GraphQL schema
    """
    try:
        logger.info(f"Loading GraphQL schema from: {SCHEMA_PATH}")

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
        logger.error(f"Error creating GraphQL schema: {str(e)}")
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

        # Create GraphQL ASGI app with subscriptions enabled
        # WebSocket support is enabled by default in Ariadne
        graphql_app = GraphQL(
            schema,
            debug=settings.debug,
            error_formatter=lambda error, debug: format_graphql_error(error, debug)
        )

        logger.info("GraphQL ASGI app created with WebSocket support enabled")
        return graphql_app

    except Exception as e:
        logger.error(f"Error creating GraphQL app: {str(e)}")
        raise
