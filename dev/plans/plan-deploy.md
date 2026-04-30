# Plan: Deploy File Server to Cloudjiffy Docker

## Architecture

```
Client Browser
     │
     ├─ http(s)://app-host:8000    → App Server (manual setup, python:3.14.3-slim-bookworm)
     │
     └─ http(s)://file-host:9000   → File Server (Docker container)
                                        └─ Volume: /data/uploads (persistent)
```

## Step 1: Production Dockerfile

**File:** `service-plus-file-server/Dockerfile`

- Base image: `python:3.14.3-slim-bookworm` (matches Cloudjiffy env)
- Pin dependency versions in `requirements.txt`
- Create `/data/uploads` directory for persistent storage
- Run uvicorn without reload for production

```dockerfile
FROM python:3.14.3-slim-bookworm

WORKDIR /app

RUN mkdir -p /data/uploads

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
```

## Step 2: Fix config.py for Docker

**File:** `service-plus-file-server/app/config.py`

The current `config.py` falls back to `.env` with a `Path(__file__)` resolution. In Docker there is no `.env` — all settings come from environment variables set in Cloudjiffy's dashboard. Keep the `env_file` fallback (it's harmless when `.env` is absent) but ensure `file_server_api_key` and `base_dir` are required env vars.

Current config is already correct — both fields are required with no defaults.

## Step 3: Pin Dependencies

**File:** `service-plus-file-server/requirements.txt`

```
fastapi==0.115.12
uvicorn[standard]==0.34.3
python-multipart==0.0.20
Pillow==11.2.1
pydantic-settings==2.9.1
```

## Step 4: Add .dockerignore

**File:** `service-plus-file-server/.dockerignore`

```
__pycache__
*.pyc
*.pyo
.env
*.egg-info
.git
.gitignore
env/
.venv/
*.egg
.pytest_cache
```

## Step 5: Persistent Volume in Cloudjiffy

**Critical:** Mount a Cloudjiffy persistent volume to `/data/uploads` inside the container.

Without this, all uploaded files are lost on container restart.

In Cloudjiffy Docker dashboard:
1. Go to your environment → File Server container → Volumes
2. Add a bind mount: host path → `/data/uploads`
3. Or use a Docker named volume if Cloudjiffy supports it

## Step 6: Environment Variables in Cloudjiffy

Set these in the Docker container's environment variables (Cloudjiffy dashboard → File Server → Environment Variables):

```
FILE_SERVER_API_KEY=5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6
BASE_DIR=/data/uploads
UPLOAD_MAX_SIZE_KB=100
```

## Step 7: Update App Server Config

Change `file_server_url` in app server's `.env` from:

```
FILE_SERVER_URL=http://localhost:9000
```

To the Cloudjiffy file server URL:

```
FILE_SERVER_URL=https://file-server-<env-name>.jelastic.cloud
```

Or if both containers are in the same Cloudjiffy environment, use the internal hostname:

```
FILE_SERVER_URL=http://file-server:9000
```

## Step 8: CORS Hardening (Optional)

**File:** `service-plus-file-server/app/main.py`

Change `allow_origins=["*"]` to only allow the app server's origin:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://<app-server-host>",
        "http://localhost:3000",  # dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Step 9: Build & Deploy

### Local build test

```bash
cd /home/sushant/projects/service-plus/dev/service-plus-file-server

# Build
docker build -t service-plus-file-server .

# Test locally
docker run -p 9000:9000 \
  -e FILE_SERVER_API_KEY=5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6 \
  -e BASE_DIR=/data/uploads \
  -v /tmp/test-uploads:/data/uploads \
  service-plus-file-server
```

### Push to Cloudjiffy

1. In Cloudjiffy, go to your environment → Docker
2. Click "Add Container" or "Deploy from Registry"
3. Push the image to Cloudjiffy's built-in Docker registry, or use a public registry
4. Set environment variables (Step 6)
5. Mount persistent volume (Step 5)
6. Deploy

### Verify deployment

```bash
# Test upload config endpoint
curl -H "X-API-Key: <your-key>" https://<file-server-host>/files/config

# Expected: {"upload_max_size_kb": 100}
```

## Key Risks

1. **Persistent storage misconfiguration** — most critical. Files lost on restart without a proper volume mount.
2. **Network connectivity** — app server and file server must be able to communicate. If they're in the same Cloudjiffy environment, use internal hostname. If not, use the public URL.
3. **API key sync** — both servers must use the same `FILE_SERVER_API_KEY`.

## File Changes Summary

| File | Action |
|------|--------|
| `service-plus-file-server/Dockerfile` | Update base image to 3.14.3-slim-bookworm |
| `service-plus-file-server/requirements.txt` | Pin versions |
| `service-plus-file-server/.dockerignore` | New file |
| `service-plus-server/.env` | Update `FILE_SERVER_URL` |
| `service-plus-file-server/app/main.py` | Optional: restrict CORS |
