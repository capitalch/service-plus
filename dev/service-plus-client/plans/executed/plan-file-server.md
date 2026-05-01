# Plan: Dedicated FastAPI File Server

## Problem
Files are stored on the app server's local filesystem (`dev/uploads/`). When the server changes or moves to production, file URLs break because they are served as static files from the same server and tied to the app server's hostname.

## Solution Architecture

```
Client (JWT auth) → App Server (image_router proxy) → File Server (API key auth) → Filesystem
```

The client's API endpoints remain **exactly the same**. The app server acts as a transparent gateway — clients never know about the file server.

---

## 1. New File Server (`service-plus-file-server/`)

### Directory Structure
```
service-plus-file-server/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI entry point + CORS
│   ├── config.py            # Settings: API key, BASE_DIR, port
│   └── routers/
│       └── files.py         # Upload, delete, serve, config endpoints
├── .env                     # FILE_SERVER_API_KEY, BASE_DIR, PORT, etc.
├── requirements.txt         # fastapi, uvicorn, python-multipart, pillow
└── Dockerfile               # Optional, for containerized deployment
```

### Configuration (`app/config.py`)
```python
class FileServerSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 9000
    file_server_api_key: str          # Fixed secret, shared with app server
    base_dir: str                     # Absolute path: e.g. /data/service-plus-files
    upload_max_size_kb: int = 100     # Max upload size in KB

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")
```

### Endpoints (prefix: `/files`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/files/config` | Return `{upload_max_size_kb}` | `X-API-Key` |
| `POST` | `/files/upload` | Upload one or more files (multipart form) | `X-API-Key` |
| `DELETE` | `/files/by-url` | Delete single file by stored URL path | `X-API-Key` |
| `DELETE` | `/files/{db_name}/job/{job_no}` | Delete all files in job folder | `X-API-Key` |
| `GET` | `/files/uploads/{path:path}` | Serve a file by its stored URL path | `X-API-Key` |

### Request/Response Contracts

#### `GET /files/config`
```json
{ "upload_max_size_kb": 100 }
```

#### `POST /files/upload`
```
// Multipart form fields:
//   db_name: string
//   job_id: int
//   job_no: string
//   about: string
//   files: File[]

// Response
[
  { "url": "uploads/db1/files/job-123/about_text_1743210000000.webp", "about": "..." }
]
```
- The file server does **not** assign DB IDs — only returns `url` and `about`.
- Images auto-compressed to WebP via Pillow (existing logic from `image_router.py` moves here).
- PDFs stored as-is with size validation.
- File naming: `{sanitized_about}_{epoch_ms}.{webp|pdf}` in `{BASE_DIR}/{db_name}/files/{safe_job_no}/`.

#### `DELETE /files/by-url`
```json
// Request body
{ "url": "uploads/db1/files/job-123/photo.webp" }

// Response
{ "deleted": true }
```

#### `DELETE /files/{db_name}/job/{job_no}`
- Deletes all files in the job folder.
```json
{ "deleted": 5 }
```

#### `GET /files/uploads/{path:path}`
- Streams the file at `{BASE_DIR}/uploads/{path}` with correct `Content-Type`.
- 404 if file doesn't exist.
- Path traversal protection: resolved path must stay within `BASE_DIR`.

### Security
- All endpoints require `X-API-Key` header matching `settings.file_server_api_key`.
- No public endpoints — only app server communicates with it.
- Path traversal protection: validate resolved paths stay within `BASE_DIR`.

---

## 2. App Server Changes (`service-plus-server/`)

### 2a. `app/config.py` — Add new fields
```python
# File Server Settings
file_server_url: str = Field(default="http://localhost:9000")
file_server_api_key: str = Field(default="")
```

### 2b. New service: `app/services/file_client.py`
Reusable async HTTP client for file server communication:
```python
class FileClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"X-API-Key": api_key}

    async def upload(self, form_data: dict, files: list) -> list[dict]
    async def delete_by_url(self, url: str) -> dict
    async def delete_job_files(self, db_name: str, job_no: str) -> dict
    async def get_config(self) -> dict
    async def get_file(self, path: str) -> Response
```

### 2c. `app/routers/image_router.py` — Rewrite as proxy layer

Keeps the **same external endpoints**. Internally proxies to file server.

#### Upload: `POST /api/images/upload`
```
1. Client → App server (JWT validated via get_current_user)
2. App server → File server POST {file_server_url}/files/upload
   Headers: X-API-Key
   Body: multipart form with db_name, job_id, job_no, about, files
3. File server saves file, returns [{url, about}]
4. App server INSERT into job_image_doc table → gets record id
5. App server returns [{id, url, about}] to client
```

#### Delete Single: `DELETE /api/images/{db_name}/{schema}/{image_id}`
```
1. Client → App server (JWT validated)
2. App server queries DB for the url of image_id
3. App server → File server DELETE {file_server_url}/files/by-url
   Headers: X-API-Key, Content-Type: application/json
   Body: { "url": "uploads/..." }
4. File server deletes file from disk
5. App server DELETE from job_image_doc table
6. Return { "deleted": image_id }
```

#### Delete All for Job: `DELETE /api/images/{db_name}/{schema}/job/{job_id}`
```
1. Client → App server (JWT validated)
2. App server queries DB for all urls + job_no for job_id
3. App server → File server DELETE {file_server_url}/files/{db_name}/job/{job_no}
4. App server DELETE all job_image_doc records for job_id
5. Return { "deleted": count }
```

