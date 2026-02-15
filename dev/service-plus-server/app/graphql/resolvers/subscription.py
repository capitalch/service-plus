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
