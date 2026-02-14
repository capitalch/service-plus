# Plan: Implement GraphQL Subscriptions

## Step 1: Assess Current GraphQL Setup
- Read existing GraphQL schema files to understand current queries and mutations
- Identify the GraphQL server configuration (Ariadne setup with FastAPI)
- Check current resolver implementations
- Verify existing endpoints and application structure

## Step 2: Install Required Dependencies
- Verify/install `ariadne` with WebSocket support
- Install `websockets` library for WebSocket protocol support
- Install `starlette` (if not already present, as it provides WebSocket support for FastAPI)
- Update requirements.txt with new dependencies

## Step 3: Update GraphQL Schema
- Add `Subscription` type to the GraphQL schema file
- Define subscription fields relevant to service management:
  - `serviceUpdated(serviceId: ID)` - Subscribe to updates for a specific service
  - `newServiceRequest` - Subscribe to new service requests
  - `serviceStatusChanged(serviceId: ID)` - Subscribe to status changes
  - Other relevant real-time events
- Ensure schema includes subscription type alongside existing Query and Mutation types

## Step 4: Create Subscription Resolvers
- Create `/app/api/graphql/subscriptions.py` file
- Implement subscription resolver functions using async generators
- Create individual subscription handlers:
  - Service update subscription resolver
  - New service request subscription resolver
  - Status change subscription resolver
- Add error handling using custom exceptions
- Use logger for tracking subscription events

## Step 5: Implement Pub/Sub Mechanism
- Create `/app/core/pubsub.py` for event broadcasting
- Implement in-memory pub/sub system using asyncio queues or broadcast channels
- Create publisher functions to emit events
- Create subscriber functions to listen to events
- Implement proper event filtering based on subscription parameters

## Step 6: Configure WebSocket Endpoint
- Update `main.py` to add WebSocket route
- Import and configure Ariadne's `GraphQLWSHandler` for WebSocket support
- Create WebSocket endpoint at `/graphql/ws`
- Bind subscription resolvers to the executable schema
- Configure subscription context and connection initialization

## Step 7: Integrate Event Publishing
- Identify mutation points where events should be published
- Update mutation resolvers to publish events after successful operations
- Publish events for:
  - Service creation
  - Service updates
  - Status changes
  - Other relevant mutations
- Ensure events contain necessary data for subscribers

## Step 8: Add Error Handling and Logging
- Implement WebSocket connection error handling
- Add logging for subscription lifecycle events:
  - Connection established
  - Subscription started
  - Subscription stopped
  - Connection closed
- Use configured logger as per project best practices
- Handle disconnections and reconnections gracefully

## Step 9: Update Custom Messages Class
- Add subscription-related messages to `/app/core/messages.py`:
  - WebSocket connection messages
  - Subscription error messages
  - Event broadcasting messages
- Use these messages in subscription resolvers and error handlers

## Step 10: Testing
- Test WebSocket connection establishment
- Verify subscription triggers when mutations are executed
- Test multiple concurrent subscriptions from different clients
- Validate subscription filtering (e.g., serviceId parameter)
- Test error scenarios (invalid subscription, connection drops)
- Verify proper cleanup when subscriptions are closed

## Step 11: Documentation
- Document subscription schema and available subscriptions
- Add examples of subscription queries for clients
- Update API documentation with WebSocket endpoint details
- Document pub/sub event structure
- Add setup instructions for testing subscriptions
