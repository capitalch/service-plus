"""Async HTTP client for communicating with the file server."""
from typing import Any

import httpx
from fastapi import UploadFile
from httpx import Response

from app.logger import logger


class FileClient:
    """Reusable async HTTP client for file server communication."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"X-API-Key": api_key}
        logger.info("FileClient initialized: base_url=%s", self.base_url)

    async def upload(
        self, form_data: dict[str, Any], files: list[UploadFile]
    ) -> list[dict[str, Any]]:
        """Upload files to the file server. Returns list of {url, about}."""
        file_list: list[tuple[str, tuple[str | None, bytes, str | None]]] = []
        for file_obj in files:
            content = await file_obj.read()
            logger.info(
                "Forwarding file to file server: name=%s, size=%d bytes, type=%s",
                file_obj.filename, len(content), file_obj.content_type,
            )
            file_list.append(
                ("files", (file_obj.filename, content, file_obj.content_type))
            )

        url = f"{self.base_url}/files/upload"
        logger.info(
            "FileClient upload → %s (form_data keys: %s, files: %d)",
            url, list(form_data.keys()), len(file_list),
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, headers=self.headers, data=form_data, files=file_list)
                logger.info("File server upload response: status=%d", resp.status_code)
                if resp.status_code >= 400:
                    logger.error("File server upload failed: %s", resp.text)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as e:
            logger.error("File server unreachable at %s: %s", self.base_url, e)
            raise
        except httpx.TimeoutException as e:
            logger.error("File server upload timed out: %s", e)
            raise
        except httpx.HTTPStatusError as e:
            logger.error("File server HTTP error %d: %s", e.response.status_code, e.response.text)
            raise
        except Exception as e:
            logger.error("Unexpected error uploading to file server: %s", e)
            raise

    async def delete_by_url(self, url: str) -> dict[str, Any]:
        """Delete a file on the file server by its stored URL path."""
        delete_url = f"{self.base_url}/files/by-url"
        logger.info("FileClient delete_by_url → %s url=%s", delete_url, url)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(
                    "DELETE",
                    delete_url,
                    headers={**self.headers, "Content-Type": "application/json"},
                    json={"url": url},
                )
                if resp.status_code == 404:
                    return {"deleted": True}
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as e:
            logger.error("File server unreachable for delete: %s", e)
            raise
        except httpx.TimeoutException as e:
            logger.error("File server delete timed out: %s", e)
            raise
        except httpx.HTTPStatusError as e:
            logger.error("File server HTTP error on delete %d: %s",
                e.response.status_code, e.response.text)
            raise

    async def delete_job_files(
        self, client_code: str, bu_code: str, branch_code: str, job_no: str
    ) -> dict[str, Any]:
        """Delete all files for a job on the file server using hierarchy."""
        url = f"{self.base_url}/files/delete-job"
        logger.info("FileClient delete_job_files → %s", url)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(
                    "DELETE",
                    url,
                    headers={**self.headers, "Content-Type": "application/x-www-form-urlencoded"},
                    data={
                        "client_code": client_code,
                        "bu_code": bu_code,
                        "branch_code": branch_code,
                        "job_no": job_no,
                    },
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as e:
            logger.error("File server unreachable for job delete: %s", e)
            raise
        except httpx.TimeoutException as e:
            logger.error("File server job delete timed out: %s", e)
            raise
        except httpx.HTTPStatusError as e:
            logger.error(
                "File server HTTP error on job delete %d: %s",
                e.response.status_code, e.response.text,
            )
            raise

    async def get_config(self) -> dict[str, Any]:
        """Get upload configuration from the file server."""
        url = f"{self.base_url}/files/config"
        logger.info("FileClient get_config → %s", url)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=self.headers)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as e:
            logger.error("File server unreachable for config: %s", e)
            raise
        except httpx.TimeoutException as e:
            logger.error("File server config timed out: %s", e)
            raise
        except httpx.HTTPStatusError as e:
            logger.error("File server HTTP error on config %d: %s",
                e.response.status_code, e.response.text)
            raise

    async def get_file(self, path: str) -> Response:
        """Get a file from the file server. Returns the raw Response for streaming."""
        url = f"{self.base_url}/files/{path}"
        logger.info("FileClient get_file → %s", url)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self.headers)
                logger.info("File server file response: status=%d", resp.status_code)
                return resp
        except httpx.ConnectError as e:
            logger.error("File server unreachable for file serve: %s", e)
            raise
        except httpx.TimeoutException as e:
            logger.error("File server file serve timed out: %s", e)
            raise
