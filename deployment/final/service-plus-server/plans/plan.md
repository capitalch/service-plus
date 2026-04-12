## Nginx Configuration

### App routes

| Router | File | Routes |
|--------|------|--------|
| `base_router` | `app/routers/base_router.py` | `GET /`, `GET /health`, `POST /api/utils/test-email` |
| `auth_router` | `app/routers/auth_router.py` | `* /api/auth/...` |
| GraphQL | `app/graphql/` | `/graphql/` (+ WebSocket for subscriptions) |

### Issues fixed
1. **Missing WebSocket headers on `/graphql/`** — `app/graphql/resolvers/subscription.py` uses subscriptions over WebSocket. Without `proxy_http_version 1.1` and `Upgrade`/`Connection` headers the handshake fails.
2. **`/health` not proxied** — `base_router` defines `GET /health` in FastAPI, but the `location /` static-file block would intercept it and return `index.html` instead.
3. **Indentation** — `/graphql/` block had 2 extra leading spaces.

> `location /api/` is correct — `auth_router` uses prefix `/api/auth` and `base_router` has `/api/utils/test-email`.

### Corrected config

```nginx
server {
    listen 80;
    server_name _;

    # Serve React static files
    root /usr/share/nginx/html/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # Health check — proxy to FastAPI
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # REST API — proxy to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # GraphQL — WebSocket upgrade required for subscriptions
    location /graphql/ {
        proxy_pass http://127.0.0.1:8000/graphql/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
