"""WhatsApp sends counted against the BU's monthly allowance (plans/plan.md Step 6).

Every Meta call in sender.py and ew_sender.py goes through here, never straight to
`send_template`:

- `send_metered` — one message: reserve 1, send, give it back if Meta did not accept it.
- `send_reserved` — a message already reserved by the caller (a request that sends several
  messages reserves them all first, so it is refused whole instead of half-sent); gives it
  back if Meta did not accept it.
- `limit_result` — the result of a send refused at the limit; Meta is never called.

Kept apart from client.py so the Cloud API client stays free of database imports.
"""

from app.core.exceptions import AppMessages
from app.services.bu_usage import release_whatsapp, reserve_whatsapp
from app.whatsapp.client import WhatsappSendResult, send_template

WHATSAPP_LIMIT_REACHED = "WHATSAPP_LIMIT_REACHED"


def limit_result() -> WhatsappSendResult:
    """A send refused because the month's messages are used up."""
    return WhatsappSendResult(
        error_code=WHATSAPP_LIMIT_REACHED,
        error_message=AppMessages.WHATSAPP_LIMIT_REACHED,
        ok=False,
        permanent=True,
        provider_message_id=None,
    )


async def send_metered(db_name: str, schema: str, *args, **kwargs) -> WhatsappSendResult:
    """Reserve one message, then send it; refused without calling Meta at the limit."""
    if not await reserve_whatsapp(db_name, schema, 1):
        return limit_result()
    return await send_reserved(db_name, schema, *args, **kwargs)


async def send_reserved(db_name: str, schema: str, *args, **kwargs) -> WhatsappSendResult:
    """Send one message the caller already reserved; give it back when Meta did not accept
    it, including when the call raised."""
    try:
        result = await send_template(*args, **kwargs)
    except Exception:
        await release_whatsapp(db_name, schema, 1)
        raise
    if not result.ok:
        await release_whatsapp(db_name, schema, 1)
    return result
