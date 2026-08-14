"""REST endpoints for job image/document upload and delete — proxy to file server."""

from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse


from app.config import settings
from app.core.dependencies import get_current_user
from app.db.connection.psycopg_driver import exec_sql, exec_sql_object
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import DatabaseException
from app.logger import logger
from app.services.file_client import FileClient

router = APIRouter(prefix="/api/images", tags=["images"])

_file_server_url = settings.file_server_url
_file_client = FileClient(_file_server_url, settings.file_server_api_key)


def _file_server_error(e: Exception, operation: str) -> HTTPException:
    """Build an HTTPException from a file server call failure."""
    if isinstance(e, httpx.HTTPStatusError):
        logger.error(
            "File server %s error %d: %s",
            operation,
            e.response.status_code,
            e.response.text,
        )
        if e.response.status_code == 401:
            return HTTPException(
                status_code=500,
                detail="File server API key misconfiguration",
            )
        if e.response.status_code == 422:
            return HTTPException(status_code=422, detail=e.response.text)
        return HTTPException(status_code=502, detail="File server returned an error")
    if isinstance(e, httpx.ConnectError):
        logger.error(
            "File server %s failed — unreachable at %s: %s",
            operation,
            _file_server_url,
            e,
        )
        return HTTPException(
            status_code=502,
            detail=f"File server unreachable at {_file_server_url}",
        )
    if isinstance(e, httpx.TimeoutException):
        logger.error("File server %s timed out: %s", operation, e)
        return HTTPException(status_code=504, detail="File server timed out")
    logger.error("Unexpected error during file server %s: %s", operation, e)
    return HTTPException(
        status_code=500,
        detail="Internal error communicating with file server",
    )


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
    except HTTPException:
        raise
    except Exception as e:
        raise _file_server_error(e, "serve_file") from e


@router.get("/config")
async def get_upload_config(
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Get upload configuration from file server."""
    try:
        return await _file_client.get_config()
    except Exception as e:
        raise _file_server_error(e, "get_config") from e


@router.post("/upload")
async def upload_images(
    db_name: str = Form(...),
    schema: str = Form(...),
    job_id: int = Form(...),
    job_no: str = Form(...),
    client_code: str = Form(...),
    bu_code: str = Form(...),
    branch_code: str = Form(...),
    about: str = Form(...),
    files: list[UploadFile] | None = File(None),
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Upload files via file server, then store DB records."""
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

    form_data: dict[str, Any] = {
        "client_code": client_code,
        "bu_code": bu_code,
        "branch_code": branch_code,
        "job_no": job_no,
        "about": about.strip(),
    }

    try:
        file_server_results = await _file_client.upload(form_data, files)
    except Exception as e:
        raise _file_server_error(e, "upload") from e

    results: list[dict[str, Any]] = []
    for file_info in file_server_results:
        rel_url: str = file_info["url"]
        file_about: str = file_info["about"]

        sql_object: dict[str, Any] = {
            "tableName": "job_image_doc",
            "xData": {"job_id": job_id, "url": rel_url, "about": file_about},
        }
        try:
            record_id = await exec_sql_object(db_name, schema, sql_object)
            results.append({"id": record_id, "url": rel_url, "about": file_about})
            logger.info("Uploaded job file: job_no=%s url=%s", job_no, rel_url)
        except DatabaseException as e:
            logger.error("Failed to store DB record for url=%s: %s", rel_url, e)

    return results


@router.delete("/{db_name}/{schema}/{image_id}")
async def delete_image(
    db_name: str,
    schema: str,
    image_id: int,
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a single image: remove from file server, then from DB."""
    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.DELETE_JOB_IMAGE_DOC,
        sql_args={"id": image_id},
    )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image record not found",
        )

    url: str = rows[0]["url"] if isinstance(rows[0], dict) else rows[0][0]

    try:
        await _file_client.delete_by_url(url)
        logger.info("Deleted file from file server: %s", url)
    except Exception as e:
        raise _file_server_error(e, "delete") from e

    return {"deleted": image_id}


async def _resolve_spare_part_web_context(
    db_name: str, schema: str, spare_part_web_id: int
) -> dict[str, Any]:
    """Look up a spare_part_web row's branch_code + current image_urls, or 404."""
    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.GET_SPARE_PART_WEB_IMAGE_CONTEXT,
        sql_args={"id": spare_part_web_id},
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spare part not found",
        )
    return rows[0]


@router.post("/spare-part-web/upload")
async def upload_spare_part_web_images(
    db_name: str = Form(...),
    schema: str = Form(...),
    spare_part_web_id: int = Form(...),
    client_code: str = Form(...),
    bu_code: str = Form(...),
    files: list[UploadFile] | None = File(None),
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload photos for a web-catalogue part, appending to image_urls (§3c/§4)."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No files provided",
        )

    context = await _resolve_spare_part_web_context(db_name, schema, spare_part_web_id)
    branch_code = context["branch_code"]

    form_data: dict[str, Any] = {
        "client_code": client_code,
        "bu_code": bu_code,
        "branch_code": f"spare-part-web-{branch_code}",
        "job_no": str(spare_part_web_id),
        # spare_part_web photos have no per-image caption (§3c/§6b); the file server
        # requires a non-empty 'about' regardless, so a fixed, unused value is sent.
        "about": "spare-part-web-photo",
    }

    try:
        file_server_results = await _file_client.upload(form_data, files)
    except Exception as e:
        raise _file_server_error(e, "upload") from e

    urls = [file_info["url"] for file_info in file_server_results]

    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.APPEND_SPARE_PART_WEB_IMAGES,
        sql_args={"urls": urls, "id": spare_part_web_id},
    )
    logger.info(
        "Uploaded %d spare_part_web image(s): id=%s", len(urls), spare_part_web_id
    )
    return {"image_urls": rows[0]["image_urls"]}


