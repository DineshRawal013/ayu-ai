// Ayu AI on Azure Container Apps: the same services as docker-compose.yml, one container app each.
//
//   frontend     public HTTPS (*.azurecontainerapps.io), proxies /api to the gateway
//   gateway      internal, the only app that reaches Postgres
//   health-svc, kundali-svc, ai-svc, ollama   internal
//   Postgres     Azure Database for PostgreSQL Flexible Server, private (VNet only)
//
// The registry (ACR) and the pull identity are created once by 6-deployment/azure/bootstrap.sh,
// so images can be pushed before this file is deployed. Deployed by .github/workflows/deploy-aca.yml.

targetScope = 'resourceGroup'

param location string = resourceGroup().location

@description('Short prefix for resource names.')
param prefix string = 'ayu'

@description('Existing container registry (made by bootstrap.sh).')
param acrName string

@description('Existing user-assigned identity with AcrPull on the registry (made by bootstrap.sh).')
param identityName string = 'ayu-aca-pull'

@description('Tag of the five app images (the commit SHA).')
param imageTag string

@description('Tag of the ayu-ai-ollama image (changes only when 4-implementation/ollama/ changes).')
param ollamaImageTag string

param ollamaModel string = 'qwen2.5:1.5b'

@description('0 (default) lets Ollama scale to zero when idle: cheap, but the first AI read after a quiet spell waits a few minutes. 1 keeps it running (about 45 USD a month more).')
@minValue(0)
@maxValue(1)
param ollamaMinReplicas int = 0

@description('Minimum replicas of the small apps (frontend, gateway, health-svc, kundali-svc, ai-svc). 0 (default) scales them to zero, so the first visit after a quiet spell takes 10 to 30 seconds. 1 keeps them running (about 40 USD a month more).')
@minValue(0)
@maxValue(1)
param appMinReplicas int = 0

@description('Postgres compute. Some subscriptions (e.g. student ones) can\'t use every SKU in every region; check with: az postgres flexible-server list-skus -l <region>')
param postgresSkuName string = 'Standard_B1ms'

@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param postgresSkuTier string = 'Burstable'

param postgresUser string = 'ayu'
param postgresDb string = 'ayu'

@secure()
@description('From the AZURE_POSTGRES_PASSWORD GitHub secret. Never stored in the repo.')
param postgresPassword string

param nominatimUserAgent string = 'AyuAI/1.0 (https://github.com/DineshRawal013/ayu-ai)'

var suffix = uniqueString(resourceGroup().id)
var pgServerName = '${prefix}-pg-${suffix}'

// ---------- existing (bootstrap.sh) ----------

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: identityName
}

// ---------- network: the apps' subnet and a private subnet for Postgres ----------

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: '${prefix}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.40.0.0/16']
    }
    subnets: [
      {
        name: 'apps'
        properties: {
          addressPrefix: '10.40.0.0/23'
          delegations: [
            {
              name: 'aca'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
      {
        name: 'postgres'
        properties: {
          addressPrefix: '10.40.2.0/28'
          delegations: [
            {
              name: 'pg'
              properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
            }
          ]
        }
      }
    ]
  }
}

var appsSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'apps')
var pgSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'postgres')

resource pgDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${pgServerName}.private.postgres.database.azure.com'
  location: 'global'
}

resource pgDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: pgDns
  name: '${prefix}-vnet-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

// ---------- Postgres (replaces the postgres container and its pgdata volume) ----------

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: pgServerName
  location: location
  sku: {
    name: postgresSkuName
    tier: postgresSkuTier
  }
  properties: {
    version: '16'
    administratorLogin: postgresUser
    administratorLoginPassword: postgresPassword
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: {
      delegatedSubnetResourceId: pgSubnetId
      privateDnsZoneArmResourceId: pgDns.id
    }
  }
  dependsOn: [pgDnsLink]
}

resource pgDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pg
  name: postgresDb
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ---------- Container Apps environment ----------

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: appsSubnetId
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ---------- apps ----------

var registry = acr.properties.loginServer

// Probes replace the Dockerfile HEALTHCHECKs, which Container Apps ignores.
func httpProbes(path string, port int) array => [
  {
    type: 'Startup'
    httpGet: { path: path, port: port }
    periodSeconds: 10
    failureThreshold: 10
  }
  {
    type: 'Liveness'
    httpGet: { path: path, port: port }
    periodSeconds: 30
    timeoutSeconds: 10
    failureThreshold: 5
  }
  {
    type: 'Readiness'
    httpGet: { path: path, port: port }
    periodSeconds: 15
    timeoutSeconds: 5
    failureThreshold: 3
  }
]

