"""KindLink API (FastAPI).

POST /api/plan          start a plan run; streams NDJSON step events, ends with {"type":"done","id":...}
GET  /api/plan/{id}     a stored plan
GET  /api/examples      the three example causes
GET  /api/meta          supported cities, budgets
GET  /api/health
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import config, store
from .agent import pipeline
from .agent.context import PlanInput
from .examples import EXAMPLES, SUPPORTED_CITIES

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
# httpx logs full request URLs; keep it quiet so nothing sensitive lands in logs.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("kindlink.api")

app = FastAPI(title="KindLink API", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

PLAN_ID = re.compile(r"^[a-z0-9-]{6,64}$")


@app.get("/api/health")
async def health() -> dict:
    # Report whether keys are configured, never their values.
    return {"ok": True, "qloo": bool(config.QLOO_API_KEY), "llm": bool(config.OPENROUTER_API_KEY),
            "postgres": bool(config.DATABASE_URL)}


@app.get("/api/meta")
async def meta() -> dict:
    return {"cities": SUPPORTED_CITIES, "budgets": ["shoestring", "modest", "generous"]}


@app.get("/api/examples")
async def examples() -> list[dict]:
    return [
        {"id": e["id"], "key": e["key"], "title": e["title"], "city_label": e["city_label"],
         "input": e["input"].model_dump(), "ready": (await store.get(e["id"])) is not None}
        for e in EXAMPLES
    ]


@app.get("/api/plan/{plan_id}")
async def get_plan(plan_id: str) -> dict:
    if not PLAN_ID.match(plan_id):
        raise HTTPException(404, "Plan not found")
    plan = await store.get(plan_id)
    if plan is None:
        raise HTTPException(404, "Plan not found")
    return plan


async def _stream(inp: PlanInput) -> AsyncIterator[bytes]:
    plan_id = uuid.uuid4().hex[:12]
    try:
        async for ev in pipeline.run(inp, plan_id=plan_id):
            if ev["type"] == "result":
                await store.save(ev["plan"])
                yield (json.dumps({"type": "done", "id": plan_id}) + "\n").encode()
            else:
                yield (json.dumps(ev) + "\n").encode()
    except Exception:  # noqa: BLE001
        log.exception("pipeline crashed")
        yield (json.dumps({"type": "error", "message": "Something went wrong while building the plan."}) + "\n").encode()


@app.post("/api/plan")
async def start_plan(inp: PlanInput) -> StreamingResponse:
    return StreamingResponse(
        _stream(inp),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
