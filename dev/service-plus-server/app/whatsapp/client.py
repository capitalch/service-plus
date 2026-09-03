"""Async client for the WhatsApp Cloud API — direct with Meta, no BSP.

Sends only. No document/media upload — the three PDF-carrying flows (creation,
delivery, receipt) are deleted along with their document template branch. A
template's buttons (e.g. JOB_CREATION's two URL buttons) are plain links back to
this server, never a Meta-hosted document/media attachment.
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
    button_values: list[str] | None = None,
) -> WhatsappSendResult:
    """POST a template message: named-parameter header/body components, plus a
    positional-parameter button component per dynamic-URL button.

    Header/body use *named* parameters (`parameter_name` on every entry) — a named
    component rejects positional parameters and vice-versa, so order alone no
    longer binds a value to a slot there. Button URL parameters are the opposite:
    confirmed empirically (2026-08-30) against a real send where a `{{token}}`-named
    button variable was never substituted — Meta stored it as literal text and just
    appended the sent value after it, producing a broken double-barrelled URL. Only
    Meta's own positional `{{1}}` is recognized in a button's URL, so button
    parameters are sent *without* `parameter_name`, regardless of how header/body
    are named — the named/positional split is real, but it's per-component-type,
    not template-wide.

    `button_values` has one entry per `template.button_count`, in the same button
    order (index 0, 1, ...) — omit (or pass an empty list) for a template with no
    dynamic-URL buttons, like JOB_COMPLETION.

    `category="AUTHENTICATION"` templates (e.g. JOB_DELIVERY_OTP) are a third
    shape, not just a header/body variant: no header component at all (skipped
    below when `template.header_params` is empty, rather than sent with an
    empty parameter list — untested against Meta's API whether that would even
    be accepted), *positional* body parameters (no `parameter_name`) since
    Meta owns the body wording for this category and only accepts `{{1}}`-style
    substitution, and — if the approved template has one — a "Copy Code"
    button sent in the *URL* button shape: `sub_type="url"` with a plain
    `text`-typed parameter carrying the same code already sent in the body,
    ignoring `button_values` entirely (there's nothing else to copy).
    `button_values` (the URL-button list below) is meaningless for this
    category and is simply never consulted."""
    url = f"{_api_base()}/messages"
    is_positional_body = template.category == "AUTHENTICATION"
    components = []
    if template.header_params:
        components.append(
            {
                "type": "header",
                "parameters": [
                    {"type": "text", "parameter_name": name, "text": value}
                    for name, value in zip(template.header_params, header_values)
                ],
            }
        )
    components.append(
        {
            "type": "body",
            "parameters": (
                [{"type": "text", "text": value} for value in body_values]
                if is_positional_body
                else [
                    {"type": "text", "parameter_name": name, "text": value}
                    for name, value in zip(template.body_params, body_values)
                ]
            ),
        }
    )
    if template.category == "AUTHENTICATION":
        # "Copy Code" button, approved on JOB_DELIVERY_OTP (2026-09-02) — purely a
        # client-side clipboard convenience for the recipient, no callback to us.
        # Reuses the same code already sent as the body's one positional
        # parameter, never a separate `button_values` list — there's only ever
        # one thing to copy.
        #
        # Shipped broken until 2026-09-03: this sent `sub_type="copy_code"` with a
        # `coupon_code`-typed parameter — the *marketing* coupon-code button shape.
        # Meta rejected every OTP send, so only JOB_DELIVERY's Utility summary ever
        # reached the customer. The confusion is that `otp_type: COPY_CODE` is a
        # template-*creation* value: on creation Meta converts the button to type
        # URL, so a send must address it as a URL button — `sub_type="url"` with a
        # plain `text` parameter — exactly like the one-tap autofill variant. The
        # only thing authentication changes about a button is where its value comes
        # from (the body's code, not `button_values`), not its shape.
        for index in range(template.button_count):
            components.append(
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": str(index),
                    "parameters": [{"type": "text", "text": body_values[0]}],
                }
            )
    else:
        for index, value in enumerate(button_values or []):
            components.append(
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": str(index),
                    "parameters": [{"type": "text", "text": value}],
                }
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
