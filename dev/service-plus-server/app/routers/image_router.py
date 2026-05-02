"""REST endpoints for job image/document upload and delete — proxy to file server."""
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse


from app.config import settings
from app.core.dependencies import get_current_user
from app.db.psycopg_driver import exec_sql, exec_sql_object
from app.db.sql_store import SqlStore
from app.exceptions import DatabaseException
from app.logger import logger
from app.services.file_client import FileClient

router = APIRouter(prefix="/api/images", tags=["images"])

_file_client = FileClient(settings.file_server_url, settings.file_server_api_key)


def _file_server_error(e: Exception, operation: str) -> HTTPException:
    """Build an HTTPException from a file server call failure."""
    if isinstance(e, httpx.HTTPStatusError):
        logger.error(
            "File server %s error %d: %s",
            operation, e.response.status_code, e.response.text,
        )
        if e.response.status_code == 401:
            return HTTPException(
                status_code=500, detail="File server API key misconfiguration",
            )
        if e.response.status_code == 422:
            return HTTPException(status_code=422, detail=e.response.text)
        return HTTPException(status_code=502, detail="File server returned an error")
    if isinstance(e, httpx.ConnectError):
        logger.error(
            "File server %s failed — unreachable at %s: %s",
            operation, settings.file_server_url, e,
        )
        return HTTPException(
            status_code=502,
            detail=f"File server unreachable at {settings.file_server_url}",
        )
    if isinstance(e, httpx.TimeoutException):
        logger.error("File server %s timed out: %s", operation, e)
        return HTTPException(status_code=504, detail="File server timed out")
    logger.error("Unexpected error during file server %s: %s", operation, e)
    return HTTPException(
        status_code=500, detail="Internal error communicating with file server",
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
async def get_upload_config(_current_user: dict[str, Any] =
    Depends(get_current_user)) -> dict[str, Any]:
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
        client_code = job_data.get("client_code") if isinstance(job_data, dict) else job_data[1]
        bu_code = job_data.get("bu_code") if isinstance(job_data, dict) else job_data[2]
        branch_code = job_data.get("branch_code") if isinstance(job_data, dict) else job_data[3]

        try:
            await _file_client.delete_job_files(client_code, bu_code, branch_code, job_no)
            logger.info(
                "Deleted %d file(s) from file server for job %s",
                deleted_count, job_id,
            )
        except Exception as e:
            raise _file_server_error(e, "delete_job_files") from e

    return {"deleted": deleted_count}
