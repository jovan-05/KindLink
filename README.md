# KindLink

**KindLink designs the fundraiser your supporters actually want to attend, and proves every choice with taste data.**

A small nonprofit describes its cause, city, budget and guest count. An AI agent uses
[Qloo's](https://qloo.com) taste API to work out what the cause's supporters love, then returns a complete,
evidence-backed event plan: concept, venues, performers, local sponsors, best neighborhoods, a promotion
plan, a run-of-show and a ready-to-send sponsor pitch. Next to it is a plan from a generic AI with no data,
so you can see what the taste data adds.

Built for the Qloo Agentic Hackathon (2026).


## What makes it trustworthy
- **Nothing invented.** The LLM may write concepts, copy and reasoning, but may only *name* entities that
  Qloo returned. After generation a grounding check (`backend/app/agent/grounding.py`) replaces any
  venue, artist, brand, show or neighborhood name that isn't in the Qloo result set, and logs it.
- **Every recommendation shows its evidence**: the Qloo signal used (tags + supporter interests) and the
  affinity or popularity value, plus Qloo's explainability attribution where available.
- **Honest gaps.** If Qloo returns nothing ranked for a section, it says "Not enough data" instead of padding.
- **No personal data.** Inputs are aggregate supporter interests only. There are no donor fields.

## How it uses Qloo
| Step | Qloo endpoint | What for |
|---|---|---|
| Find taste tags | `GET /v2/tags?filter.query=` | Cause keywords → taste tags (`urn:tag:genre:media:*`, `theme`, `keyword`) and org-type categories |
| Resolve interests | `GET /v2/tags` + `GET /search` | "indie folk" → a genre tag; "Marley & Me" → a movie entity |
| Venues | `GET /v2/insights` `filter.type=urn:entity:place` + `filter.location.query` + `filter.tags` (event categories) | Places ranked by affinity with the supporters' tastes |
| Performers | `/v2/insights` `urn:entity:artist` + `filter.popularity.min/max` | Budget tier → popularity band |
| Sponsors | `/v2/insights` places with `filter.tags` = cafés, bakeries, breweries, pet/book/music stores; plus `urn:entity:brand` | Local businesses and brands with audience overlap |
| Neighborhoods | `/v2/insights` `filter.type=urn:heatmap`; `urn:entity:locality` for names | Hotspots aggregated from heatmap cells, named after the nearest Qloo locality |
| Promotion | `/v2/insights` `urn:entity:podcast`, `urn:entity:tv_show` | Outreach channels |
| Evidence | `feature.explainability=true` | Which signal drove a recommendation |

Live API findings (what works, what's ignored, how an ignored signal looks) are in
[`docs/QLOO_API.md`](docs/QLOO_API.md). Highlights: an ignored signal shows up as every affinity = 0.765;
artists ignore the location filter; brand affinities saturate at 1.0, so they're ranked by popularity.

## The agent pipeline
`backend/app/agent/pipeline.py` runs the 10 steps from [`docs/SPEC.md`](docs/SPEC.md) and streams a status
line for each to the UI:

1. **Understand the cause**: LLM extracts 3–6 keywords (heuristic fallback).
2. **Find and test taste tags** (self-correction): Qloo tag search per keyword; the LLM proposes tags from the
   *returned ids only*; then the agent **tests each candidate against live Qloo place rankings in the city**
   and keeps the strongest. Tags Qloo ignores there (all 0.765) are dropped, even if the AI liked them
   ("Switched from 'Nutrition' to 'Food': stronger Qloo ranking").
3. **Resolve supporter interests**: to Qloo tags or entities (runs alongside 1–2).
4. **Venues**: two place-insight pools (event categories + unfiltered top), LLM screens for event suitability (top 6).
5. **Performers**: artist insights in the budget's popularity band (top 5).
6. **Local sponsors**: business-category place insights + brand insights.
7. **Best neighborhoods**: heatmap → top 3 separated hotspots, named from Qloo localities.
8. **Promotion**: podcasts + TV shows (top 5).
9. **Compose**: LLM writes the plan from Qloo data only (short ids like `V1`, `P2` so free models can't garble
   ids); grounding check removes unverified names.
10. **Verify** (shown as its own live step): "Checked 12 names the AI wrote: 12 verified, 0 removed". Removed
    names appear struck through in the plan's data notes.
11. **Baseline**: the same inputs to the LLM with no Qloo data, for the comparison tab.

Every step streams **decision lines** as well as a status (which tags were tested and dropped, which venues the
screener passed over, why performers aren't local, which hotspots were dropped for having no Qloo name).
They're stored with the plan and shown in the **"How the agent decided"** tab, so pre-cached examples show
the reasoning too.

Steps 4–8 run concurrently. Every step has a timeout and a fallback, so a failing step marks its section
"not enough data" rather than breaking the plan. If the LLM is down entirely, rule-based fallbacks still
produce a plan from Qloo names only.

## Architecture
```
frontend/  Next.js 15 (App Router) + TypeScript + Tailwind v4 + Leaflet (2D) + MapLibre GL (3D view,
           OpenFreeMap tiles with 3D buildings; Qloo heatmap cells drawn as extruded columns, no API key)
           proxies /api/* to the backend (BACKEND_URL, server-side only)
backend/   FastAPI (Python 3.12)
  app/qloo/client.py      auth header, ≤4 req/s sliding window, retry+backoff on 429/5xx, 7-day cache
  app/qloo/endpoints.py   typed helpers: find_tags, search_entities, insights, heatmap
  app/agent/              pipeline, steps/, scoring, grounding, compose, baseline
  app/llm.py              OpenRouter client, free models only, model fallback chain
  app/store.py, cache.py  Postgres if DATABASE_URL is set, else in-memory
  data/examples/          pre-cached example plans (instant load, no DB needed)
docs/      SPEC, QLOO_API (live findings), BUILD_PLAN
```
The Qloo and OpenRouter keys are only read by the backend. The browser talks to `/api/*` on the frontend
origin; `npm run check-secrets` scans the built client bundle for key names and values.

**LLM.** OpenRouter, free models only (`:free` suffix enforced in code). Default chain:
`minimax/minimax-m3.1-flash:free` → `nvidia/nemotron-3-ultra-550b-a55b:free` → `google/gemma-4-31b-it:free`
→ `openrouter/free`. Models that return 429 are skipped for 60s. Override with `LLM_MODEL` (comma-separated).

**Demo links** (on any plan): `/plan/<id>#compare` opens the comparison, `#agent` the agent log, `#3d` the
3D map. The 3D view needs WebGL; the 2D map is the default.

## Run locally
Requirements: Python 3.12, Node 22+.

```bash
# 1. secrets
cp .env.example .env        # fill in QLOO_API_KEY and OPENROUTER_API_KEY

# 2. backend
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

Useful scripts (run from `backend/`):
| Command | What it does |
|---|---|
| `.venv/Scripts/python -m pytest` | Tests: identical-affinity detector, ranking/banding/hotspots, grounding, interest matching, pipeline fallbacks |
| `.venv/Scripts/python scripts/kill_tests.py` | Re-runs the live Qloo API checks from `docs/QLOO_API.md` |
| `.venv/Scripts/python scripts/run_plan.py austin` | Runs one example end to end in the terminal (`austin`, `chicago`, `nyc`) |
| `.venv/Scripts/python scripts/precache_examples.py` | Regenerates `data/examples/*.json` (and Postgres, if set) |
| `.venv/Scripts/python scripts/bench_llm.py` | Checks which free OpenRouter models are responding |

Frontend: `npm run lint`, `npm run build`, `npm run check-secrets` (after a build).

## Environment variables
| Variable | Where | Required | Notes |
|---|---|---|---|
| `QLOO_API_KEY` | backend | yes | Server only. Never logged or returned. |
| `QLOO_BASE_URL` | backend | no | Default `https://hackathon.api.qloo.com` |
| `OPENROUTER_API_KEY` | backend | yes | |
| `LLM_MODEL` | backend | no | Comma-separated OpenRouter ids; non-`:free` ids are ignored |
| `DATABASE_URL` | backend | no | Postgres for Qloo cache + plan storage. Memory if unset. |
| `CORS_ORIGINS` | backend | no | Only needed if the browser calls the backend directly |
| `BACKEND_URL` | frontend | yes in prod | Where `/api/*` is proxied. Read at **build time** (Next rewrites). |

## Known limitations
- **US cities only.** Qloo place data outside the US came back unranked in testing.
- **Performers aren't local.** Qloo's artist insights ignore the city filter, so performers are taste matches; check availability.
- **Free LLMs can be slow.** A live plan can take 2–3 minutes; slow steps fall back to rules, but names still come only from Qloo.

## License
MIT. See [LICENSE](LICENSE).
