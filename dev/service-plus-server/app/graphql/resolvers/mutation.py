"""
GraphQL Mutation resolvers.
"""

from typing import Any
from ariadne import MutationType
from app.logger import logger
from app.exceptions import ValidationException, GraphQLException, AppMessages
from app.graphql.resolvers.mutation_helper import resolve_generic_update_helper
# from app.graphql.pubsub import pubsub


# Create MutationType instance
mutation = MutationType()


@mutation.field("genericUpdate")
async def resolve_generic_update(_, info, db_name="", schema="public", value="") -> Any:
    """Generic update resolver.
    Update a generic database entry.

    Args:
        db_name: Database name
        schema: Database schema (default: "public")
        value: Value to update
    Returns:
        Updated database entry data
    """
    try:
        return await resolve_generic_update_helper(db_name, schema, value)

    except ValidationException:
        raise
    except Exception as e:
        logger.error(f"Error creating customer: {str(e)}")
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )
