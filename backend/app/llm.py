"""OpenRouter chat wrapper. Free models only; tries each configured model in order."""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

import httpx

from . import config
from .http import SSL_CONTEXT

log = logging.getLogger("kindlink.llm")

# Tried in order when LLM_MODEL is unset. Chosen by scripts/bench_llm.py (Oct 2026 free roster).
DEFAULT_MODELS = [
    "minimax/minimax-m3.1-flash:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free",  # router; can land on a weak model, so last
]


class LLMError(Exception):
    pass


def is_free(model: str) -> bool:
    return model.endswith(":free") or model == "openrouter/free"


def models() -> list[str]:
    chosen = [m for m in (config.LLM_MODELS or DEFAULT_MODELS) if is_free(m)]
    return chosen or DEFAULT_MODELS


_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=config.LLM_TIMEOUT_S, verify=SSL_CONTEXT)
    return _client


def extract_json(text: str) -> Any:
    """Parse the first JSON object/array in a model reply (handles ```json fences and chatter)."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.S)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    starts = [i for i in (text.find("{"), text.find("[")) if i >= 0]
    if not starts:
        raise LLMError("no JSON in reply")
    start = min(starts)
    opener = text[start]
    closer = "}" if opener == "{" else "]"
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise LLMError("unterminated JSON in reply")


# Models that recently returned 429 are skipped for a minute instead of being retried every call.
_cooldown: dict[str, float] = {}
COOLDOWN_S = 60.0
# Free models here are reasoning models: keep reasoning short and out of the content field.
REASONING = {"effort": "low", "exclude": True}
REASONING_HEADROOM = 800


async def _post(model: str, payload: dict[str, Any]) -> httpx.Response:
    return await _http().post(
        f"{config.OPENROUTER_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {config.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://github.com/kindlink",
            "X-Title": "KindLink",
        },
        json={"model": model, **payload},
    )


async def chat(system: str, user: str, *, max_tokens: int = 1500, temperature: float = 0.4,
               json_mode: bool = False, skip: set[str] | None = None) -> tuple[str, str]:
    """Returns (reply_text, model_used). Tries each free model in order."""
    if not config.OPENROUTER_API_KEY:
        raise LLMError("OPENROUTER_API_KEY is not configured")
    base = {
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "max_tokens": max_tokens + REASONING_HEADROOM,
        "temperature": temperature,
    }
    tuned = {**base, "reasoning": REASONING, **({"response_format": {"type": "json_object"}} if json_mode else {})}
    errors: list[str] = []
    candidates = [m for m in models() if m not in (skip or set())]
    for model in candidates:
        if _cooldown.get(model, 0) > time.monotonic() and model != candidates[-1]:
            errors.append(f"{model}: cooling down")
            continue
        t0 = time.monotonic()
        try:
            resp = await _post(model, tuned)
            if resp.status_code == 400:
                # Some endpoints reject the reasoning/response_format options; retry plain.
                resp = await _post(model, base)
        except httpx.HTTPError as exc:
            errors.append(f"{model}: {type(exc).__name__} after {time.monotonic() - t0:.0f}s")
            log.info("llm %s", errors[-1])
            continue
        if resp.status_code != 200:
            if resp.status_code == 429:
                _cooldown[model] = time.monotonic() + COOLDOWN_S
            errors.append(f"{model}: HTTP {resp.status_code}")
            log.info("llm %s", errors[-1])
            continue
        try:
            body = resp.json()
            text = body["choices"][0]["message"].get("content") or ""
        except (ValueError, KeyError, IndexError):
            errors.append(f"{model}: bad body")
            continue
        if text.strip():
            log.info("llm %s ok in %.1fs", model, time.monotonic() - t0)
            return text, model
        errors.append(f"{model}: empty")
        log.info("llm %s", errors[-1])
    log.warning("all LLM models failed: %s", "; ".join(errors))
    raise LLMError("; ".join(errors))


async def chat_json(system: str, user: str, *, max_tokens: int = 1500, temperature: float = 0.3) -> tuple[Any, str]:
    """Like chat() but parses JSON. A model that returns unparseable JSON is skipped for the retry."""
    last: Exception | None = None
    bad: set[str] = set()
    for _ in range(3):
        text, model = await chat(system + "\nReply with valid JSON only, no prose.", user,
                                 max_tokens=max_tokens, temperature=temperature, json_mode=True, skip=bad)
        try:
            return extract_json(text), model
        except (LLMError, json.JSONDecodeError) as exc:
            log.info("llm %s returned unparseable JSON: %s", model, exc)
            last = exc
            bad.add(model)
    raise LLMError(f"unparseable JSON: {last}")
