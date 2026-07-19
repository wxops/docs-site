---
sidebar_position: 1
title: API Reference
description: REST API endpoints exposed by the W'xOps Portal Go backend.
---

# API Reference

All endpoints are served by the Go backend at `/api/v1/`. In production,
nginx routes `/api/v1/*` → Go `:8080` and `/api/*` → Next.js BFF. The Go
backend validates the `wxops_session` cookie on all endpoints except `/healthz`.


## Authentication

All endpoints require a valid `wxops_session` cookie. Endpoints that need
elevated privileges (lifecycle promotion, platform-only actions) also check
the Pinniped group claims extracted from the session token.

```
Cookie: wxops_session=<opaque session token>
```


## Catalog

### List entities

```http
GET /api/v1/catalog/entities
```

Query params:

| Param | Example | Description |
|---|---|---|
| `kind` | `Component` | Filter by entity kind |
| `system` | `payments` | Filter by system |
| `owner` | `rocket-team` | Filter by owner team |
| `lifecycle` | `development` | Filter by lifecycle |
| `q` | `payment` | Full-text search |

Response:

```json
[
  {
    "apiVersion": "backstage.io/v1alpha1",
    "kind": "Component",
    "metadata": {
      "name": "payment-api",
      "description": "...",
      "annotations": { ... }
    },
    "spec": {
      "type": "service",
      "lifecycle": "development",
      "owner": "group:wxops/rocket-team",
      "system": "payments"
    }
  }
]
```

### Get entity

```http
GET /api/v1/catalog/entities/{kind}/{name}
```

Returns the full entity YAML deserialized as JSON.


## Scaffold

### Create project

```http
POST /api/v1/scaffold
Content-Type: application/json
```

Request body:

```json
{
  "templateId": "go-http-service",
  "appName": "payment-api",
  "description": "Payment processing service",
  "team": "rocket-team",
  "namespace": "tenant-wxops",
  "features": {
    "database": true,
    "externalSecrets": true,
    "ingress": false
  }
}
```

Response (SSE stream — `text/event-stream`):

```
event: step
data: {"step": "create_repo", "status": "in_progress", "message": "Creating Gitea repository..."}

event: step
data: {"step": "create_repo", "status": "complete", "message": "Created wxops/payment-api"}

event: step
data: {"step": "create_vault_secret", "status": "complete", "message": "Vault secret initialized at wxops/payment-api/dev"}

event: step
data: {"step": "open_gitops_pr", "status": "complete", "message": "PR #42 opened in gitops-infra"}

event: done
data: {"prStatus": "open", "repoUrl": "https://gitea.example.com/wxops/payment-api"}
```

### List templates

```http
GET /api/v1/scaffold/templates
```

Returns available scaffold templates from the `scaffold-templates` repository.


## Clusters

### List clusters

```http
GET /api/v1/clusters
```

Returns clusters the current user has access to (derived from Pinniped groups).

```json
[
  {
    "id": "dev-east",
    "name": "Development East",
    "apiServer": "https://api.dev-east.example.com:6443",
    "status": "Ready"
  }
]
```

### Get pods

```http
GET /api/v1/clusters/{clusterId}/namespaces/{namespace}/pods
```

Returns pods in the namespace, using the user's Pinniped-issued cluster token.

### Get deployments

```http
GET /api/v1/clusters/{clusterId}/namespaces/{namespace}/deployments
```

### Restart deployment

```http
POST /api/v1/clusters/{clusterId}/namespaces/{namespace}/deployments/{name}/restart
```


## Lifecycle Promotion

### Get promotion state

```http
GET /api/v1/catalog/entities/{kind}/{name}/promotion
```

Returns current lifecycle, open PRs, and deployed image tags per environment.

### Create overlay PR

```http
POST /api/v1/catalog/entities/{kind}/{name}/promotion
Content-Type: application/json
```

Request body:

```json
{
  "targetLifecycle": "staging",
  "overlayConfig": {
    "replicas": 2,
    "resources": {
      "requests": { "cpu": "200m", "memory": "256Mi" },
      "limits": { "cpu": "1000m", "memory": "1Gi" }
    },
    "ingress": {
      "host": "payment-api.staging.example.com"
    }
  }
}
```

Role check: `platform-team` or `{team}:Managers` required for `staging`/`production`.


## Webhooks

### Catalog cache refresh

```http
POST /api/v1/webhooks/catalog/refresh
Authorization: Bearer <WEBHOOK_TOKEN>
```

Invalidates the in-memory catalog cache. Wire this to a Gitea push webhook
on `gitops-infra`. The portal will re-fetch all entity YAML on the next request.

Response: `204 No Content`


## CLI Binary Download

### List available versions

```http
GET /api/v1/cli/releases
```

### Download binary

```http
GET /api/v1/cli/download/{os}/{arch}
```

| `{os}` | `{arch}` |
|---|---|
| `linux` | `amd64`, `arm64` |
| `darwin` | `amd64`, `arm64` |
| `windows` | `amd64` |

The endpoint proxies the binary from the Gitea release attachment of the latest
`wxops-*` release tag.


## Health

### Liveness

```http
GET /healthz
```

Returns `200 OK` when the Go process is alive (no auth required).

### Readiness

```http
GET /readyz
```

Returns `200 OK` when the portal can reach Gitea. Returns `503` during startup
or when the Gitea connection is unhealthy.
