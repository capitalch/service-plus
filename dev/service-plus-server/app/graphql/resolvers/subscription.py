"""
GraphQL Subscription resolvers.
"""
from typing import Any, AsyncGenerator
from ariadne import SubscriptionType
from app.logger import logger
from app.config import settings
from app.graphql.pubsub import SALES_ENQUIRY_COUNT_EVENT, pubsub
from app.graphql.resolvers.auth_guards import (
    require_authenticated,
    require_own_tenant,
    require_user_type,
    subscriber_may_receive,
)


# Create SubscriptionType instance
subscription = SubscriptionType()


@subscription.source("accountsPostingProgress")
async def accounts_posting_progress_source(
    obj: Any,
    info: Any,
    db_name: str,
    branchId: str,
) -> AsyncGenerator:
    """
    Subscription source for accounts-posting progress.

    Guards run here, before the stream starts, so a refused caller gets an error
    instead of a silent socket (plans/plan.md Step 6). Each event must then match
    the caller's database and BU (subscriber_may_receive) as well as the branch:
    branch ids are per BU schema, so the same id exists in every BU.

    Args:
        db_name: Service database name; must be the caller's own
        branchId: Branch whose posting progress to stream

    Returns:
        Progress payloads ({db_name, schema, total, posted, failed, currentRef, currentDivision, done, ...})
    """
    require_authenticated(info)
    require_own_tenant(info, db_name)
    return _accounts_posting_progress_stream(dict(info.context), db_name, branchId)


async def _accounts_posting_progress_stream(context: dict, db_name: str, branch_id: str) -> AsyncGenerator:
    event_name = "accounts_posting_progress"
    try:
        logger.info(f"New subscription to {event_name} (branchId: {branch_id})")
        async for data in pubsub.subscribe(event_name):
            if (
                data.get("db_name") == db_name
                and str(data.get("branchId")) == str(branch_id)
                and subscriber_may_receive(context, data)
            ):
                yield data
    except Exception as e:
        logger.error(f"Error in accountsPostingProgress subscription: {str(e)}")
    finally:
        logger.info(f"Subscription to {event_name} ended (branchId: {branch_id})")


@subscription.field("accountsPostingProgress")
def accounts_posting_progress_resolver(data: Any, info: Any, **kwargs: Any) -> Any:
    """Return the progress payload yielded by the generator as-is (Generic scalar)."""
    return data


@subscription.source("whatsappDeliveryStatus")
async def whatsapp_delivery_status_source(
    obj: Any,
    info: Any,
    db_name: str,
) -> AsyncGenerator:
    """
    Subscription source for WhatsApp completion-message delivery outcomes and
    Extended Warranty lead changes (`kind` tells them apart).

    Published by the webhook receiver (app/routers/webhooks/whatsapp_webhook_router.py),
    the delivery-confirmation mutations (app/whatsapp/sender.py) and the Extended
    Warranty writers. Every event carries `db_name` and the BU `schema`; a caller gets
    only events of their own database and, for a business user, their own BUs
    (subscriber_may_receive; plans/plan.md Step 6). The client still filters by the
    job ids / leads it is showing.

    Args:
        db_name: Client database name; must be the caller's own

    Returns:
        {db_name, schema, job_id, status, error, kind, ...} payloads
    """
    require_authenticated(info)
    require_own_tenant(info, db_name)
    return _whatsapp_delivery_status_stream(dict(info.context), db_name)


async def _whatsapp_delivery_status_stream(context: dict, db_name: str) -> AsyncGenerator:
    event_name = "whatsapp_delivery_status"
    try:
        logger.info(f"New subscription to {event_name} (db_name: {db_name})")
        async for data in pubsub.subscribe(event_name):
            if data.get("db_name") == db_name and subscriber_may_receive(context, data):
                yield data
    except Exception as e:
        logger.error(f"Error in whatsappDeliveryStatus subscription: {str(e)}")
    finally:
        logger.info(f"Subscription to {event_name} ended (db_name: {db_name})")


@subscription.field("whatsappDeliveryStatus")
def whatsapp_delivery_status_resolver(data: Any, info: Any, **kwargs: Any) -> Any:
    """Return the delivery-status payload yielded by the generator as-is (Generic scalar)."""
    return data


@subscription.source("salesEnquiryCount")
async def sales_enquiry_count_source(
    obj: Any,
    info: Any,
    db_name: str,
) -> AsyncGenerator:
    """
    Pending sign-up count for the approvers' notification bell (plans/plan.md Steps
    6, 9, 10). Admins of `db_name` (the default customer database, lt sign-ups) or
    the Super Admin (Enterprise enquiries, `db_name` = the control-plane database)
    only. Publishers call publish_sales_enquiry_count; the screen re-reads the count
    on open, so a missed event (another server process) only delays the badge.

    Args:
        db_name: Database whose enquiry count to stream

    Returns:
        {db_name, kind, pending} payloads
    """
    require_user_type(info, {"A", "S"})
    require_own_tenant(info, db_name)
    # The Super Admin has no database of their own; an empty db_name means the control
    # plane, where Enterprise enquiries are published (require_own_tenant already refuses
    # an empty db_name for an Admin).
    return _sales_enquiry_count_stream(db_name or settings.client_db_name)


async def _sales_enquiry_count_stream(db_name: str) -> AsyncGenerator:
    try:
        async for data in pubsub.subscribe(SALES_ENQUIRY_COUNT_EVENT):
            if data.get("db_name") == db_name:
                yield data
    except Exception as e:
        logger.error(f"Error in salesEnquiryCount subscription: {str(e)}")


@subscription.field("salesEnquiryCount")
def sales_enquiry_count_resolver(data: Any, info: Any, **kwargs: Any) -> Any:
    """Return the count payload yielded by the generator as-is (Generic scalar)."""
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
