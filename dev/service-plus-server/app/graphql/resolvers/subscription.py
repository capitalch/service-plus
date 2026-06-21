"""
GraphQL Subscription resolvers.
"""
from typing import Any, AsyncGenerator, Optional
from ariadne import SubscriptionType
from app.logger import logger
from app.graphql.pubsub import pubsub


# Create SubscriptionType instance
subscription = SubscriptionType()


@subscription.source("genericSubscription")
async def service_order_updated_generator(
    obj: Any,
    info: Any,
    orderId: Optional[str] = None
) -> AsyncGenerator:
    """
    Subscription source for service order updates.

    Args:
        orderId: Optional specific order ID to subscribe to

    Yields:
        Service order data when updates occur
    """
    try:
        event_name = "service_order_updated"
        logger.info(f"New subscription to {event_name} (orderId: {orderId})")

        # Subscribe to the pub/sub event
        async for service_order in pubsub.subscribe(event_name):
            # If orderId is specified, filter events
            if orderId is None or service_order.get("id") == orderId:
                logger.debug(f"Yielding service order update: {service_order.get('id')}")
                yield service_order
            else:
                logger.debug(f"Skipping service order update (ID mismatch): {service_order.get('id')}")

    except Exception as e:
        logger.error(f"Error in serviceOrderUpdated subscription: {str(e)}")
    finally:
        logger.info(f"Subscription to {event_name} ended (orderId: {orderId})")


@subscription.source("accountsPostingProgress")
async def accounts_posting_progress_generator(
    obj: Any,
    info: Any,
    db_name: str,
    branchId: str,
) -> AsyncGenerator:
    """
    Subscription source for accounts-posting progress.

    Yields progress events for the given branch as each unposted record across
    its divisions is posted to trace-plus by the accountsPosting mutation.

    Args:
        db_name: Service database name (part of the operation contract; unused for filtering)
        branchId: Branch whose posting progress to stream

    Yields:
        Progress payloads ({total, posted, failed, currentRef, currentDivision, done, ...})
    """
    event_name = "accounts_posting_progress"
    try:
        logger.info(f"New subscription to {event_name} (branchId: {branchId})")
        async for data in pubsub.subscribe(event_name):
            if str(data.get("branchId")) == str(branchId):
                yield data
    except Exception as e:
        logger.error(f"Error in accountsPostingProgress subscription: {str(e)}")
    finally:
        logger.info(f"Subscription to {event_name} ended (branchId: {branchId})")


@subscription.field("accountsPostingProgress")
def accounts_posting_progress_resolver(data: Any, info: Any, **kwargs: Any) -> Any:
    """Return the progress payload yielded by the generator as-is (Generic scalar)."""
    return data


# @subscription.field("serviceOrderUpdated")
# async def service_order_updated_resolver(service_order: Any, info: Any) -> Any:
#     """
#     Subscription field resolver for service order updates.

#     Args:
#         service_order: Service order data from the generator

#     Returns:
#         The service order data
#     """
#     return service_order


# @subscription.source("serviceOrderStatusChanged")
# async def service_order_status_changed_generator(
#     obj: Any,
#     info: Any,
#     orderId: str
# ) -> AsyncGenerator:
#     """
#     Subscription source for service order status changes.

#     Args:
#         orderId: Service order ID to monitor

#     Yields:
#         Service order data when status changes
#     """
#     try:
#         event_name = f"service_order_status_changed_{orderId}"
#         logger.info(f"New subscription to status changes for order: {orderId}")

#         # Subscribe to the specific order's status change events
#         async for service_order in pubsub.subscribe(event_name):
#             logger.debug(f"Yielding status change for order: {orderId}")
#             yield service_order

#     except Exception as e:
#         logger.error(f"Error in serviceOrderStatusChanged subscription: {str(e)}")
#     finally:
#         logger.info(f"Subscription to status changes ended for order: {orderId}")


# @subscription.field("serviceOrderStatusChanged")
# async def service_order_status_changed_resolver(service_order: Any, info: Any) -> Any:
#     """
#     Subscription field resolver for service order status changes.

#     Args:
#         service_order: Service order data from the generator

#     Returns:
#         The service order data
#     """
#     return service_order
