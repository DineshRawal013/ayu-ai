# 4. Implementation

The source code.

| Folder | Contents |
|---|---|
| [frontend](frontend/) | nginx, `index.html`, `app.js`, `kundali.js`, `style.css`, `nginx.conf` |
| [services/gateway](services/gateway/) | Public API, results database, share links, place search |
| [services/health-svc](services/health-svc/) | Age, health metrics, lifespan estimate |
| [services/kundali-svc](services/kundali-svc/) | Birth chart (Swiss Ephemeris) |
| [services/ai-svc](services/ai-svc/) | Prompts for the local AI model (Ollama) |
| [ollama](ollama/) | Start script and image for the AI model |
| [docker-compose.yml](docker-compose.yml) | Runs everything locally |

Each service has its own `package.json`, `Dockerfile` and `test/` folder.

## Run locally

```bash
cd 4-implementation
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up --build
```
