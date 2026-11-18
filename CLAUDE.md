# CLAUDE.md

Ayu AI shows a person's **age**, **health** and **Vedic kundali** on one page, then adds an **AI insight** from a self-hosted LLM. It is an educational and entertainment tool, not a medical device.

## Architecture: microservices (4 Node services + infrastructure)

| Service | Source | Role |
|---|---|---|
| `frontend` | `frontend/` (nginx 1.27) | Static page (`index.html`, `app.js`, `kundali.js`, `style.css`). Proxies `/api/*` to `gateway:3000` with buffering off so the AI text streams. Only public port (`HTTP_PORT`, default 80). |
| `gateway` | `services/gateway/` (Node 20, Express 5) | The only public API. All `/api/*` routes, `runAnalysis()` orchestration, results DB (`db.js`), share links, AI caching and "already generating" locks, Nominatim place search (`geo.js`). Calls the three services over HTTP (`services.js`). |
| `health-svc` | `services/health-svc/` (port 3001) | Age, health metrics, alerts, projection, lifespan estimate. `POST /analyze`, `POST /age`, `GET /countries`. Stateless. |
| `kundali-svc` | `services/kundali-svc/` (port 3002) | Kundali via Swiss Ephemeris (`sweph`, a native module). `POST /chart`, `GET /transits`, `GET /now`. Stateless. |
| `ai-svc` | `services/ai-svc/` (port 3003) | Ollama prompts. `POST /insight` (streamed text), `POST /guess`, `GET /status`. Stateless: the gateway sends the saved reading. |
| `postgres` | `postgres:16-alpine` | Anonymous result history in a single `results` table (JSONB `input` and `result`, plus `insight` text, `ai_guess` JSONB). Owned by the gateway; the schema is created in `services/gateway/src/db.js` `init()`, and there are no migrations. |
| `ollama` | `ollama/ollama` + `ollama/entrypoint.sh` | Runs `qwen2.5:1.5b` on CPU. Pulls the model on first start into the `ollama_data` volume. |
| `caddy` (optional) | `caddy:2.8-alpine` + `caddy/Caddyfile` | HTTPS on 80/443 in front of `frontend`, Let's Encrypt cert for `DOMAIN`. Only runs with the `https` profile (`COMPOSE_PROFILES=https` in the VM's `.env`, which also sets `HTTP_PORT=127.0.0.1:8080`). Never starts locally. |

**Networks:** `frontend-net` (caddy, frontend, gateway), `services-net` (gateway and the three services; `internal`), `data-net` (gateway, postgres; `internal`) and `ai-net` (ai-svc, ollama; not `internal` because ollama downloads the model). Only the gateway reaches postgres, only ai-svc reaches ollama, and the frontend reaches only the gateway.

Every service has `GET /healthz` and a Docker `HEALTHCHECK`. Errors a service returns with 4xx pass through the gateway unchanged; an unreachable service becomes 503. The public API is the same as the v1 monolith.

## Rules

### 1. Backend numbers and AI guesses are separate sections
- The **backend computes the real numbers** (age, health metrics and lifespan estimate in health-svc; kundali in kundali-svc). These are deterministic and tested.
- There is **one AI system** (Ollama, `ai.js`). It **makes its own guess** at the number and the result, independently of the backend.
- The two must be shown as **different sections** that are clearly labelled, e.g. "Calculated" vs. "AI's guess". Never merge them, never overwrite a backend number with an AI value, and never present the AI guess as the calculated result. They are expected to differ.
- Implemented for **lifespan only**. The page shows "Lifeline" (calculated, `lifespan.js`) and then "AI's guess" (`buildGuessPrompt`/`parseGuess`/`guessLifespan` in `services/ai-svc/src/ai.js`, `POST /api/results/:id/guess` on the gateway, cached in `results.ai_guess`).
- The guess prompt gets **raw answers only**: no BMI, no calculated lifespan and **no kundali**. A test enforces this, so keep it that way. `parseGuess` rejects invalid output (not JSON, not above the current age, or over 125), and ai-svc retries once.
- The "Ayu's read" insight (`buildPrompt`) is separate. It explains the backend numbers and must not invent numbers.

