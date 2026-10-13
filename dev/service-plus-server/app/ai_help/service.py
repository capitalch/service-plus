"""Ask AI: validate the request, pick the articles, call the provider, check limits."""

from importlib import import_module
from types import ModuleType

from app.ai_help import corpus, limits
from app.ai_help.errors import ProviderBusyError
from app.ai_help.prompt import INSTRUCTIONS
from app.ai_help.redact import redact
from app.config import settings
from app.core.exceptions import AppMessages, CodedValidationException
from app.logger import logger

MAX_ARTICLE_IDS = 6
MAX_HISTORY_TEXT = 2000
MAX_HISTORY_TURNS = 6
MAX_QUESTION = 500
ROLES = {"assistant", "user"}


def _invalid() -> CodedValidationException:
    return CodedValidationException(message=AppMessages.AI_HELP_INVALID_INPUT, code="AI_HELP_INVALID_INPUT")


def _parse(payload: dict) -> tuple[str, list[dict], list[str]]:
    """(question, history, article ids) from the decoded `value`, size-checked."""
    if not isinstance(payload, dict):
        raise _invalid()
    question = payload.get("question")
    history = payload.get("history") or []
    ids = payload.get("articleIds") or []
    if not isinstance(question, str) or not 1 <= len(question.strip()) <= MAX_QUESTION:
        raise _invalid()
    if not isinstance(history, list) or len(history) > MAX_HISTORY_TURNS:
        raise _invalid()
    for turn in history:
        if (
            not isinstance(turn, dict)
            or turn.get("role") not in ROLES
            or not isinstance(turn.get("text"), str)
            or len(turn["text"]) > MAX_HISTORY_TEXT
        ):
            raise _invalid()
    if not isinstance(ids, list) or len(ids) > MAX_ARTICLE_IDS or not all(isinstance(i, str) for i in ids):
        raise _invalid()
    return question.strip(), [{"role": t["role"], "text": t["text"]} for t in history], ids


def ai_help_enabled() -> bool:
    """True when the configured provider has its key — feeds aiHelpEnabled on buBillingStatus."""
    try:
        return _provider().configured()
    except ImportError:
        return False


def _not_covered() -> dict:
    return {"answer": "", "articleIds": [], "notCovered": True}


def _provider() -> ModuleType:
    return import_module(f"app.ai_help.providers.{settings.ai_help_provider}")


async def _generate(
    provider: ModuleType, instructions: str, articles_text: str, history: list[dict], question: str
) -> dict:
    """Main model, then the fallback model once if the main one is busy."""
    models = [m for m in (settings.ai_help_model, settings.ai_help_fallback_model) if m]
    for i, model in enumerate(models):
        try:
            return await provider.generate(model, instructions, articles_text, history, question)
        except ProviderBusyError as e:
            logger.warning("Ask AI busy: %s", e)
            if i == len(models) - 1:
                raise CodedValidationException(message=AppMessages.AI_HELP_BUSY, code="AI_HELP_BUSY") from e
    raise CodedValidationException(message=AppMessages.AI_HELP_BUSY, code="AI_HELP_BUSY")


async def ask_help_ai(db_name: str, schema: str, user_key: str, payload: dict, audience: str = "client") -> dict:
    """{answer, articleIds, notCovered}. Only answered questions count toward the limits.
    `audience` picks the articles and the prompt: "client" (staff) or "developer" (Super Admin)."""
    question, history, ids = _parse(payload)
    if not ai_help_enabled():
        raise CodedValidationException(message=AppMessages.AI_HELP_NOT_CONFIGURED, code="AI_HELP_UNAVAILABLE")
    limits.check(db_name, schema, user_key)

    ids = corpus.known_ids(ids, audience)
    if not ids:
        return _not_covered()

    try:
        result = await _generate(
            _provider(),
            INSTRUCTIONS[audience],
            corpus.render(ids, audience),
            [{**t, "text": redact(t["text"])} for t in history],
            redact(question),
        )
    except CodedValidationException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Ask AI failed: %s", e, exc_info=True)
        raise CodedValidationException(message=AppMessages.AI_HELP_UNAVAILABLE, code="AI_HELP_UNAVAILABLE") from e

    if not result["answer"]:
        return _not_covered()
    limits.record(db_name, schema, user_key)
    return {"answer": result["answer"], "articleIds": [i for i in result["articleIds"] if i in ids], "notCovered": False}
