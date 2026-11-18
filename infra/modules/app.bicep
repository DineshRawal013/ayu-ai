// One container app. Every app has HTTP ingress; only the frontend's is public.

param name string
param location string
param environmentId string
param identityId string
param registryServer string
param image string
param targetPort int

@description('true only for the frontend: the one public endpoint, like port 80 on the VM.')
param external bool = false

param cpu string = '0.25'
param memory string = '0.5Gi'
param minReplicas int = 1
param maxReplicas int = 1
param env array = []
param secrets array = []
param probes array = []

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: external
        targetPort: targetPort
        transport: 'http'
        // Internal apps call each other over plain http://<app-name>, inside the environment.
        // Without this, Container Apps redirects those calls to HTTPS.
        allowInsecure: !external
      }
      registries: [
        {
          server: registryServer
          identity: identityId
        }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: env
          probes: probes
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