module ollama 'modules/app.bicep' = {
  name: 'app-ollama'
  params: {
    location: location
    environmentId: env.id
    identityId: pullIdentity.id
    registryServer: registry
    name: 'ollama'
    image: '${registry}/ayu-ai-ollama:${ollamaImageTag}'
    targetPort: 11434
    // qwen2.5:1.5b needs about 2 GB of RAM; 4 GiB leaves room for two requests at once.
    cpu: '2'
    memory: '4Gi'
    minReplicas: ollamaMinReplicas
    maxReplicas: 1
    env: [
      { name: 'OLLAMA_MODEL', value: ollamaModel }
      { name: 'OLLAMA_KEEP_ALIVE', value: '24h' }
      { name: 'OLLAMA_NUM_PARALLEL', value: '2' }
    ]
    // Only the server has to answer here; the warm-up runs in the background.
    probes: [
      {
        type: 'Startup'
        tcpSocket: { port: 11434 }
        periodSeconds: 10
        failureThreshold: 10
      }
      {
        type: 'Liveness'
        httpGet: { path: '/', port: 11434 }
        periodSeconds: 30
        timeoutSeconds: 10
        failureThreshold: 5
      }
    ]
  }
}

module healthSvc 'modules/app.bicep' = {
  name: 'app-health-svc'
  params: {
    location: location
    environmentId: env.id
    identityId: pullIdentity.id
    registryServer: registry
    name: 'health-svc'
    image: '${registry}/ayu-ai-health-svc:${imageTag}'
    targetPort: 3001
    minReplicas: appMinReplicas
    maxReplicas: 3
    probes: httpProbes('/healthz', 3001)
  }
}

module kundaliSvc 'modules/app.bicep' = {
  name: 'app-kundali-svc'
  params: {
    location: location
    environmentId: env.id
    identityId: pullIdentity.id
    registryServer: registry
    name: 'kundali-svc'
    image: '${registry}/ayu-ai-kundali-svc:${imageTag}'
    targetPort: 3002
    cpu: '0.5'
    memory: '1Gi'
    minReplicas: appMinReplicas
    maxReplicas: 3
    probes: httpProbes('/healthz', 3002)
  }
}

module aiSvc 'modules/app.bicep' = {
  name: 'app-ai-svc'
  params: {
    location: location
    environmentId: env.id
    identityId: pullIdentity.id
    registryServer: registry
    name: 'ai-svc'
    image: '${registry}/ayu-ai-ai-svc:${imageTag}'
    targetPort: 3003
    minReplicas: appMinReplicas
    maxReplicas: 2
    env: [
      { name: 'OLLAMA_URL', value: 'http://ollama' }
      { name: 'OLLAMA_MODEL', value: ollamaModel }
    ]
    probes: httpProbes('/healthz', 3003)
  }
}

module gateway 'modules/app.bicep' = {
  name: 'app-gateway'
  params: {
    location: location
    environmentId: env.id
    identityId: pullIdentity.id
    registryServer: registry
    name: 'gateway'
    image: '${registry}/ayu-ai-gateway:${imageTag}'
    targetPort: 3000
    cpu: '0.5'
    memory: '1Gi'
    minReplicas: appMinReplicas
    // The "already generating" locks live in the gateway's memory: one replica only.
    maxReplicas: 1
    secrets: [
      { name: 'pg-password', value: postgresPassword }
    ]
    env: [
      // Password in PGPASSWORD, not in the URL, as on the VM. verify-full: TLS to Azure Postgres.
      { name: 'DATABASE_URL', value: 'postgres://${postgresUser}@${pg.properties.fullyQualifiedDomainName}:5432/${postgresDb}?sslmode=verify-full' }
      { name: 'PGPASSWORD', secretRef: 'pg-password' }
      { name: 'HEALTH_URL', value: 'http://health-svc' }
      { name: 'KUNDALI_URL', value: 'http://kundali-svc' }
      { name: 'AI_URL', value: 'http://ai-svc' }
      { name: 'NOMINATIM_USER_AGENT', value: nominatimUserAgent }
    ]
    // TCP, not /api/status: that route calls every service and Ollama, and would keep them awake.
    probes: [
      {
        type: 'Startup'
        tcpSocket: { port: 3000 }
        periodSeconds: 10
        failureThreshold: 10
      }
      {
        type: 'Liveness'
        tcpSocket: { port: 3000 }
        periodSeconds: 30
        failureThreshold: 5
      }
    ]
  }
  dependsOn: [pgDatabase, healthSvc, kundaliSvc, aiSvc]
}

module frontend 'modules/app.bicep' = {
  name: 'app-frontend'
  params: {
    location: location
    environmentId: env.id
    identityId: pullIdentity.id
    registryServer: registry
    name: 'frontend'
    image: '${registry}/ayu-ai-frontend:${imageTag}'
    targetPort: 80
    external: true
    minReplicas: appMinReplicas
    maxReplicas: 3
    env: [
      // Internal apps are reached on port 80 by name; see the template in 4-implementation/frontend/nginx.conf.
      { name: 'GATEWAY_URL', value: 'http://gateway' }
    ]
    probes: httpProbes('/', 80)
  }
  dependsOn: [gateway]
}

output url string = 'https://${frontend.outputs.fqdn}'
output postgresServer string = pg.properties.fullyQualifiedDomainName
