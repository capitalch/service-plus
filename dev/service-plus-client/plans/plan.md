# Plan: Cleanup & Fix File Upload Hierarchy

## Context
The file upload hierarchy implementation (`{BASE_DIR}/{client_code}/{bu_code}/{branch_code}/{job_no_snake}/{filename}`) was partially completed. The upload is broken with a 422 error, dead code was left behind, file serving is not proxied, and the deployment file server is missing its `config.py`. Backward compatibility is not required.

---

## Root Cause of 422

Both servers use `files: list[UploadFile] | None = None` **without `File()`**. In FastAPI, when an endpoint mixes `Form()` fields with file uploads in a multipart request, the `File()` annotation is required for FastAPI to parse the upload part. Without it, `files` defaults to `None`, triggering the `"No files provided"` 422 guard.

---

## Issues & Fixes

### 1. Fix 422 — Add `File()` annotation (BLOCKING)

**`dev/service-plus-server/app/routers/image_router.py`** — line 5, 72:
```python
# Add to import:
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

# Change line 72:
files: list[UploadFile] | None = File(None),
```

**`deployment/file-server/service-plus-file-server/app/routers/files.py`** — line 8, 110 (and sync to `dev/service-plus-file-server/app/routers/files.py`):
```python
# Add to import:
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form, Header, status

# Change files parameter:
files: list[UploadFile] | None = File(None),
```

---

### 2. Fix Missing `config.py` in Deployment File Server

**CREATE: `deployment/file-server/service-plus-file-server/app/config.py`** — copy from `dev/service-plus-file-server/app/config.py`:
```python
"""File server configuration using Pydantic Settings."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class FileServerSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 9000
    file_server_api_key: str
    base_dir: str
    upload_max_size_kb: int = 100
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

file_settings = FileServerSettings()
```

Also verify a `.env` file exists alongside the deployment file server with `FILE_SERVER_API_KEY` and `BASE_DIR` set.

---

### 3. Remove Dead Code & Fix Filename Uniqueness

In **both** `files.py` (dev and deployment), the `_derive_stem()` function is called but its result (`stem`) is never used. Remove it and repurpose `epoch_ms` for filename uniqueness:

**Remove:**
```python
def _derive_stem(about: str, epoch_ms: int) -> str:  # DELETE entire function
    ...

# In upload_files, DELETE these two lines:
epoch_ms = int(time.time() * 1000)
stem = _derive_stem(about, epoch_ms)
```

**Keep `epoch_ms`, use it in filename** (prevents overwrite when same filename uploaded twice):
```python
epoch_ms = int(time.time() * 1000)

# For images (not compressed):
filename = f"{file_stem_snake}_{epoch_ms}{_get_image_ext(file.filename, content_type)}"

# For images (compressed to webp):
filename = f"{file_stem_snake}_{epoch_ms}.webp"

# For PDFs:
filename = f"{file_stem_snake}_{epoch_ms}.pdf"
```

---

### 4. Fix File Serving — Add Proxy Route in Main Server

The client constructs `${getApiBaseUrl()}/${file.url}` (e.g., `http://localhost:8000/uploads/…`) but the main server has no `/uploads/` route. Add a streaming proxy in **`image_router.py`** (under the existing `/api/images` prefix → full path: `/api/images/uploads/{path}`):

```python
from fastapi.responses import StreamingResponse

@router.get("/uploads/{path:path}")
async def serve_image_file(path: str) -> StreamingResponse:
    """Proxy file serving from file server. No auth required — paths are unguessable."""
    try:
        response = await _file_client.get_file(f"uploads/{path}")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="File not found")
        response.raise_for_status()
        content_type = response.headers.get("content-type", "application/octet-stream")
        return StreamingResponse(iter([response.content]), media_type=content_type)
    except Exception as e:
        raise _file_server_error(e, "serve_file") from e
```

No JWT `Depends` on this route — `<img>` and `<a>` tags in the browser don't send auth headers. Files are internal and paths are unguessable.

Update **`job-image-upload.tsx`** line 449:
```tsx
// Change from:
const fullUrl = `${getApiBaseUrl()}/${file.url}`;
// To:
const fullUrl = `${getApiBaseUrl()}/api/images/${file.url}`;
```

---

### 5. Fix `clientCode` — Empty String Causes Wrong Folder Structure

**Problem**: `LoginResponse` does not include `clientCode`. Client's `selectClientCode` falls back to `""`. The file server skips the client level → wrong folder. The delete operation fetches `client_code` from the `job` table → mismatch with upload path.

**Fix**: Add `client_code` to the server login response.
- `dev/service-plus-server/app/schemas/auth_schema.py` — add `client_code: str | None = Field(default=None, alias="clientCode")` to `LoginResponse`
- `dev/service-plus-server/app/routers/auth_router_helper.py` — fetch and return `client_code` from the clients table during login
- `dev/service-plus-client/src/lib/auth-service.ts` — add `clientCode?: string` to `LoginResponseType`
- `auth-slice.ts` already handles it (stores `user.clientCode` to localStorage in `setCredentials`; `selectClientCode` reads it)

If the clients table has no `code` column, use `db_name` as the client folder identifier (already available in login response).

---

## Files Modified Summary

| File | Action | Reason |
|------|--------|--------|
| `deployment/file-server/.../app/config.py` | CREATE | Deployment file server won't start without it |
| `deployment/file-server/.../app/routers/files.py` | MODIFY | Fix `File()`, remove dead code, add epoch_ms to filename |
| `dev/service-plus-file-server/app/routers/files.py` | MODIFY | Same fixes (keep in sync) |
| `dev/service-plus-server/app/routers/image_router.py` | MODIFY | Fix `File()`, add file serving proxy route |
| `dev/service-plus-client/src/features/client/components/jobs/single-job/job-image-upload.tsx` | MODIFY | Fix `fullUrl` to use `/api/images/${file.url}` |
| `dev/service-plus-server/app/schemas/auth_schema.py` | MODIFY | Add `client_code` to `LoginResponse` |
| `dev/service-plus-server/app/routers/auth_router_helper.py` | MODIFY | Return `client_code` in login helper |
| `dev/service-plus-client/src/lib/auth-service.ts` | MODIFY | Add `clientCode?` to `LoginResponseType` |

**No changes needed**: `file_client.py` (already correct; `get_file()` now used), `auth-slice.ts` (already handles `clientCode`), `image-service.ts` (already sends all hierarchy fields).

---

## Implementation Order

1. Create `config.py` for deployment file server
2. Fix `File()` + remove dead code + add epoch_ms to filename in both `files.py` — **fixes 422**
3. Fix `File()` in `image_router.py` + add file serving proxy route
4. Fix `fullUrl` in `job-image-upload.tsx`
5. Fix `clientCode` in server login response + client type

---

## Verification

1. Start dev file server: `uvicorn app.main:app --port 9000 --reload` (from `dev/service-plus-file-server/`)
2. Start main server: `uvicorn app.main:app --port 8000 --reload` (from `dev/service-plus-server/`)
3. Open a job → attach a file → confirm no 422
4. Confirm file stored at `{BASE_DIR}/{client_code}/{bu_code}/{branch_code}/{job_no_snake}/{name}_{epoch_ms}.ext`
5. Confirm uploaded thumbnails display (loads via `/api/images/uploads/…`)
6. Confirm delete removes the file from disk
7. Test both image (JPEG/PNG/WEBP) and PDF uploads
