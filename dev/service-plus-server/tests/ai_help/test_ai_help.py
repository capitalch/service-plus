"""Ask AI (app/ai_help/) — redaction, id filtering, busy fallback, limits. No network."""
import pytest

from app.ai_help import corpus, limits, service
from app.ai_help.errors import ProviderBusyError
from app.ai_help.redact import redact
from app.config import settings
from app.core.exceptions import CodedValidationException

KNOWN_ID = next(iter(corpus.articles_by_id()))


class FakeProvider:
    """Stands in for app.ai_help.providers.gemini."""

    def __init__(self, busy_models=(), answer="Open Jobs.", article_ids=None):
        self.answer = answer
        self.article_ids = article_ids if article_ids is not None else [KNOWN_ID]
        self.busy_models = set(busy_models)
        self.calls = []

    @staticmethod
    def configured():
        return True

    async def generate(self, model, instructions, articles_text, history, question):
        self.calls.append({"history": history, "model": model, "question": question})
        if model in self.busy_models:
            raise ProviderBusyError(model)
        return {"answer": self.answer, "articleIds": self.article_ids}


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    limits.reset()
    monkeypatch.setattr(settings, "ai_help_daily_limit_per_bu", 30)
    monkeypatch.setattr(settings, "ai_help_fallback_model", "fallback-model")
    monkeypatch.setattr(settings, "ai_help_model", "main-model")
    monkeypatch.setattr(settings, "ai_help_per_user_per_minute", 5)
    yield
    limits.reset()


def _use(monkeypatch, provider):
    monkeypatch.setattr(service, "_provider", lambda: provider)
    return provider


async def _ask(question="How do I deliver a job?", ids=None, history=None, user="u1"):
    payload = {"articleIds": ids if ids is not None else [KNOWN_ID], "history": history or [], "question": question}
    return await service.ask_help_ai("db", "demo1", user, payload)


# ── redaction ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "text,expected",
    [
        ("call 9876543210 now", "call [number] now"),
        ("call +91 98765-43210", "call [number]"),
        ("mail ram.k@example.co.in please", "mail [email] please"),
        ("job 1234567 is late", "job 1234567 is late"),
    ],
    ids=["mobile", "spaced-with-code", "email", "short-number-kept"],
)
def test_redact(text, expected):
    assert redact(text) == expected


async def test_question_and_history_are_redacted_before_sending(monkeypatch):
    fake = _use(monkeypatch, FakeProvider())
    await _ask("customer 9876543210 wants it", history=[{"role": "user", "text": "a@b.com"}])
    assert fake.calls[0]["question"] == "customer [number] wants it"
    assert fake.calls[0]["history"][0]["text"] == "[email]"


# ── ids ──────────────────────────────────────────────────────────────────────

async def test_unknown_ids_are_dropped_and_returned_ids_limited_to_sent(monkeypatch):
    _use(monkeypatch, FakeProvider(article_ids=[KNOWN_ID, "made-up-id"]))
    result = await _ask(ids=["no-such-article", KNOWN_ID])
    assert result["articleIds"] == [KNOWN_ID]


async def test_no_known_ids_means_not_covered_without_calling_the_model(monkeypatch):
    fake = _use(monkeypatch, FakeProvider())
    result = await _ask(ids=["no-such-article"])
    assert result["notCovered"] is True
    assert not fake.calls


@pytest.mark.parametrize(
    "payload",
    [
        {"question": ""},
        {"question": "x" * 501},
        {"history": [{"role": "system", "text": "hi"}], "question": "q"},
        {"articleIds": ["a"] * 7, "question": "q"},
    ],
    ids=["empty", "too-long", "bad-role", "too-many-ids"],
)
async def test_bad_input_is_refused(monkeypatch, payload):
    _use(monkeypatch, FakeProvider())
    with pytest.raises(CodedValidationException) as exc:
        await service.ask_help_ai("db", "demo1", "u1", payload)
    assert exc.value.code == "AI_HELP_INVALID_INPUT"


# ── busy → fallback → busy ───────────────────────────────────────────────────

async def test_busy_main_model_falls_back_once(monkeypatch):
    fake = _use(monkeypatch, FakeProvider(busy_models={"main-model"}))
    result = await _ask()
    assert result["answer"] == "Open Jobs."
    assert [c["model"] for c in fake.calls] == ["main-model", "fallback-model"]


async def test_both_models_busy_raises_busy_and_is_not_counted(monkeypatch):
    _use(monkeypatch, FakeProvider(busy_models={"main-model", "fallback-model"}))
    monkeypatch.setattr(settings, "ai_help_per_user_per_minute", 1)
    with pytest.raises(CodedValidationException) as exc:
        await _ask()
    assert exc.value.code == "AI_HELP_BUSY"
    limits.check("db", "demo1", "u1")  # the failed question used nothing


# ── limits ───────────────────────────────────────────────────────────────────

async def test_per_user_minute_limit(monkeypatch):
    _use(monkeypatch, FakeProvider())
    monkeypatch.setattr(settings, "ai_help_per_user_per_minute", 2)
    await _ask()
    await _ask()
    with pytest.raises(CodedValidationException) as exc:
        await _ask()
    assert exc.value.code == "AI_HELP_LIMIT_REACHED"
    await _ask(user="u2")  # another user is unaffected


async def test_per_bu_daily_limit(monkeypatch):
    _use(monkeypatch, FakeProvider())
    monkeypatch.setattr(settings, "ai_help_daily_limit_per_bu", 2)
    await _ask(user="u1")
    await _ask(user="u2")
    with pytest.raises(CodedValidationException) as exc:
        await _ask(user="u3")
    assert exc.value.code == "AI_HELP_LIMIT_REACHED"
