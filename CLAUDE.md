# CLAUDE.md

Ayu AI shows a person's **age**, **health** and **Vedic kundali** on one page, then adds an **AI insight** from a self-hosted LLM. It is an educational and entertainment tool, not a medical device.

## Architecture: 4 Docker containers

| Service | Source | Role |
|---|---|---|
| `frontend` | `frontend/` (nginx 1.27) | Static page (`index.html`, `app.js`, `kundali.js`, `style.css`). Proxies `/api/*` to `backend:3000` with buffering off so the AI text streams. Only public port (`HTTP_PORT`, default 80). |
| `backend` | `backend/src/` (Node 20, Express 5) | All calculations, kundali (Swiss Ephemeris via `sweph`, a native module), DB access, AI prompt. |
| `postgres` | `postgres:16-alpine` | Anonymous result history in a single `results` table (JSONB `input` and `result`, plus `insight` text). The schema is created in `db.js` `init()`, and there are no migrations. |
| `ollama` | `ollama/ollama` + `ollama/entrypoint.sh` | Runs `qwen2.5:1.5b` on CPU. Pulls the model on first start into the `ollama_data` volume. |

Backend modules (`backend/src/`):
- `server.js` defines the routes and `runAnalysis()`, the single entry point that combines age, health, lifespan and kundali. It is exported for tests.
- `age.js` handles exact age. `health.js` covers BMI/BMR/TDEE, alerts and the 12-week projection. `lifespan.js` produces the "fun" remaining-years estimate.
- `kundali.js` covers chart, dasha, challenging periods and transits (Lahiri ayanamsa, whole-sign houses).
- `ai.js` contains `buildPrompt()`, which streams from Ollama `/api/generate`, plus `status()`.
- `geo.js` does Nominatim place search. `db.js` handles Postgres (it has no-op fallbacks when the DB is not ready).

## Rules

### 1. Backend numbers and AI guesses are separate sections
- The **backend computes the real numbers** (age, health metrics, lifespan estimate, kundali). These are deterministic and tested.
- There is **one AI system** (Ollama, `ai.js`). It **makes its own guess** at the number and the result, independently of the backend.
- The two must be shown as **different sections** that are clearly labelled, e.g. "Calculated" vs. "AI's guess". Never merge them, never overwrite a backend number with an AI value, and never present the AI guess as the calculated result. They are expected to differ.
- Implemented for **lifespan only**. The page shows "Lifeline" (calculated, `lifespan.js`) and then "AI's guess" (`buildGuessPrompt`/`parseGuess`/`guessLifespan` in `ai.js`, `POST /api/results/:id/guess`, cached in `results.ai_guess`).
- The guess prompt gets **raw answers only**: no BMI, no calculated lifespan and **no kundali**. A test enforces this, so keep it that way. `parseGuess` rejects invalid output (not JSON, not above the current age, or over 125), and the backend retries once.
- The "Ayu's read" insight (`buildPrompt`) is separate. It explains the backend numbers and must not invent numbers.

### 2. Astrology and lifespan/death predictions are for learning only
- Astrology is **sometimes** used for lifespan or death predictions. This is **only for learning/educational purposes**.
- Any such output must be labelled as traditional belief for learning, with no scientific or predictive validity. Keep it separate from the health-based lifespan estimate.
- Current state: the code and copy say the opposite. See the header comment in `kundali.js`, the "Never predict death, illness or a lifespan from astrology" line in `ai.js`, the fineprint in `index.html` and the README disclaimer. If you add this feature, update those places together. Don't change them unprompted.

### 3. `docker-compose.yml` is the production file
- GitHub Actions (`.github/workflows/deploy.yml`) copies `docker-compose.yml` and `ollama/entrypoint.sh` to the Azure VM on every push to `main` and runs `docker compose pull frontend backend && docker compose up -d --no-build`.
- **Local-only changes must go in separate files**, e.g. `docker-compose.override.yml`, `docker-compose.local.yml` or a local `.env`. Never put dev-only ports, mounts, build tweaks or debug settings in `docker-compose.yml` or `ollama/entrypoint.sh`.
- Any change to those two files reaches production on the next push to `main`.

## Commands

```bash
cp .env.example .env              # set POSTGRES_PASSWORD; HTTP_PORT=8080 if 80 is busy
docker compose up --build         # local run; first start downloads the model (~1 GB)
docker compose logs -f ollama     # watch the model download

cd backend && npm ci && npm test  # node:test, backend/test/*.test.js (CI runs exactly this)
```

## Deployment (Azure)

Push to `main` → test → build `backend` and `frontend` images → push to GHCR (`ghcr.io/<owner>/ayu-ai-<service>:latest` and `:<sha>`) → SCP compose files → SSH, pull and restart → `curl /api/status`. PRs run tests only. The VM is prepared once with `deploy/setup-vm.sh`, which creates `~/ayu-ai/.env`. The `VM_HOST`, `VM_USER` and `VM_SSH_KEY` secrets are required.

## Gotchas

- **Windows line endings:** this repo is developed on Windows with `core.autocrlf=true`. `.gitattributes` forces `*.sh` to LF, because `/bin/sh` fails inside the container on CRLF. Keep that rule. Their executable bit (755) has also been dropped locally.
- The Postgres password is passed via `PGPASSWORD` (not in `DATABASE_URL`) so special characters don't break the URL.
- The backend rejects ages under 15 or over 120. If the birth time is missing, noon is used and `kundali.timeUnknown` is set.
- Saving to the DB is best-effort. `/api/analyze` still returns results with `id: null` if Postgres is down.
- AI insights are cached in `results.insight`. A generation already in progress returns 409. The insight endpoint returns 503 while Ollama is unreachable or the model is still downloading.
- `sweph` needs `python3 make g++` at build time (multi-stage `backend/Dockerfile`).
- The CSP in `nginx.conf` allows scripts only from `self` and `cdn.jsdelivr.net`. Update it if you add any other external source.