### 2. Astrology and lifespan/death predictions are for learning only
- Astrology is **sometimes** used for lifespan or death predictions. This is **only for learning/educational purposes**.
- Any such output must be labelled as traditional belief for learning, with no scientific or predictive validity. Keep it separate from the health-based lifespan estimate.
- Current state: the code and copy say the opposite. See the header comment in `kundali.js`, the "Never predict death, illness or a lifespan from astrology" line in `ai.js`, the fineprint in `index.html` and the README disclaimer. If you add this feature, update those places together. Don't change them unprompted.

### 3. `docker-compose.yml` is the production file
- GitHub Actions (`.github/workflows/deploy.yml`) copies `docker-compose.yml`, `ollama/entrypoint.sh` and `caddy/Caddyfile` to the Azure VM on every push to `main` and runs `docker compose pull frontend gateway health-svc kundali-svc ai-svc && docker compose up -d --no-build --remove-orphans`.
- **Local-only changes must go in separate files**, e.g. `docker-compose.override.yml`, `docker-compose.local.yml` or a local `.env`. Never put dev-only ports, mounts, build tweaks or debug settings in `docker-compose.yml` or `ollama/entrypoint.sh`.
- Any change to those files reaches production on the next push to `main`.

## Commands

```bash
cp .env.example .env              # set POSTGRES_PASSWORD; HTTP_PORT=8080 if 80 is busy
docker compose up --build         # local run; first start downloads the model (~1 GB)
docker compose logs -f ollama     # watch the model download

# each service has its own package.json and tests (CI runs this for all four)
cd services/gateway && npm ci && npm test
cd services/health-svc && npm ci && npm test
cd services/kundali-svc && npm ci && npm test
cd services/ai-svc && npm ci && npm test   # uses a fake Ollama, no model needed
```

## Deployment (Azure)

Push to `main` → test (matrix over the 4 services) → build 5 images (`frontend`, `gateway`, `health-svc`, `kundali-svc`, `ai-svc`) → push to GHCR (`ghcr.io/<owner>/ayu-ai-<service>:latest` and `:<sha>`) → SCP compose files → SSH, pull and restart → `curl /api/status`. PRs run tests only. The VM is prepared once with `deploy/setup-vm.sh`, which creates `~/ayu-ai/.env`. The `VM_HOST`, `VM_USER` and `VM_SSH_KEY` secrets are required.

**Azure Container Apps (prepared, not live yet):** `infra/main.bicep` + `.github/workflows/deploy-aca.yml` (manual `workflow_dispatch` only, GitHub environment `azure-aca`, OIDC secrets). One container app per service, internal apps reached as `http://<name>` on port 80, managed Postgres in a private VNet, images in ACR, Ollama image with the model baked in (`ollama/Dockerfile`, not used by Compose). `frontend/nginx.conf` is an nginx template: `GATEWAY_URL` defaults to `http://gateway:3000` for Compose. One-time setup in `deploy/azure/README.md`. Until the user switches, the VM deploy stays production.

## Gotchas

- **Windows line endings:** this repo is developed on Windows with `core.autocrlf=true`. `.gitattributes` forces `*.sh` to LF, because `/bin/sh` fails inside the container on CRLF. Keep that rule. Their executable bit (755) has also been dropped locally.
- The Postgres password is passed via `PGPASSWORD` (not in `DATABASE_URL`) so special characters don't break the URL.
- health-svc rejects ages under 15 or over 120. If the birth time is missing, noon is used and `kundali.timeUnknown` is set.
- Saving to the DB is best-effort. `/api/analyze` still returns results with `id: null` if Postgres is down.
- AI insights are cached in `results.insight`. A generation already in progress returns 409. The insight endpoint returns 503 while Ollama is unreachable or the model is still downloading.
- `sweph` needs `python3 make g++` at build time (multi-stage `services/kundali-svc/Dockerfile`). Only kundali-svc has native modules.
- `PLANET_NAME` is duplicated in `services/ai-svc/src/ai.js` so ai-svc does not need `sweph`. Keep it in sync with `kundali-svc`.
- The generation locks are in the gateway's memory, so run only one gateway replica.
- `services/ai-svc/test/fixtures/reading.json` is a real saved reading used by ai-svc tests; regenerate it if the result shape changes.
- The CSP in `nginx.conf` allows scripts only from `self` and `cdn.jsdelivr.net`. Update it if you add any other external source.
