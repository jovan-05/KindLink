"""Quick latency/JSON-validity check of free OpenRouter models. Usage: python scripts/bench_llm.py [model ...]"""
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, llm  # noqa: E402

CANDIDATES = sys.argv[1:] or [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "minimax/minimax-m3.1-flash:free",
    "thinkingmachines/inkling:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "openrouter/free",
]


async def one(model: str) -> None:
    config.LLM_MODELS[:] = [model]
    t = time.time()
    try:
        data, used = await llm.chat_json(
            "You extract keywords.",
            'Cause: "Animal rescue shelter that rehomes senior dogs". Return {"keywords": [3-6 short lowercase words]}',
            max_tokens=300,
        )
        print(f"{model:50s} {time.time()-t:5.1f}s OK {data}")
    except Exception as e:  # noqa: BLE001
        print(f"{model:50s} {time.time()-t:5.1f}s FAIL {str(e)[:120]}")


async def main() -> None:
    for m in CANDIDATES:
        await one(m)


asyncio.run(main())
