"""
Pub/Sub mechanism for GraphQL subscriptions.
"""
import asyncio
from typing import Any, AsyncGenerator, Dict, Set
from app.logger import logger


class PubSub:
    """
    In-memory async pub/sub system for GraphQL subscriptions.

    Manages event-based messaging using asyncio.Queue for asynchronous
    communication between publishers and subscribers.
    """

    def __init__(self):
        """Initialize the PubSub system."""
        # Dictionary to store queues for each event
        # Key: event name, Value: set of queues listening to that event
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        logger.info("PubSub system initialized")

    async def publish(self, event: str, data: Any) -> None:
        """
        Publish data to all subscribers of an event.

        Args:
            event: Event name/channel
            data: Data to publish to subscribers
        """
        if event not in self._subscribers:
            logger.debug("No subscribers for event: %s", event)
            return

        # Get all queues subscribed to this event
        queues = self._subscribers.get(event, set())

        if not queues:
            logger.debug("No active queues for event: %s", event)
            return

        logger.debug("Publishing to event '%s' with %d subscriber(s)", event, len(queues))

        # Send data to all subscriber queues
        for queue in queues:
            try:
                await queue.put(data)
                logger.debug("Data published to queue for event: %s", event)
            except Exception as e:
                logger.error("Error publishing to queue for event '%s': %s", event, e)

    async def subscribe(self, event: str) -> AsyncGenerator[Any, None]:
        """
        Subscribe to an event and yield published data.

        This method returns an async generator that yields data
        published to the specified event. It's designed to be used
        in GraphQL subscription resolvers.

        Args:
            event: Event name/channel to subscribe to

        Yields:
            Data published to the event
        """
        # Create a new queue for this subscriber
        queue: asyncio.Queue = asyncio.Queue()

        # Add queue to subscribers
        if event not in self._subscribers:
            self._subscribers[event] = set()

        self._subscribers[event].add(queue)
        logger.debug("New subscriber added to event: %s", event)

        try:
            # Continuously yield data from the queue
            while True:
                data = await queue.get()
                logger.debug("Subscriber received data for event: %s", event)
                yield data
        except asyncio.CancelledError:
            logger.debug("Subscription cancelled for event: %s", event)
        except Exception as e:
            logger.error("Error in subscription for event '%s': %s", event, e)
        finally:
            # Clean up: remove queue from subscribers
            if event in self._subscribers:
                self._subscribers[event].discard(queue)

                # Remove event key if no more subscribers
                if not self._subscribers[event]:
                    del self._subscribers[event]
                    logger.debug("No more subscribers for event: %s, removed event", event)

            logger.debug("Subscriber removed from event: %s", event)

    def get_subscriber_count(self, event: str) -> int:
        """
        Get the number of active subscribers for an event.

        Args:
            event: Event name/channel

        Returns:
            Number of active subscribers
        """
        return len(self._subscribers.get(event, set()))

    def get_all_events(self) -> list[str]:
        """
        Get list of all events that have active subscribers.

        Returns:
            List of event names
        """
        return list(self._subscribers.keys())


# Create and export singleton PubSub instance
pubsub = PubSub()


# ─── Named events ─────────────────────────────────────────────────────────────

# Extended Warranty. Anything that changes a lead for everyone watching the screen — a
# state or stage move, a follow-up, a send, the customer's interest or opt-out, a lead
# entered or edited. It rides the whatsapp_delivery_status channel rather than taking one
# of its own so the client keeps a SINGLE subscription; `kind` tells the two apart, and a
# client that predates this kind simply ignores it.
#
# whatsapp_delivery_status_generator filters by db_name alone, so a tenant's every open BU
# receives this — `schema` is carried for the client to match on and skip a needless read.
EW_LEAD_CHANGED_KIND = "EW_LEAD"


async def publish_ew_lead_changed(
    db_name: str, schema: str, reason: str, ew_lead_id: int | None = None
) -> None:
    """Tell every open Extended Warranty screen of this tenant to re-read.

    Never raises: a lead change must not fail because the push did. `reason` names what
    happened — logged today, and there for a client that later wants to act on one kind
    of change instead of re-reading everything.
    """
    try:
        await pubsub.publish(
            "whatsapp_delivery_status",
            {
                "db_name": db_name,
                "ew_lead_id": ew_lead_id,
                "kind": EW_LEAD_CHANGED_KIND,
                "reason": reason,
                "schema": schema,
            },
        )
    except Exception as e:  # pylint: disable=broad-except
        logger.error("publish_ew_lead_changed failed (schema=%s reason=%s): %s", schema, reason, e)
