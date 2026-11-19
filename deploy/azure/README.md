# Deploy to Azure Container Apps

This runs the same services as `docker-compose.yml`, but as Azure Container Apps instead of containers on one VM. It is the production deploy: every push to `main` runs `.github/workflows/deploy-aca.yml`.

| Compose (VM) | Azure |
|---|---|
| `frontend` on port 80, Caddy for HTTPS | `frontend` container app, public HTTPS on `https://frontend.<id>.koreacentral.azurecontainerapps.io` (no Caddy needed) |
| `gateway`, `health-svc`, `kundali-svc`, `ai-svc` | One internal container app each, reached by name (`http://gateway`, ...) |
| `ollama` + `ollama_data` volume | `ollama` container app, image `ayu-ai-ollama` with the model baked in (`ollama/Dockerfile`) |
| `postgres` + `pgdata` volume | Azure Database for PostgreSQL Flexible Server (Burstable B1ms, 32 GB), private, VNet only |
| `data-net`, `services-net`, `ai-net` | One VNet. Only the frontend is public; Postgres has no public endpoint |
| GHCR images | Azure Container Registry (Basic) |

Files: `infra/main.bicep` (everything), `infra/modules/app.bicep` (one container app), `deploy/azure/bootstrap.sh` (one-time setup), `.github/workflows/deploy-aca.yml` (build and deploy).

## One-time setup

Do this once, before the first push to `main` deploys.

1. Open [Azure Cloud Shell](https://shell.azure.com) in Bash, then run:

   ```bash
   gh auth login        # once: lets the script add the GitHub secrets for you
   git clone https://github.com/DineshRawal013/ayu-ai.git && cd ayu-ai
   bash deploy/azure/bootstrap.sh
   ```

   It creates the resource group `ayu-aca-rg` (Korea Central), the registry, a pull identity, and an Entra app that GitHub Actions signs in as with OIDC (no password is stored anywhere). Then it creates the GitHub environment `azure-aca` with these secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_POSTGRES_PASSWORD`, which it generates without showing it. If you skip `gh auth login`, it prints the values for you to add under **Settings > Environments** instead.

2. Start the first deploy: `gh workflow run deploy-aca.yml --repo DineshRawal013/ayu-ai`, or **Actions > Deploy to Azure Container Apps > Run workflow**. The first run takes about 20 minutes: Postgres and the environment take 10 to 15, and the Ollama image (about 4 GB) is built once. The run summary shows the site's URL.

## Cost and speed

Optional repository variables (**Settings > Secrets and variables > Actions > Variables**):

| Variable | Default | What it does |
|---|---|---|
| `AZURE_APP_MIN_REPLICAS` | `0` | `1` keeps the five small apps running. With `0` the first visit after a quiet spell takes 10 to 30 seconds. |
| `AZURE_OLLAMA_MIN_REPLICAS` | `0` | `1` keeps Ollama (2 vCPU, 4 GiB) running. With `0` the first AI read after a quiet spell waits a few minutes, and the page says the model is not ready until then. |
| `AZURE_POSTGRES_SKU`, `AZURE_POSTGRES_TIER` | `Standard_B1ms`, `Burstable` | Postgres size. If the deploy fails with `SkuNotAvailable`, your subscription can't use that size in this region: pick one from `az postgres flexible-server list-skus -l koreacentral`. |
| `AZURE_LOCATION` | the resource group's region | Run the apps and Postgres in another region, e.g. when Postgres has no usable size in Korea Central. |
| `AZURE_RESOURCE_GROUP` | `ayu-aca-rg` | Only if you ran the script with another `RG`. |

Rough monthly cost at list prices (check the [pricing calculator](https://azure.microsoft.com/pricing/calculator/) for Korea Central):

- Always there: Postgres B1ms with 32 GB about 16 USD, registry about 5 USD, logs a few USD.
- Both variables `0`: Container Apps costs little beyond the monthly free grant for light use. Total about 25 USD.
- `AZURE_APP_MIN_REPLICAS=1`: about 40 USD more.
- `AZURE_OLLAMA_MIN_REPLICAS=1`: about 45 USD more.

Ollama is the big item because it needs 4 GiB of memory. 4 GiB with 2 vCPU is the most that fits comfortably on the Consumption plan for this model.

## Switching from the VM (done)

Production was switched from the VM to Container Apps. For reference, the steps were:

1. Optional: copy the saved results (share links) from the VM. Dump them with the command below. Postgres on Azure is private, so the restore (`psql < ayu.sql`) has to run from inside the VNet, for example from a short-lived container app job.

   ```bash
   ssh azureuser@<VM_IP> 'cd ~/ayu-ai && docker compose exec -T postgres pg_dump -U ayu ayu' > ayu.sql
   ```

2. In `.github/workflows/deploy-aca.yml`, add `push: branches: [main]` under `on:`. In `.github/workflows/deploy.yml`, remove the `deploy` job.
3. Point your domain (if any) at the frontend app: `az containerapp hostname add` and `az containerapp hostname bind --environment ayu-env --validation-method CNAME`.
4. Stop the VM: `az vm deallocate -g ayu-rg -n ayu-vm`. Delete it once you're sure.

## Notes

- `frontend/nginx.conf` is now a template: `GATEWAY_URL` is `http://gateway:3000` on Compose (the image default) and `http://gateway` on Container Apps, where internal apps listen on port 80 by name.
- The gateway runs with at most one replica, because its "already generating" locks are in memory.
- Container Apps ends an HTTP request after 240 seconds. The AI read streams, and on 2 vCPU it finishes well within that.
- To remove everything: `az group delete -n ayu-aca-rg`.
