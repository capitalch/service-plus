# GraphQL Implementation Guide

This document explains the theory, implementation details, and practical usage of GraphQL in the `service-plus-client` codebase, utilizing the official documentation from Apollo Client (Context7) and the current project setup.

## 1. Theory: Apollo Client & GraphQL

**GraphQL** is a query language for your API that allows clients to request exactly the data they need, nothing more. It eliminates over-fetching and under-fetching of data common in traditional REST APIs. 

**Apollo Client** is the industry-standard GraphQL client for React. It manag

es data fetching, caching, and state management. When you fetch data with Apollo Client, it normalizes and stores the results in its local `InMemoryCache`. Subsequent requests for the same data are served almost instantly from the cache.

There are three primary types of GraphQL operations:
- **Queries (`useQuery`)**: For fetching data (similar to REST `GET`).
- **Mutations (`useMutation`)**: For modifying data (similar to REST `POST`, `PUT`, `DELETE`).
- **Subscriptions (`useSubscription`)**: For real-time updates pushed from the server to the client over WebSockets.

---

## 2. Codebase Implementation

### A. Apollo Client Setup (`src/lib/apollo-client.ts`)

The project uses a highly modern and comprehensive Apollo Client setup (v4+), supporting both standard HTTP requests and real-time WebSockets, while injecting authentication headers dynamically.

**Key Components:**
1. **HTTP Link (`HttpLink`)**: Connects to the primary GraphQL endpoint (`http://localhost:8000/graphql`) for processing Queries and Mutations.
2. **WebSocket Link (`GraphQLWsLink`)**: Connects via the `graphql-ws` protocol (`ws://localhost:8000/graphql`) for processing Subscriptions.
3. **Auth Middleware (`ApolloLink`)**: Automatically retrieves the `accessToken` from `localStorage` and attaches it as a `Bearer` token to the `Authorization` header of every outgoing HTTP request.
4. **Split Link (`ApolloLink.split`)**: An intelligent router that directs WebSockets (Subscriptions) to the `wsLink` and normal requests to the `httpLink` with the `authMiddleware`.
5. **Caching**: Uses `InMemoryCache()` to normalize and store server responses locally.

### B. GraphQL Code Generator (`codegen.ts`)

To ensure complete type safety, the project uses **GraphQL Code Generator** with the `@graphql-codegen/client-preset`.

**How it works:**
1. You write native GraphQL operations in `.graphql` files (e.g., `src/graphql/queries/generic.graphql`).
2. You run the codegen script (`pnpm run codegen`).
3. The codegen inspects the server schema (`http://localhost:8000/graphql`) and your local `.graphql` files.
4. It generates fully typed TypeScript definitions and utilities inside `src/graphql/generated/`.

---

## 3. Practical Examples & Usage

To use GraphQL in your React components, you will generally follow this pattern:
1. Define the operation in a `.graphql` file or directly inside your component using the generated `gql` tag.
2. Run `pnpm run codegen` (or leave `pnpm run codegen:watch` running).
3. Import the generated document and feed it to Apollo's hooks.

### Example 1: Executing a Query (Fetching Data)

Using Apollo's `useQuery` hook to fetch data.

```tsx
import React from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '../graphql/generated'; // Use the generated gql tag!

// 1. Define your query using the generated gql tag for full type inference
const GET_USER_PROFILE = gql(`
  query GetUserProfile($userId: ID!) {
    user(id: $userId) {
      id
      name
      email
    }
  }
`);

export const UserProfile = ({ userId }: { userId: string }) => {
  // 2. Pass the typed document to useQuery
  const { data, loading, error } = useQuery(GET_USER_PROFILE, {
    variables: { userId },
  });

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p>Error loading profile: {error.message}</p>;

  // data is fully typed!
  return (
    <div>
      <h2>{data?.user?.name}</h2>
      <p>{data?.user?.email}</p>
    </div>
  );
};
```

### Example 2: Executing a Mutation (Modifying Data)

Using Apollo's `useMutation` hook to update data on the server.

```tsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { gql } from '../graphql/generated';

const UPDATE_USER_EMAIL = gql(`
  mutation UpdateUserEmail($userId: ID!, $newEmail: String!) {
    updateUser(id: $userId, email: $newEmail) {
      id
      email
    }
  }
`);

export const EmailUpdater = ({ userId }: { userId: string }) => {
  const [email, setEmail] = useState('');
  
  // The hook returns the trigger function (updateEmail) and state (loading, error)
  const [updateEmail, { loading, error }] = useMutation(UPDATE_USER_EMAIL);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEmail({ 
        variables: { userId, newEmail: email } 
      });
      alert('Email updated!');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="New Email" 
      />
      <button type="submit" disabled={loading}>Update</button>
      {error && <p>Error: {error.message}</p>}
    </form>
  );
};
```

### Example 3: Subscriptions (Real-time updates)

Using Apollo's `useSubscription` hook to receive real-time events over WebSockets. Note that the project has already configured `GraphQLWsLink` for this to work natively.

```tsx
import React from 'react';
import { useSubscription } from '@apollo/client';
import { gql } from '../graphql/generated';

const USER_NOTIFICATION_SUB = gql(`
  subscription OnUserNotification($userId: ID!) {
    userNotificationAdded(userId: $userId) {
      id
      message
      createdAt
    }
  }
`);

export const NotificationsWidget = ({ userId }: { userId: string }) => {
  const { data, loading, error } = useSubscription(USER_NOTIFICATION_SUB, {
    variables: { userId },
  });

  if (loading) return <p>Listening for notifications...</p>;
  if (error) return <p>Error subscribing: {error.message}</p>;

  return (
    <div className="notification-toast">
      Latest Notification: {data?.userNotificationAdded?.message}
    </div>
  );
};
```

## 4. Best Practices Summary
- **Always use `gql` from `src/graphql/generated`**, avoid `gql` from `@apollo/client` to preserve TypeScript benefits.
- Use `pnpm run codegen:watch` during development to auto-generate types when you change `.graphql` documents.
- Rely on Apollo's caching. If a mutation changes data, ensure you return the `id` of the mutated object so Apollo can automatically update its cache without a refetch.
