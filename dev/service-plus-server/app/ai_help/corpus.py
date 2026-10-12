"""The Help articles exported from the client (`pnpm export-help` → help_articles.json),
loaded once and rendered as plain text for the prompt."""

import json
from functools import lru_cache
from pathlib import Path

from app.logger import logger

ARTICLES_FILE = Path(__file__).with_name("help_articles.json")


def _render_article(article: dict) -> str:
    """One article as plain text inside an <article> tag the model can cite by id."""
    lines = [f'<article id="{article["id"]}" title="{article["title"]}">', article.get("summary", "")]
    for block in article.get("content", []):
        kind = block.get("type")
        if kind == "heading":
            lines.append(f"## {block['text']}")
        elif kind == "steps":
            lines.extend(f"{i}. {item}" for i, item in enumerate(block["items"], start=1))
        elif kind == "bullets":
            lines.extend(f"- {item}" for item in block["items"])
        elif kind == "table":
            lines.append(" | ".join(block["headers"]))
            lines.extend(" | ".join(row) for row in block["rows"])
        elif kind == "note":
            lines.append(f"Note: {block['text']}")
        elif kind == "warning":
            lines.append(f"Warning: {block['text']}")
        else:
            lines.append(block.get("text", ""))
    faqs = article.get("faqs") or []
    if faqs:
        lines.append("## FAQ")
        for faq in faqs:
            lines.append(f"Q: {faq['q']}")
            lines.append(f"A: {faq['a']}")
    lines.append("</article>")
    return "\n".join(line for line in lines if line)


@lru_cache(maxsize=1)
def articles_by_id() -> dict[str, dict]:
    """Every exported article by id; empty (and logged) when the export is missing."""
    try:
        articles = json.loads(ARTICLES_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        logger.error("Ask AI: cannot read %s: %s", ARTICLES_FILE, e)
        return {}
    return {a["id"]: a for a in articles}


def known_ids(ids: list[str]) -> list[str]:
    """The ids that exist, in the given order, without duplicates."""
    corpus = articles_by_id()
    return [i for i in dict.fromkeys(ids) if i in corpus]


def render(ids: list[str]) -> str:
    """The chosen articles as one text block."""
    corpus = articles_by_id()
    return "\n\n".join(_render_article(corpus[i]) for i in ids if i in corpus)
