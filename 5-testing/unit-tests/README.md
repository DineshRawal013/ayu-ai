# Unit tests

The automated tests stay next to the code they test, because each service runs its own suite with `npm test` and CI runs them on every push:

| Service | Tests |
|---|---|
| gateway | [gateway.test.js](../../4-implementation/services/gateway/test/gateway.test.js) |
| health-svc | [health.test.js](../../4-implementation/services/health-svc/test/health.test.js) |
| kundali-svc | [kundali.test.js](../../4-implementation/services/kundali-svc/test/kundali.test.js) |
| ai-svc | [ai.test.js](../../4-implementation/services/ai-svc/test/ai.test.js) (uses a fake Ollama, no model needed) |

Run one suite:

```bash
cd 4-implementation/services/gateway && npm ci && npm test
```

GitHub Actions runs all four on every pull request and push ([deploy.yml](../../.github/workflows/deploy.yml)).
