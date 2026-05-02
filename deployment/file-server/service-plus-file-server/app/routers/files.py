"""File server API endpoints with API key authentication."""
import io
import re
import time
from pathlib import Path

import mimetypes
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form, Header, status
from fastapi.responses import StreamingResponse
from PIL import Image

from app.config import file_settings

router = APIRouter(prefix="/files", tags=["files"])

_MAX_BYTES = file_settings.upload_max_size_kb * 1024
_BASE_DIR = Path(file_settings.base_dir)


def verify_api_key(x_api_key: str = Header(...)) -> str:
    """Validate the X-API-Key header."""
    if x_api_key != file_settings.file_server_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return x_api_key


def _to_snake_case(s: str) -> str:
    """Convert string to snake_case."""
    slug = re.sub(r"[^a-z0-9]", "_", s.lower())
    return re.sub(r"_+", "_", slug).strip("_")


def _get_image_ext(filename: str | None, content_type: str) -> str:
    """Derive file extension from filename or content type."""
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp"):
            return ext
    if "jpeg" in content_type or "jpg" in content_type:
        return ".jpg"
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    return ".jpg"


def _compress_to_webp(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    quality = 85
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality)

    if len(buf.getvalue()) <= _MAX_BYTES:
        return buf.getvalue()

    lo, hi = 50, 95
    while lo < hi:
        mid = (lo + hi) // 2
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=mid)
        if len(buf.getvalue()) <= _MAX_BYTES:
            lo = mid + 1
        else:
            hi = mid - 1

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=lo)
    return buf.getvalue()


def _resolve_path(rel_path: str) -> Path:
    """Resolve a relative path under BASE_DIR with traversal protection."""
    full = (_BASE_DIR / rel_path).resolve()
    try:
        full.relative_to(_BASE_DIR.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Path traversal detected",
        ) from exc
    return full


@router.get("/config")
async def get_config(_api_key: str = Depends(verify_api_key)) -> dict[str, int]:
    """Return upload configuration."""
    return {"upload_max_size_kb": file_settings.upload_max_size_kb}


@router.post("/upload")
async def upload_files(
    client_code: str = Form(...),
    bu_code: str = Form(...),
    branch_code: str = Form(...),
    job_no: str = Form(...),
    about: str = Form(...),
    files: list[UploadFile] | None = File(None),
    _api_key: str = Depends(verify_api_key),
) -> list[dict[str, str]]:
    """Upload files with hierarchical folder structure."""
    if not about.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'about' is required",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No files provided",
        )

    results: list[dict[str, str]] = []
    epoch_ms = int(time.time() * 1000)

    client_snake = _to_snake_case(client_code)
    bu_snake = _to_snake_case(bu_code)
    branch_snake = _to_snake_case(branch_code)
    job_no_snake = _to_snake_case(job_no)

    dest_dir = _BASE_DIR / client_snake / bu_snake / branch_snake / job_no_snake
    dest_dir.mkdir(parents=True, exist_ok=True)

    for file in files:
        data = await file.read()
        content_type = file.content_type or ""

        orig_stem = Path(file.filename).stem if file.filename else "file"
        file_stem_snake = _to_snake_case(orig_stem)
        if content_type.startswith("image/"):
            if len(data) <= _MAX_BYTES:
                filename = f"{file_stem_snake}_{epoch_ms}{_get_image_ext(file.filename, content_type)}"
                dest_dir.joinpath(filename).write_bytes(data)
            else:
                webp_data = _compress_to_webp(data)
                filename = f"{file_stem_snake}_{epoch_ms}.webp"
                dest_dir.joinpath(filename).write_bytes(webp_data)
            rel_url = f"uploads/{client_snake}/{bu_snake}/{branch_snake}/{job_no_snake}/{filename}"
        elif content_type == "application/pdf":
            if len(data) > _MAX_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"PDF exceeds {file_settings.upload_max_size_kb} KB limit",
                )
            filename = f"{file_stem_snake}_{epoch_ms}.pdf"
            dest_dir.joinpath(filename).write_bytes(data)
            rel_url = f"uploads/{client_snake}/{bu_snake}/{branch_snake}/{job_no_snake}/{filename}"
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {content_type}",
            )

        results.append({"url": rel_url, "about": about.strip()})

    return results


@router.delete("/by-url")
async def delete_by_url(
    body: dict,
    _api_key: str = Depends(verify_api_key),
) -> dict[str, bool]:
    """Delete a single file by its stored URL path."""
    url = body.get("url", "")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'url' is required",
        )

    relative = "/".join(url.split("/")[1:])
    file_path = _resolve_path(relative)

    if file_path.exists():
        file_path.unlink()

    return {"deleted": True}


@router.delete("/delete-job")
async def delete_job_files(
    client_code: str = Form(...),
    bu_code: str = Form(...),
    branch_code: str = Form(...),
    job_no: str = Form(...),
    _api_key: str = Depends(verify_api_key),
) -> dict[str, int]:
    """Delete all files in a job folder using hierarchy."""
    client_snake = _to_snake_case(client_code)
    bu_snake = _to_snake_case(bu_code)
    branch_snake = _to_snake_case(branch_code)
    job_no_snake = _to_snake_case(job_no)

    job_dir = _BASE_DIR / client_snake / bu_snake / branch_snake / job_no_snake
    resolved = _resolve_path(str(job_dir.relative_to(_BASE_DIR)))

    deleted_count = 0
    if resolved.exists() and resolved.is_dir():
        for file_path in resolved.iterdir():
            if file_path.is_file():
                file_path.unlink()
                deleted_count += 1

    return {"deleted": deleted_count}


@router.get("/uploads/{path:path}")
async def serve_file(path: str, _api_key: str = Depends(verify_api_key)) -> StreamingResponse:
    """Serve a file by its stored URL path."""
    relative = "/".join(path.split("/")[1:]) if path.startswith("uploads/") else path
    file_path = _resolve_path(relative)

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    content_type, _ = mimetypes.guess_type(str(file_path))
    if content_type is None:
        content_type = "application/octet-stream"

    return StreamingResponse(
        open(file_path, "rb"),
        media_type=content_type,
        headers={"Content-Disposition": f"inline; filename={file_path.name}"},
    )
