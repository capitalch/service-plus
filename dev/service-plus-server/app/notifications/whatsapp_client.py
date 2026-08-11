"""Async client for the WhatsApp Cloud API (Meta) BSP.

One BSP means there's no need for a provider-registry abstraction — swapping to a
different BSP later means editing this one file, not redesigning a dispatch layer.
"""

import os
from dataclasses import dataclass

import httpx

from app.config import settings
from app.logger import logger
from app.notifications.whatsapp_templates import TemplateSpec

# Meta error codes that mean "don't bother retrying, the number or template itself
# is bad" — used only to shape the toast/error text, since there is no retry queue.
_PERMANENT_ERROR_CODES = {"131026"}
_PERMANENT_ERROR_PREFIXES = ("132",)


class WhatsappApiError(Exception):
    """Raised when a call to the BSP fails outright (e.g. media upload)."""

    def __init__(self, message: str, error_code: str | None = None):
        super().__init__(message)
        self.error_code = error_code


@dataclass
class WhatsappSendResult:
    """Outcome of a single `send_template` call."""

    ok: bool
    provider_message_id: str | None
    error_code: str | None
    error_message: str | None
    permanent: bool


def _is_permanent(error_code: str | None) -> bool:
    if error_code is None:
        return False
    return error_code in _PERMANENT_ERROR_CODES or error_code.startswith(_PERMANENT_ERROR_PREFIXES)


def _auth_headers() -> dict[str, str]:
    token = os.environ.get(settings.whatsapp_access_token_env, "")
    return {"Authorization": f"Bearer {token}"}


def _api_base() -> str:
    return f"{settings.whatsapp_base_url}/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}"


async def upload_media(pdf_bytes: bytes, filename: str) -> str:
    """POST to the BSP's media endpoint, return the resulting media id."""
    url = f"{_api_base()}/media"
    data = {"messaging_product": "whatsapp", "type": "application/pdf"}
    files = {"file": (filename, pdf_bytes, "application/pdf")}

    logger.info("Whatsapp upload_media → %s (filename=%s, %d bytes)", url, filename, len(pdf_bytes))
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=_auth_headers(), data=data, files=files)
            resp.raise_for_status()
            media_id = resp.json()["id"]
            logger.info("Whatsapp upload_media succeeded: media_id=%s", media_id)
            return media_id
    except httpx.HTTPStatusError as e:
        error = e.response.json().get("error", {}) if e.response.content else {}
        logger.error("Whatsapp upload_media failed %d: %s", e.response.status_code, error)
        raise WhatsappApiError(
            error.get("message", "WhatsApp media upload failed"), str(error.get("code", ""))
        ) from e
    except httpx.TimeoutException as e:
        logger.error("Whatsapp upload_media timed out: %s", e)
        raise WhatsappApiError("WhatsApp media upload timed out") from e
    except httpx.ConnectError as e:
        logger.error("Whatsapp upload_media unreachable: %s", e)
        raise WhatsappApiError("WhatsApp BSP unreachable") from e


async def send_template(
    to: str, template: TemplateSpec, params: list[str], media_id: str | None
) -> WhatsappSendResult:
    """POST a template message; media_id fills the document header when template.has_document."""
    url = f"{_api_base()}/messages"
    components = []
    if template.has_document:
        components.append(
            {"type": "header", "parameters": [{"type": "document", "document": {"id": media_id}}]}
        )
    components.append(
        {"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template.name,
            "language": {"code": template.language},
            "components": components,
        },
    }

    logger.info("Whatsapp send_template → %s (template=%s, to=%s)", url, template.name, to)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=_auth_headers(), json=payload)
            resp.raise_for_status()
            body = resp.json()
            message_id = body["messages"][0]["id"]
            logger.info("Whatsapp send_template succeeded: message_id=%s", message_id)
            return WhatsappSendResult(
                ok=True,
                provider_message_id=message_id,
                error_code=None,
                error_message=None,
                permanent=False,
            )
    except httpx.HTTPStatusError as e:
        error = e.response.json().get("error", {}) if e.response.content else {}
        error_code = str(error.get("code", "")) or None
        error_message = error.get("message", "WhatsApp send failed")
        logger.error("Whatsapp send_template failed %d: %s", e.response.status_code, error)
        return WhatsappSendResult(
            ok=False,
            provider_message_id=None,
            error_code=error_code,
            error_message=error_message,
            permanent=_is_permanent(error_code),
        )
    except httpx.TimeoutException as e:
        logger.error("Whatsapp send_template timed out: %s", e)
        return WhatsappSendResult(
            ok=False,
            provider_message_id=None,
            error_code=None,
            error_message="WhatsApp send timed out",
            permanent=False,
        )
    except httpx.ConnectError as e:
        logger.error("Whatsapp send_template unreachable: %s", e)
        return WhatsappSendResult(
            ok=False,
            provider_message_id=None,
            error_code=None,
            error_message="WhatsApp BSP unreachable",
            permanent=False,
        )
