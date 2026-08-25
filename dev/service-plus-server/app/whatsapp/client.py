"""Async client for the WhatsApp Cloud API — direct with Meta, no BSP.

Sends only. No document/media upload — the three PDF-carrying flows (creation,
delivery, receipt) are deleted along with their document template branch; the one
surviving template (JOB_COMPLETION) is text-only.
"""

from dataclasses import dataclass

import httpx

from app.config import settings
from app.logger import logger
from app.whatsapp.templates import TemplateSpec

# Meta error codes that mean "don't bother retrying, the number or template itself
# is bad" — used only to shape the toast/error text, since there is no retry queue.
_PERMANENT_ERROR_CODES = {"131026"}
_PERMANENT_ERROR_PREFIXES = ("132",)


class WhatsappApiError(Exception):
    """Raised when a call to the Cloud API fails outright."""

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
    return {"Authorization": f"Bearer {settings.whatsapp_access_token}"}


def _api_base() -> str:
    return f"{settings.whatsapp_base_url}/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}"


async def send_template(
    to: str,
    template: TemplateSpec,
    header_values: list[str],
    body_values: list[str],
    biz_opaque_callback_data: str,
) -> WhatsappSendResult:
    """POST a named-parameter template message with two components (header, body) —
    a named template rejects positional parameters and vice-versa, so every parameter
    entry carries `parameter_name`, and order no longer binds a value to a slot."""
    url = f"{_api_base()}/messages"
    components = [
        {
            "type": "header",
            "parameters": [
                {"type": "text", "parameter_name": name, "text": value}
                for name, value in zip(template.header_params, header_values)
            ],
        },
        {
            "type": "body",
            "parameters": [
                {"type": "text", "parameter_name": name, "text": value}
                for name, value in zip(template.body_params, body_values)
            ],
        },
    ]
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template.name,
            "language": {"code": template.language},
            "components": components,
        },
        "biz_opaque_callback_data": biz_opaque_callback_data,
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
            error_message="WhatsApp Cloud API unreachable",
            permanent=False,
        )
