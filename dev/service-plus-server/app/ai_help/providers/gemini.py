"""Gemini API provider for Ask AI (google-genai, async client)."""

import json

from google import genai
from google.genai import errors, types

from app.ai_help.errors import ProviderBusyError
from app.config import settings

BUSY_CODES = {429, 503}
RESPONSE_SCHEMA = {
    "properties": {"answer": {"type": "string"}, "articleIds": {"items": {"type": "string"}, "type": "array"}},
    "required": ["answer", "articleIds"],
    "type": "object",
}
TIMEOUT_MS = 30_000

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client  # pylint: disable=global-statement
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    return _client


def _contents(articles_text: str, history: list[dict], question: str) -> list[types.Content]:
    """Articles first, then the earlier turns, then the question."""
    contents = [
        types.Content(role="user", parts=[types.Part(text=f"<articles>\n{articles_text}\n</articles>")]),
        types.Content(role="model", parts=[types.Part(text='{"answer": "Ready.", "articleIds": []}')]),
    ]
    for turn in history:
        role = "model" if turn["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=turn["text"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=question)]))
    return contents


def configured() -> bool:
    """True when the API key is set."""
    return bool(settings.gemini_api_key)


async def generate(model: str, instructions: str, articles_text: str, history: list[dict], question: str) -> dict:
    """{answer, articleIds} from `model`; ProviderBusyError on 429/503, other errors as raised."""
    try:
        response = await _get_client().aio.models.generate_content(
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA,
                system_instruction=instructions,
                # LOW is the lowest level every free model accepts (gemini-3.8-flash rejects MINIMAL).
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
            ),
            contents=_contents(articles_text, history, question),
            model=model,
        )
    except errors.APIError as e:
        if e.code in BUSY_CODES:
            raise ProviderBusyError(f"{model}: {e.code} {e.status}") from e
        raise
    if not response.text:
        return {"answer": "", "articleIds": []}
    data = json.loads(response.text)
    return {"answer": str(data.get("answer") or "").strip(), "articleIds": list(data.get("articleIds") or [])}
