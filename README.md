# Ayu AI

**Ayu** (Sanskrit *āyu*, "life") reads your **age**, your **health** and your **Vedic birth chart** together on one page, then a **self-hosted AI model** writes a short personal summary of all three.

It is a team project at **Dongshin University**. It merges two earlier projects, [age-calculator-website](https://github.com/DineshRawal013/age-calculator-website) and HealthCheck, and adds AI insight, a database, a kundali and a deployment pipeline.

## Team

| Member | Role |
|---|---|
| Dinesh | Team leader |
| Saroj | AI |
| Saurav | Frontend |
| Manisha | Backend |
| Sudurshan | Documentation |
| Prayash | Cloud engineer |

## Repository layout (SDLC phases)

The repository follows the phases of the software development life cycle. Each phase folder has a README that lists what it holds.

| Phase | Folder | Contents |
|---|---|---|
| 1 | [1-planning](1-planning/) | Project charter, scope, schedule, [RACI](1-planning/raci/), risks, cost, communication, feasibility |
| 2 | [2-requirements](2-requirements/) | SRS, [RTM](2-requirements/rtm/), [use cases](2-requirements/use-cases/) |
| 3 | [3-design](3-design/) | [Architecture](3-design/architecture/), [context diagram](3-design/context-diagram/), [UI mockups](3-design/ui-design/), database design |
| 4 | [4-implementation](4-implementation/) | All source code: frontend, the four services, Ollama, `docker-compose.yml` |
| 5 | [5-testing](5-testing/) | Test plan, test cases, [unit tests](5-testing/unit-tests/), test reports |
| 6 | [6-deployment](6-deployment/) | [Azure Container Apps](6-deployment/azure/) (Bicep, setup, pipeline), scripts, user manual |
| 7 | [7-closure](7-closure/) | [Presentation](7-closure/presentation/), final report, lessons learned |

The CI/CD workflows stay in `.github/workflows/`, because GitHub only runs them from there.

## Features

**Age**
- Exact age in years, months and days, a live seconds counter, totals and a next-birthday countdown

**Health**
- BMI, BMR (Mifflin–St Jeor), TDEE, water estimate, reference weight range, waist-to-height ratio
- Habit inputs: sleep, smoking, alcohol
- **Alerts** ranked by severity, including predictions ("at +300 kcal/day your BMI may pass 25 in 12 weeks")
- **Charts**: habit-balance radar and a 12-week weight projection for three intake scenarios

**Lifeline (just for fun)**
- Remaining-years estimate: country/sex life-expectancy baseline, adjusted for BMI, activity, smoking, alcohol, sleep and waist, with each factor shown

**Kundali (traditional, cultural interest)**
- Birth place search (OpenStreetMap), with time zone and historical offsets resolved automatically
- North Indian birth chart, planet table, lagna, rashi, nakshatra and pada
- **Animated planet wheel** from your date of birth to today, with play/pause, speed and a date slider. Natal positions show as faint rings and Jupiter/Saturn/Rahu sign changes are logged. It ends in **live mode** with today's sky moving in real time.
- Vimshottari dasha timeline with the current period marked
- Traditionally challenging periods (Sade Sati, Ashtama Shani, difficult dasha combinations), worded gently
- Astrology is never used for the lifespan estimate and never predicts death or illness

**AI insight**
- Ollama running **qwen2.5:1.5b** in its own container, with no external API and no API key
- The calculation services compute every number and the model only explains them, streamed word by word
- Saved with the result, so a shared link shows the same text

**History**
- Each reading is stored anonymously in PostgreSQL and opens again with a share link (`/?r=<id>`)

## Architecture

Ayu AI is built as **microservices**: an API gateway plus three stateless domain services, each in its own container with its own codebase, tests and image.

```mermaid
flowchart LR
  B[Browser] -->|:80 / :443| F
  subgraph FN[frontend-net]
    C[caddy<br/>optional HTTPS] -.-> F[frontend<br/>nginx]
    F -->|/api/* :3000| G[gateway<br/>public API, results,<br/>share links, place search]
  end
  subgraph SN[services-net, internal]
    G -->|:3001| H[health-svc<br/>age, health, lifespan]
    G -->|:3002| K[kundali-svc<br/>Swiss Ephemeris]
    G -->|:3003| A[ai-svc<br/>prompts, streaming]
  end
  subgraph DN[data-net, internal]
    G -->|:5432| DB[(postgres)]
  end
  subgraph AN[ai-net]
    A -->|:11434| O[ollama<br/>qwen2.5:1.5b]
  end
  G -->|place search| N[OpenStreetMap<br/>Nominatim]
```

### Services

| Container | Source | Port | Role |
|---|---|---|---|
| `frontend` | `4-implementation/frontend/` (nginx 1.27) | 80 (public) | Static page, proxies `/api` to the gateway and streams the AI text |
| `gateway` | `4-implementation/services/gateway/` | 3000 | The only public API: routes, orchestration, results DB, share links, AI caching and locks, place search |
| `health-svc` | `4-implementation/services/health-svc/` | 3001 | Exact age, health metrics, alerts, 12-week projection, lifespan estimate |
| `kundali-svc` | `4-implementation/services/kundali-svc/` | 3002 | Birth chart, dasha, challenging periods, planet transits (Swiss Ephemeris) |
| `ai-svc` | `4-implementation/services/ai-svc/` | 3003 | Insight and lifespan-guess prompts for Ollama, streaming, output validation |
| `postgres` | `postgres:16-alpine` | — | Anonymous result history (owned by the gateway) |
| `ollama` | `ollama/ollama` | — | Local LLM, downloads the model on first start |
| `caddy` (optional) | `caddy:2.8-alpine` | 80, 443 | HTTPS with Let's Encrypt (Azure only) |

The three domain services are **stateless** and never call each other. The gateway composes their answers, so the browser sees the same API as before. Every service has `GET /healthz` and a Docker health check. A validation error from a service passes through the gateway unchanged; an unreachable service gives a 503 with a friendly message.

### Networks

| Network | Containers | Internet | Purpose |
|---|---|---|---|
| `frontend-net` | `caddy`, `frontend`, `gateway` | yes | Web tier: browser traffic reaches the gateway |
| `services-net` | `gateway`, `health-svc`, `kundali-svc`, `ai-svc` | **no** (`internal`) | Gateway to domain services |
| `data-net` | `gateway`, `postgres` | **no** (`internal`) | Only the gateway reaches the database |
| `ai-net` | `ai-svc`, `ollama` | yes (model download) | Only ai-svc reaches the model |

- Only `frontend` (or `caddy` with HTTPS) publishes a port to the host.
- The frontend can reach only the gateway. The domain services cannot reach the database, and only ai-svc can reach Ollama.
- Containers find each other by service name through Docker's built-in DNS.

```text
ayu-ai/
├── 1-planning/ … 3-design/      documents (see "Repository layout" above)
├── 4-implementation/
│   ├── services/
│   │   ├── gateway/        server.js (routes, runAnalysis), services.js (HTTP clients), db.js, geo.js
│   │   ├── health-svc/     server.js, age.js, health.js, lifespan.js
│   │   ├── kundali-svc/    server.js, kundali.js (native sweph module)
│   │   └── ai-svc/         server.js, ai.js (Ollama prompts + streaming)
│   │       (each has package.json, Dockerfile and test/)
│   ├── frontend/           index.html, style.css, app.js, kundali.js, nginx.conf, Dockerfile
│   ├── ollama/             entrypoint.sh, Dockerfile
│   └── docker-compose.yml
├── 5-testing/
├── 6-deployment/
│   ├── azure/              infra/main.bicep (Azure Container Apps), bootstrap.sh
│   └── scripts/old-vm/     setup-vm.sh, caddy/Caddyfile (old VM deploy, reference only)
├── 7-closure/
└── .github/workflows/      deploy-aca.yml (deploy), deploy.yml (tests)
```

## Run locally

Requires Docker Desktop.

```bash
git clone https://github.com/DineshRawal013/ayu-ai.git
cd ayu-ai/4-implementation
cp .env.example .env          # then edit POSTGRES_PASSWORD (and HTTP_PORT=8080 if port 80 is busy)
docker compose up --build
```

Open http://localhost (or http://localhost:8080). The first start downloads the AI model (~1 GB). Until it finishes, results still work but the AI read says the model is downloading. Follow it with:

```bash
docker compose logs -f ollama
```

Tests (each service has its own suite; ai-svc uses a fake Ollama):

```bash
cd 4-implementation/services/gateway && npm ci && npm test       # likewise for health-svc, kundali-svc, ai-svc
```

## Deploy to Azure (Container Apps)

Production runs on Azure Container Apps. Every push to `main` runs the tests, builds the images into Azure Container Registry and deploys `6-deployment/azure/infra/main.bicep` (`.github/workflows/deploy-aca.yml`). The run summary shows the site's URL. One-time setup, cost and options: [6-deployment/azure/README.md](6-deployment/azure/README.md).

The earlier single-VM deploy (Docker Compose over SSH) is no longer run by CI. `6-deployment/scripts/old-vm/` (`setup-vm.sh` and `caddy/`) is kept only for reference.

## API

All endpoints are served by the **gateway**; it calls the internal services.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/analyze` | Age, health, lifespan and kundali in one call; saves and returns an `id` |
| `GET` | `/api/results/:id` | Load a saved reading |
| `POST` | `/api/results/:id/insight` | Stream the AI insight (plain text) |
| `POST` | `/api/results/:id/guess` | The AI's own lifespan guess (JSON), shown separately from the calculated Lifeline |
| `GET` | `/api/kundali/transits?from=ISO&to=ISO` | Planet longitudes for the animated wheel |
| `GET` | `/api/kundali/now` | Current sidereal planet positions |
| `GET` | `/api/geo/search?q=` | Birth place search |
| `GET` | `/api/countries` | Countries with life-expectancy baselines |
| `POST` | `/api/age` | Original age endpoint, kept for compatibility |
| `GET` | `/api/status` | Database, AI and per-service health |

## How the numbers are made

- **Health**: BMI = kg / m²; BMR by Mifflin–St Jeor; TDEE = BMR × activity factor; water ≈ 0.033 L/kg; waist-to-height = waist / height.
- **Projection**: energy balance at 7,700 kcal per kg, recalculating TDEE each week as weight changes.
- **Lifespan**: life expectancy at birth by country and sex (UN Population Division estimates, via Worldometer), plus a small survivorship bonus for having reached your current age, plus rounded habit effects from large population studies (e.g. current smoking −10 years). It is a fun estimate, not a prediction.
- **Kundali**: Swiss Ephemeris (Moshier), Lahiri ayanamsa, mean node for Rahu, whole-sign houses, Vimshottari dasha with 365.25-day years. If birth time is missing, noon is used and the lagna may be wrong.

## Privacy

Readings are saved **without name, email or IP address**, but they include date, time and place of birth plus health inputs. Anyone with a share link can open that reading. The AI runs on the same server, so data is never sent to an AI company. Place search queries go to OpenStreetMap's Nominatim.

## Disclaimer

Ayu AI is an educational and entertainment tool, not a medical device. Health formulas are screening estimates. The lifespan figure is just for fun. Vedic astrology is shown as a cultural tradition with no proven predictive power. For medical questions, see a qualified healthcare professional.

## License

MIT, see [LICENSE](LICENSE).
