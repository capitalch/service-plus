# Plan: Dynamic Host URL Based on Environment

## Context
Currently, the Apollo GraphQL client (`apollo-client.ts`) and the Axios REST client (`auth-service.ts`) both fall back to hardcoded `localhost:8000` URLs. In production this causes all API calls to fail. The fix uses `import.meta.env.DEV` (Vite build-time flag) to branch:
- **Dev**: read the backend URL from `VITE_API_BASE_URL` in `.env` (no hardcoding in source)
- **Prod**: derive the URL dynamically from `window.location.origin` (no env var needed)

---

## Workflow

1. Keep `VITE_API_BASE_URL=http://localhost:8000` in `.env` — single source of truth for dev backend URL.
2. Add shared `getApiBaseUrl()` to `src/lib/utils.ts` — one place for the dev/prod branching logic.
3. `apollo-client.ts` imports `getApiBaseUrl()` and uses it inside local `getGqlHttpUrl()` / `getGqlWsUrl()`.
4. `auth-service.ts` imports `getApiBaseUrl()` and uses it directly for the Axios `baseURL`.

---

## Steps

### Step 1 — `.env` (no change needed)

`VITE_API_BASE_URL=http://localhost:8000` already present. No new vars required.

### Step 2 — Add `getApiBaseUrl()` to `src/lib/utils.ts`

```ts
export function getApiBaseUrl(): string {
  return import.meta.env.DEV
    ? (import.meta.env.VITE_API_BASE_URL as string)
    : window.location.origin;
}
```

Resolution:
- **Dev**: value of `VITE_API_BASE_URL` from `.env` (e.g. `http://localhost:8000`)
- **Prod**: `window.location.origin` (e.g. `https://yourdomain.com`)

### Step 3 — Update `src/lib/apollo-client.ts`

Import `getApiBaseUrl` from `./utils`. Replace the two static constants:
```ts
const GQL_HTTP_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql';
const GQL_WS_URL  = import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:8000/graphql';
```

With two local functions:
```ts
function getGqlHttpUrl(): string {
  return `${getApiBaseUrl()}/graphql`;
}

function getGqlWsUrl(): string {
  return getApiBaseUrl().replace(/^http/, 'ws') + '/graphql';
}
```

Update usages:
- `HttpLink`: `uri: getGqlHttpUrl()`
- `createClient`: `url: getGqlWsUrl()`

Resolution:
- **Dev**: `http://localhost:8000/graphql` / `ws://localhost:8000/graphql`
- **Prod HTTPS**: `https://yourdomain.com/graphql` / `wss://yourdomain.com/graphql`

### Step 4 — Update `src/lib/auth-service.ts`

Import `getApiBaseUrl` from `./utils`. Remove the existing local `getApiBaseUrl` function and update the axios instance:
```ts
const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});
```

---

## Critical Files

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add shared `getApiBaseUrl()` |
| `src/lib/apollo-client.ts` | Import `getApiBaseUrl`; replace static URL constants with `getGqlHttpUrl()` / `getGqlWsUrl()` |
| `src/lib/auth-service.ts` | Import `getApiBaseUrl`; remove local function, use imported one |

---

## Verification

1. **Dev**: Run `pnpm dev`, open `http://localhost:3000`. Confirm GraphQL calls target `http://localhost:8000/graphql` in the Network tab.
2. **Prod build**: Deploy. Confirm GraphQL and REST calls target the production origin (not localhost).
3. **WebSocket**: On any page using a GraphQL subscription, confirm the WS connection goes to the correct host.
