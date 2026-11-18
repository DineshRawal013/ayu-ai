#!/usr/bin/env bash
# One-time Azure setup for the Container Apps deploy. Run it yourself in Azure Cloud Shell (Bash),
# signed in as the subscription owner:   bash deploy/azure/bootstrap.sh
#
# It creates only what the GitHub workflow can't make for itself:
#   - resource group, container registry (ACR, Basic) and a pull identity with AcrPull
#   - an Entra app that GitHub Actions signs in as (OIDC, no password), Contributor on the group
# Then it prints the GitHub secrets to add. Safe to run again: it reuses what already exists.
# The apps, Postgres and network come later, from infra/main.bicep, when the workflow runs.
set -euo pipefail

REPO="${REPO:-DineshRawal013/ayu-ai}"          # GitHub owner/name, case as on GitHub
RG="${RG:-ayu-aca-rg}"
LOCATION="${LOCATION:-koreacentral}"
GH_ENVIRONMENT="${GH_ENVIRONMENT:-azure-aca}"  # GitHub environment the deploy jobs use
APP_NAME="${APP_NAME:-ayu-ai-github-aca}"
IDENTITY="${IDENTITY:-ayu-aca-pull}"

SUB=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)
echo "==> Subscription $SUB, resource group $RG in $LOCATION"

echo "==> Registering resource providers (first time takes a few minutes)"
for p in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL \
         Microsoft.OperationalInsights Microsoft.Network Microsoft.ManagedIdentity; do
  az provider register --namespace "$p" --wait
done

az group create -n "$RG" -l "$LOCATION" -o none
RG_ID=$(az group show -n "$RG" --query id -o tsv)

echo "==> Container registry"
ACR=$(az acr list -g "$RG" --query "[0].name" -o tsv)
if [ -z "$ACR" ]; then
  ACR="ayuacr$(echo -n "$SUB/$RG" | sha1sum | cut -c1-10)"
  az acr create -g "$RG" -n "$ACR" --sku Basic -o none
fi
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
echo "    $ACR"

echo "==> Pull identity for the container apps"
az identity create -g "$RG" -n "$IDENTITY" -o none
PULL_PRINCIPAL=$(az identity show -g "$RG" -n "$IDENTITY" --query principalId -o tsv)
az role assignment create --assignee-object-id "$PULL_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope "$ACR_ID" -o none 2>/dev/null || echo "    (AcrPull already assigned)"

echo "==> Entra app for GitHub Actions (OIDC)"
CLIENT_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
fi
az ad sp show --id "$CLIENT_ID" -o none 2>/dev/null || az ad sp create --id "$CLIENT_ID" -o none

SUBJECT="repo:${REPO}:environment:${GH_ENVIRONMENT}"
if ! az ad app federated-credential list --id "$CLIENT_ID" --query "[].subject" -o tsv | grep -qx "$SUBJECT"; then
  az ad app federated-credential create --id "$CLIENT_ID" -o none --parameters "{
    \"name\": \"github-${GH_ENVIRONMENT}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
fi

# Contributor on this resource group only: enough to deploy the Bicep and push to ACR.
SP_ID=$(az ad sp show --id "$CLIENT_ID" --query id -o tsv)
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$RG_ID" -o none 2>/dev/null || echo "    (Contributor already assigned)"

cat <<EOF

Done. In GitHub: Settings > Environments > New environment "${GH_ENVIRONMENT}", then add these
environment secrets (or repository secrets):

  AZURE_CLIENT_ID          ${CLIENT_ID}
  AZURE_TENANT_ID          ${TENANT}
  AZURE_SUBSCRIPTION_ID    ${SUB}
  AZURE_POSTGRES_PASSWORD  a long random password, for example: $(openssl rand -hex 24)

If you changed RG, also add a repository variable AZURE_RESOURCE_GROUP=${RG}.
Then run "Deploy to Azure Container Apps" from the Actions tab.
EOF
