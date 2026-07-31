"""Shared error-handling decorator for GraphQL mutation/query dispatchers.

Every resolver in mutation.py/query.py used to repeat the same ~10-line
try/except: re-raise ValidationException as-is, log anything else and wrap
it in a GraphQLException. @handle_graphql_errors replaces that boilerplate.
"""
import functools
from typing import Callable

from app.core.exceptions import (
    AppMessages,
    AuthorizationException,
    GraphQLException,
    ServicePlusException,
    ValidationException,
)
from app.logger import logger


def handle_graphql_errors(
    log_message: str, exception_message: str = AppMessages.OPERATION_FAILED
) -> Callable:
    """Wrap a resolver: re-raise ValidationException/AuthorizationException as-is,
    convert anything else to a logged GraphQLException.

    Resolvers commonly call an access-right guard (require_access_right /
    require_any_access_right) before delegating to the domain helper; those
    guards raise AuthorizationException, which must reach the client
    unmodified just like ValidationException — not get flattened into a
    generic "operation failed".

    Args:
        log_message: Prefix logged alongside the exception (e.g. "Error creating admin user").
        exception_message: Message surfaced to the GraphQL client (default: OPERATION_FAILED).
    """

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            try:
                return await fn(*args, **kwargs)
            except (ValidationException, AuthorizationException):
                raise
            except Exception as e:
                logger.error("%s: %s", log_message, e, exc_info=True)
                raise GraphQLException(
                    message=exception_message, extensions={"details": str(e)}
                ) from e

        return wrapper

    return decorator


def handle_query_errors(log_message: str) -> Callable:
    """Wrap a query resolver: re-raise any ServicePlusException as-is (the
    query.py resolvers use this broader base-class check rather than
    ValidationException alone), convert anything else to a logged
    GraphQLException with a generic client-facing message — the query.py
    resolvers deliberately don't leak `str(e)` to the client the way
    mutation.py's do.

    Args:
        log_message: Prefix logged alongside the exception (e.g. "Unexpected audit logs failure").
    """

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            try:
                return await fn(*args, **kwargs)
            except ServicePlusException:
                raise
            except Exception as e:
                logger.error("%s: %s", log_message, e, exc_info=True)
                raise GraphQLException(
                    message=AppMessages.INTERNAL_SERVER_ERROR,
                    extensions={"details": AppMessages.UNEXPECTED_ERROR},
                ) from e

        return wrapper

    return decorator
