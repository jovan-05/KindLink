"""Settings loaded from the environment. Secrets are read here and never exposed via the API."""
import os
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[2]
# Repo-root .env first, then backend/.env if present; real env vars win.
for name in (".env", ".env.local"):
    load_dotenv(_ROOT / name, override=False)
    load_dotenv(_ROOT / "backend" / name, override=False)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


QLOO_API_KEY = _env("QLOO_API_KEY")
QLOO_BASE_URL = _env("QLOO_BASE_URL", "https://hackathon.api.qloo.com").rstrip("/")
OPENROUTER_API_KEY = _env("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = _env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
# Comma-separated list of OpenRouter model ids, tried in order. Only ":free" models are allowed.
LLM_MODELS = [m.strip() for m in _env("LLM_MODEL").split(",") if m.strip()]
DATABASE_URL = _env("DATABASE_URL")
CORS_ORIGINS = [o.strip() for o in _env("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

QLOO_TIMEOUT_S = float(_env("QLOO_TIMEOUT_S", "15"))
LLM_TIMEOUT_S = float(_env("LLM_TIMEOUT_S", "40"))
CACHE_TTL_S = 7 * 24 * 3600
