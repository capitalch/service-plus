"""
REST endpoints for job image/document upload and delete.
"""
import re
import time
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from PIL import Image
import io

from app.config import settings
from app.core.dependencies import get_current_user
from app.db.psycopg_driver import exec_sql, exec_sql_object
from app.db.sql_store import SqlStore
from app.logger import logger

router = APIRouter(prefix="/api/images", tags=["images"])

_MAX_BYTES = settings.upload_max_size_kb * 1024


@router.get("/config")
async def get_upload_config():
    """Get upload configuration."""
    return {
        "upload_max_size_kb": settings.upload_max_size_kb,
    }


def _derive_stem(about: str, epoch_ms: int) -> str:
    stem = re.sub(r"[^a-z0-9]", "_", about.strip().lower())
    stem = re.sub(r"_+", "_", stem).strip("_")
    return f"{stem}_{epoch_ms}"


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


@router.post("/upload")
async def upload_images(
    db_name: str = Form(...),
    schema: str = Form(...),
    job_id: int = Form(...),
    about: str = Form(...),
    files: List[UploadFile] = None,
    _current_user: dict = Depends(get_current_user),
):
    if not about.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="'about' is required")

    if not files:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No files provided")

    results = []
    epoch_ms = int(time.time() * 1000)
    stem = _derive_stem(about, epoch_ms)

    dest_dir = Path(settings.upload_base_dir) / db_name / "files" / str(job_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    for file in files:
        data = await file.read()
        content_type = file.content_type or ""

        if content_type.startswith("image/"):
            webp_data = _compress_to_webp(data)
            filename = f"{stem}.webp"
            dest_dir.joinpath(filename).write_bytes(webp_data)
            rel_url = f"uploads/{db_name}/files/{job_id}/{filename}"
        elif content_type == "application/pdf":
            if len(data) > _MAX_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"PDF exceeds {settings.upload_max_size_kb} KB limit",
                )
            filename = f"{stem}.pdf"
            dest_dir.joinpath(filename).write_bytes(data)
            rel_url = f"uploads/{db_name}/files/{job_id}/{filename}"
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {content_type}",
            )

        sql_object = {
            "tableName": "job_image_doc",
            "xData": {"job_id": job_id, "url": rel_url, "about": about.strip()},
        }
        record_id = await exec_sql_object(db_name, schema, sql_object)
        results.append({"id": record_id, "url": rel_url, "about": about.strip()})
        logger.info("Uploaded job file: job_id=%s url=%s", job_id, rel_url)

    return results


@router.delete("/{db_name}/{schema}/{image_id}")
async def delete_image(
    db_name: str,
    schema: str,
    image_id: int,
    _current_user: dict = Depends(get_current_user),
):
    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.DELETE_JOB_IMAGE_DOC,
        sql_args={"id": image_id},
    )

    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image record not found")

    url: str = rows[0]["url"] if isinstance(rows[0], dict) else rows[0][0]

    file_path = Path(url)
    if file_path.exists():
        file_path.unlink()
        logger.info("Deleted file: %s", file_path)

    return {"deleted": image_id}


@router.delete("/{db_name}/{schema}/job/{job_id}")
async def delete_job_images(
    db_name: str,
    schema: str,
    job_id: int,
    _current_user: dict = Depends(get_current_user),
):
    """Delete all image/document files and DB records for a job."""
    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.DELETE_JOB_IMAGE_DOCS_BY_JOB,
        sql_args={"job_id": job_id},
    )

    deleted_count = 0
    for row in rows:
        url: str = row["url"] if isinstance(row, dict) else row[1]
        file_path = Path(url)
        if file_path.exists():
            file_path.unlink()
            logger.info("Deleted job file: %s", file_path)
        deleted_count += 1

    return {"deleted": deleted_count}