@router.delete("/spare-part-web/{db_name}/{schema}/{spare_part_web_id}/image")
async def delete_spare_part_web_image(
    db_name: str,
    schema: str,
    spare_part_web_id: int,
    body: dict,
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a single web-catalogue part image, keyed by url (§3c/§4)."""
    url = body.get("url", "")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'url' is required",
        )

    try:
        await _file_client.delete_by_url(url)
    except Exception as e:
        raise _file_server_error(e, "delete") from e

    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.REMOVE_SPARE_PART_WEB_IMAGE,
        sql_args={"url": url, "id": spare_part_web_id},
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spare part not found",
        )

    logger.info("Deleted spare_part_web image: id=%s url=%s", spare_part_web_id, url)
    return {"image_urls": rows[0]["image_urls"]}


@router.put("/spare-part-web/{db_name}/{schema}/{spare_part_web_id}/order")
async def reorder_spare_part_web_images(
    db_name: str,
    schema: str,
    spare_part_web_id: int,
    body: dict,
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Persist a reordered gallery — a full-array write, validated as a permutation
    of the currently stored urls so a stale client can't inject or drop urls (§4)."""
    new_urls = body.get("image_urls")
    if not isinstance(new_urls, list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'image_urls' must be a list",
        )

    context = await _resolve_spare_part_web_context(db_name, schema, spare_part_web_id)
    current_urls: list[str] = context["image_urls"] or []

    if sorted(new_urls) != sorted(current_urls):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reordered list must be a permutation of the existing images",
        )

    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.SET_SPARE_PART_WEB_IMAGES,
        sql_args={"urls": new_urls, "id": spare_part_web_id},
    )
    return {"image_urls": rows[0]["image_urls"]}


@router.delete("/spare-part-web/{db_name}/{schema}/part/{spare_part_web_id}")
async def delete_spare_part_web_part_images(
    db_name: str,
    schema: str,
    spare_part_web_id: int,
    client_code: str,
    bu_code: str,
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete all photos for one part: empty image_urls, then wipe its file-server
    folder — mirrors delete_job_images. Called before the GraphQL row delete (§6a)
    so a removed part never strands its folder on disk."""
    context = await _resolve_spare_part_web_context(db_name, schema, spare_part_web_id)
    current_urls: list[str] = context["image_urls"] or []

    if not current_urls:
        return {"deleted": 0}

    await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.SET_SPARE_PART_WEB_IMAGES,
        sql_args={"urls": [], "id": spare_part_web_id},
    )

    branch_code = context["branch_code"]
    try:
        await _file_client.delete_job_files(
            client_code, bu_code, f"spare-part-web-{branch_code}", str(spare_part_web_id)
        )
        logger.info(
            "Deleted %d spare_part_web image(s) from file server: id=%s",
            len(current_urls),
            spare_part_web_id,
        )
    except Exception as e:
        raise _file_server_error(e, "delete_spare_part_web_part_images") from e

    return {"deleted": len(current_urls)}


@router.delete("/{db_name}/{schema}/job/{job_id}")
async def delete_job_images(
    db_name: str,
    schema: str,
    job_id: int,
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete all image/document files and DB records for a job."""
    deleted_rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.DELETE_JOB_IMAGE_DOCS_BY_JOB,
        sql_args={"job_id": job_id},
    )

    if not deleted_rows:
        return {"deleted": 0}

    deleted_count = len(deleted_rows)

    job_rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql="SELECT job_no, client_code, bu_code, branch_code FROM job WHERE id = %(job_id)s",
        sql_args={"job_id": job_id},
    )

    if job_rows:
        job_data = job_rows[0]
        job_no = job_data.get("job_no") if isinstance(job_data, dict) else job_data[0]
        client_code = (
            job_data.get("client_code") if isinstance(job_data, dict) else job_data[1]
        )
        bu_code = job_data.get("bu_code") if isinstance(job_data, dict) else job_data[2]
        branch_code = (
            job_data.get("branch_code") if isinstance(job_data, dict) else job_data[3]
        )

        try:
            await _file_client.delete_job_files(
                client_code, bu_code, branch_code, job_no
            )
            logger.info(
                "Deleted %d file(s) from file server for job %s",
                deleted_count,
                job_id,
            )
        except Exception as e:
            raise _file_server_error(e, "delete_job_files") from e

    return {"deleted": deleted_count}
