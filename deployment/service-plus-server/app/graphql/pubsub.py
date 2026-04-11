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
            logger.debug(f"No subscribers for event: {event}")
            return

        # Get all queues subscribed to this event
        queues = self._subscribers.get(event, set())

        if not queues:
            logger.debug(f"No active queues for event: {event}")
            return

        logger.info(f"Publishing to event '{event}' with {len(queues)} subscriber(s)")

        # Send data to all subscriber queues
        for queue in queues:
            try:
                await queue.put(data)
                logger.debug(f"Data published to queue for event: {event}")
            except Exception as e:
                logger.error(f"Error publishing to queue for event '{event}': {str(e)}")

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
        logger.info(f"New subscriber added to event: {event}")

        try:
            # Continuously yield data from the queue
            while True:
                data = await queue.get()
                logger.debug(f"Subscriber received data for event: {event}")
                yield data
        except asyncio.CancelledError:
            logger.info(f"Subscription cancelled for event: {event}")
        except Exception as e:
            logger.error(f"Error in subscription for event '{event}': {str(e)}")
        finally:
            # Clean up: remove queue from subscribers
            if event in self._subscribers:
                self._subscribers[event].discard(queue)

                # Remove event key if no more subscribers
                if not self._subscribers[event]:
                    del self._subscribers[event]
                    logger.info(f"No more subscribers for event: {event}, removed event")

            logger.info(f"Subscriber removed from event: {event}")

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
