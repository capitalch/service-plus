# Plan: GraphQL + Apollo Client Setup

## Context

- Server: FastAPI + Ariadne GraphQL at `http://localhost:8000/graphql` with WebSocket subscription support
- Auth token stored in Redux (`auth.token`) and `localStorage('accessToken')`
- Rule: authenticated API calls use GraphQL with `Authorization` header; unauthenticated calls (login, clients search, forgot password) keep using Axios
- Apollo Client with subscription support required
- GraphQL types must be generated via codegen

---

## Workflow

```
Step 1 – Install Apollo + codegen packages
         ↓
Step 2 – Create Apollo Client (src/lib/apollo-client.ts)
         ↓
Step 3 – Wrap app with ApolloProvider in main.tsx
         ↓
Step 4 – Setup codegen config (codegen.ts + package.json script)
         ↓
Step 5 – Create GraphQL folder structure with example documents
         ↓
Step 6 – Run codegen and verify build
```

---

## Steps

### Step 1 — Install packages

```bash
pnpm add @apollo/client graphql graphql-ws

pnpm add -D @graphql-codegen/cli @graphql-codegen/client-preset
```

| Package | Purpose |
|---------|---------|
| `@apollo/client` | Apollo Client core (queries, mutations, cache, `ApolloProvider`) |
| `graphql` | Peer dependency for Apollo and codegen |
| `graphql-ws` | WebSocket transport for GraphQL subscriptions |
| `@graphql-codegen/cli` | Codegen CLI runner |
| `@graphql-codegen/client-preset` | Generates typed hooks and fragment types |

---

### Step 2 — Create `src/lib/apollo-client.ts`

Sets up a split link: subscriptions go over WebSocket, queries/mutations go over HTTP. Both links attach the `Authorization` token from `localStorage`.

```ts
import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { createClient } from 'graphql-ws';

const GQL_HTTP_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql';
const GQL_WS_URL = import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:8000/graphql';

const getAuthToken = () => localStorage.getItem('accessToken');

const httpLink = new HttpLink({ uri: GQL_HTTP_URL });

const authLink = setContext((_, { headers }) => {
    const token = getAuthToken();
    return {
        headers: {
            ...headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };
});

const wsLink = new GraphQLWsLink(
    createClient({
        url: GQL_WS_URL,
        connectionParams: () => {
            const token = getAuthToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
        },
    })
);

const splitLink = split(
    ({ query }) => {
        const definition = getMainDefinition(query);
        return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
        );
    },
    wsLink,
    authLink.concat(httpLink)
);

export const apolloClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: splitLink,
});
```

Key design points:
- `authLink` dynamically reads `localStorage` on every request — stays in sync after login/logout without needing to recreate the client
- Subscriptions route through `wsLink` with `connectionParams` for auth
- HTTP queries/mutations route through `authLink → httpLink`
- `VITE_GRAPHQL_URL` and `VITE_GRAPHQL_WS_URL` env vars allow overriding per environment

---

### Step 3 — Wrap app with `ApolloProvider` in `src/main.tsx`

Import `apolloClient` and `ApolloProvider`, wrap the root `RouterProvider`:

```tsx
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/apollo-client';

// inside createRoot(...).render(...)
<ApolloProvider client={apolloClient}>
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
</ApolloProvider>
```

`ApolloProvider` wraps `Provider` (Redux) so that both are available to all components.

---

### Step 4 — Create `codegen.ts` and add script to `package.json`

**`codegen.ts`** (project root):

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    schema: process.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql',
    documents: ['src/graphql/**/*.graphql'],
    generates: {
        'src/graphql/generated/': {
            preset: 'client',
            presetConfig: {
                gqlTagName: 'gql',
            },
        },
    },
    ignoreNoDocuments: true,
};

export default config;
```

**Add to `package.json` scripts:**

```json
"codegen": "graphql-codegen --config codegen.ts",
"codegen:watch": "graphql-codegen --config codegen.ts --watch"
```

---

### Step 5 — Create GraphQL folder structure

```
src/graphql/
├── generated/          ← codegen output (do not edit manually)
├── mutations/          ← .graphql mutation documents
├── queries/            ← .graphql query documents
└── subscriptions/      ← .graphql subscription documents
```

Add a `.gitignore` entry (or keep generated files — team preference). Add an example query document to validate the pipeline:

**`src/graphql/queries/generic.graphql`:**

```graphql
query GenericQuery($db_name: String!, $value: String!) {
    genericQuery(db_name: $db_name, value: $value)
}
```

**`src/graphql/subscriptions/generic.graphql`:**

```graphql
subscription GenericSubscription($db_name: String!) {
    genericSubscription(db_name: $db_name)
}
```

---

### Step 6 — Run codegen and verify build

```bash
# Generate types (server must be running)
pnpm codegen

# Verify TypeScript + Vite build
pnpm build
```

Expected output:
- `src/graphql/generated/` contains `graphql.ts` and `gql.ts` with typed hooks and fragment types
- `pnpm build` exits with zero errors
- No unused import warnings