#### Config: `GET /api/images/config`
```
1. Client → App server (JWT validated)
2. App server → File server GET {file_server_url}/files/config
   Headers: X-API-Key
3. Return response to client
```

### 2d. Replace StaticFiles mount with proxy route in `app/main.py`

**Remove:**
```python
app.mount("/uploads", StaticFiles(directory=str(_upload_root)), name="uploads")
```

**Add:** A catch-all proxy route in `image_router.py` (or a dedicated mount):
```python
@router.get("/uploads/{path:path}")
async def serve_uploads(path: str, _user: dict = Depends(get_current_user)):
    """Proxy file serve requests to the file server."""
    # Calls FileClient.get_file(f"uploads/{path}")
    # Returns StreamingResponse with correct Content-Type
```

This ensures existing file URLs (`/uploads/db1/files/...`) continue to work with **zero client changes**.

### 2e. Add `httpx` dependency
Add to requirements: `httpx>=0.27.0`

---

## 3. Client Changes (`service-plus-client/`)

**No changes required.**

File URLs in the DB follow pattern `uploads/{db_name}/files/{job_no}/{filename}`.
The client constructs: `${getApiBaseUrl()}/${file.url}`.
The app server's proxy route handles `/uploads/...` → file server forwarding.

All endpoints remain unchanged:
- Upload: `POST /api/images/upload`
- Delete single: `DELETE /api/images/{db}/{schema}/{id}`
- Delete all: `DELETE /api/images/{db}/{schema}/job/{job_id}`
- Config: `GET /api/images/config`
- File serve: `GET /uploads/{path}` (proxied)

---

## 4. File Storage Layout

```
{BASE_DIR}/
└── {db_name}/
    └── files/
        └── {safe_job_no}/
            ├── {about}_{timestamp}.webp
            ├── {about}_{timestamp}.pdf
            └── ...
```

Example:
```
/data/service-plus-files/
└── demo1/
    └── files/
        └── job_1234/
            ├── front_panel_damage_1743210000000.webp
            ├── serial_number_1743210001000.webp
            └── warranty_card_1743210002000.pdf
```

DB `url` field: `uploads/demo1/files/job_1234/front_panel_damage_1743210000000.webp`

---

## 5. Migration Strategy

### Phase 1: Deploy File Server
1. Create `service-plus-file-server/` with all endpoints
2. Set `BASE_DIR` to point to existing uploads directory (`dev/uploads/` or production equivalent)
3. Generate `FILE_SERVER_API_KEY` via `secrets.token_hex(32)`
4. Start file server on port 9000

### Phase 2: Update App Server
1. Add `file_server_url` and `file_server_api_key` to app server `.env`
2. Implement `FileClient` service
3. Rewrite `image_router.py` to proxy through `FileClient`
4. Replace `StaticFiles` mount with proxy route for `/uploads/...`
5. Add `httpx` dependency
6. Test locally: upload, delete, bulk delete, serve, config

### Phase 3: Verify & Switch Over
1. Deploy updated app server alongside file server
2. Verify existing jobs' files still load (backward compatible URLs)
3. Test new uploads and deletions
4. Remove old static file mount code entirely

### Phase 4: Cleanup
1. Remove `upload_base_dir` from app server config (no longer needed)
2. Document file server setup for production deployment
3. Add health check endpoint to file server

---

## 6. Error Handling

| Scenario | App Server Response | Notes |
|----------|-------------------|-------|
| File server unreachable | `502 Bad Gateway` | Log error, user-friendly message |
| File server returns 401 | `500 Internal Error` | API key misconfiguration |
| File server returns 404 on delete | `200 OK` | File already gone, DB still cleaned |
| File server returns 404 on serve | `404 Not Found` | File missing from disk |
| Upload exceeds size limit | `422 Unprocessable Entity` | Passed through from file server |

---

## 7. Environment Variables

### File Server (`.env`)
```env
HOST=0.0.0.0
PORT=9000
FILE_SERVER_API_KEY=<32-byte-hex-secret>
BASE_DIR=/data/service-plus-files
UPLOAD_MAX_SIZE_KB=100
```

### App Server (`.env` — additions)
```env
FILE_SERVER_URL=http://localhost:9000
FILE_SERVER_API_KEY=<same-key-as-file-server>
```

---

## 8. Files to Create/Modify

### Create
- `service-plus-file-server/app/__init__.py`
- `service-plus-file-server/app/main.py`
- `service-plus-file-server/app/config.py`
- `service-plus-file-server/app/routers/__init__.py`
- `service-plus-file-server/app/routers/files.py`
- `service-plus-file-server/.env`
- `service-plus-file-server/requirements.txt`
- `service-plus-file-server/Dockerfile` (optional)
- `service-plus-server/app/services/__init__.py`
- `service-plus-server/app/services/file_client.py`

### Modify
- `service-plus-server/app/config.py` — add `file_server_url`, `file_server_api_key`
- `service-plus-server/app/routers/image_router.py` — rewrite as proxy layer
- `service-plus-server/app/main.py` — replace StaticFiles mount, add health check
- `service-plus-server/requirements.txt` — add `httpx`
