# Plan A — How GraphQL Is Being Used in This App

## Overview

The app uses **Apollo Client v4** for GraphQL with:
- **HTTP** for authenticated queries & mutations
- **WebSocket** for real-time subscriptions
- **graphql-codegen** for auto-generating TypeScript types from `.graphql` files

However, GraphQL is currently **wired up but not actively used** — all data comes from
dummy Redux state. This plan explains every layer of the setup and what needs to happen
to make it fully functional.

---

## Layer-by-Layer Breakdown

### Layer 1 — Apollo Client Setup (`src/lib/apollo-client.ts`)

This is the core configuration file. It creates a single `apolloClient` instance used
globally across the app.

```
                ┌─────────────────────────────────┐
                │        apolloClient              │
                │   (ApolloClient + InMemoryCache) │
                └──────────────┬──────────────────┘
                               │
                         splitLink (router)
                               │
             ┌─────────────────┴──────────────────┐
             │                                    │
       Is it a Subscription?              Is it Query / Mutation?
             │                                    │
          wsLink                      authLink → httpLink
    (WebSocket over ws://)         (HTTP POST with Bearer token)
```

**Key behaviors:**
- **`authLink`** — an Apollo "context link" that reads `accessToken` from `localStorage`
  and injects `Authorization: Bearer <token>` into every HTTP request header.
  This means **no explicit token passing needed** in individual queries.
- **`httpLink`** — sends all queries and mutations as HTTP POST to `VITE_GRAPHQL_URL`
  (default: `http://localhost:8000/graphql`)
- **`wsLink`** — opens a persistent WebSocket to `VITE_GRAPHQL_WS_URL`
  (default: `ws://localhost:8000/graphql`) for subscriptions. Token is passed via
  `connectionParams` at connection time.
- **`split()`** — the router. Inspects each operation at runtime:
  - `subscription` → routes to `wsLink`
  - `query` / `mutation` → routes to `authLink → httpLink`

---

### Layer 2 — Provider Wiring (`src/main.tsx`)

```tsx
<ApolloProvider client={apolloClient}>   // ← Makes apolloClient available via hooks
  <Provider store={store}>               // ← Redux
    <RouterProvider router={router} />
    <Toaster />
  </Provider>
</ApolloProvider>
```

`ApolloProvider` wraps the entire React tree. This means any component in the app can
call `useQuery`, `useMutation`, or `useSubscription` hooks directly — no prop drilling
of the client required.

---

### Layer 3 — GraphQL Operation Files (`src/graphql/`)

Currently two placeholder files exist:

**`graphql/queries/generic.graphql`**
```graphql
query GenericQuery($db_name: String!, $value: String!) {
    genericQuery(db_name: $db_name, value: $value)
}
```
This is a catch-all generic query that passes a database name and a value string to the
server. The server (FastAPI + Strawberry) returns a raw result. This acts as a proof-of-
concept before feature-specific queries are written.

**`graphql/subscriptions/generic.graphql`**
```graphql
subscription GenericSubscription($db_name: String!) {
    genericSubscription(db_name: $db_name)
}
```
A generic real-time subscription. When the server pushes data on `db_name`, this fires
automatically via the WebSocket connection.

---

### Layer 4 — Code Generation (`codegen.ts` + `pnpm codegen`)

The `codegen.ts` file configures `graphql-codegen`:

```ts
const config: CodegenConfig = {
    schema: process.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql',
    documents: ['src/graphql/**/*.graphql'],   // reads all .graphql files
    generates: {
        'src/graphql/generated/': {            // outputs here
            preset: 'client',                  // client-preset: best for typed hooks
            presetConfig: { gqlTagName: 'gql' },
        },
    },
    ignoreNoDocuments: true,
};
```

**What `pnpm codegen` does:**
1. Reads the live GraphQL schema from the server (`http://localhost:8000/graphql`)
2. Scans all `.graphql` files in `src/graphql/`
3. Auto-generates `src/graphql/generated/` containing:
   - Fully typed `DocumentNode` exports for each query/mutation/subscription
   - TypeScript types for all variables and return values
   - A `gql` tag helper

**What `pnpm codegen:watch` does:**
- Same as above, but re-runs automatically whenever any `.graphql` file changes.

---

### Layer 5 — How a Feature Would Use It (Not Yet Done)

Here is the pattern that should be followed when adding real GraphQL data to a feature:

#### Step A — Write the `.graphql` file inside the feature
```graphql
# src/features/super-admin/graphql/clients.graphql
query GetClients {
    clients {
        id
        name
        code
        is_active
        activeAdminCount
    }
}
```

#### Step B — Run codegen to generate types
```bash
pnpm codegen
```
This produces `src/graphql/generated/graphql.ts` with:
```ts
export const GetClientsDocument = gql`...`;
export type GetClientsQuery = { clients: Array<{ id: number; name: string; ... }> };
```

#### Step C — Use generated hook in the component
```tsx
import { useQuery } from '@apollo/client';
import { GetClientsDocument } from '@/graphql/generated/graphql';

export const ClientsPage = () => {
    const { data, loading, error } = useQuery(GetClientsDocument);
    // data is fully typed as GetClientsQuery
};
```

#### Step D — For authenticated queries
No extra code needed — `authLink` automatically injects the token from `localStorage`
into every HTTP request. The Apollo Client handles it transparently.

#### Step E — For subscriptions (WebSocket)
```tsx
import { useSubscription } from '@apollo/client';
import { GenericSubscriptionDocument } from '@/graphql/generated/graphql';

const { data } = useSubscription(GenericSubscriptionDocument, {
    variables: { db_name: 'service-plus' },
});
```
Apollo automatically routes this over WebSocket because of the `split()` router.

---

## Current Status Summary

| Concern | Status |
|---------|--------|
| Apollo Client setup | ✅ Fully configured (HTTP + WS + auth) |
| ApolloProvider in tree | ✅ Wraps entire app in `main.tsx` |
| `.graphql` files | ⚠️ Only 2 generic placeholders exist |
| `pnpm codegen` | ⚠️ Will generate types — but no feature queries written yet |
| `useQuery` / `useMutation` in components | ❌ Not used anywhere yet |
| `useSubscription` in components | ❌ Not used anywhere yet |
| All data currently comes from | ⚠️ Redux dummy state (`dummy-data.ts`) |

---

## What Needs to Happen Next

1. **Write feature-specific `.graphql` files** inside each feature's `graphql/` folder
   (e.g. `features/super-admin/graphql/clients.graphql`)
2. **Run `pnpm codegen`** to generate typed hooks and types
3. **Replace Redux dummy data** with real `useQuery` calls in components
4. **Store server data in Redux** (optional — Apollo's `InMemoryCache` can serve as the
   cache layer instead, reducing Redux state surface)
5. **Add subscriptions** where real-time server push is needed (e.g. live activity logs)

---

## Environment Variables Required

```env
VITE_GRAPHQL_URL=http://localhost:8000/graphql      # HTTP endpoint
VITE_GRAPHQL_WS_URL=ws://localhost:8000/graphql     # WebSocket endpoint
```
These should be in a `.env` file at the project root.
