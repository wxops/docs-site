---
sidebar_position: 4
title: Platform Features
description: What XTenantApp supports — Kubernetes features, databases, and Vault secrets — and when each is configured.
---

# Platform Features

The scaffold wizard creates an `XTenantApp` and, when enabled, an `XTenantDatabase`.
These two Crossplane XRs are how tenant apps declare what Kubernetes-level features
they need without writing raw Deployment or StatefulSet manifests.

This page covers every supported feature, how it maps to the XR spec, and whether
it belongs in the **scaffold wizard** (project-level, environment-agnostic) or the
**Promotion panel** (per-environment, patched by each overlay).


## Two Tiers: Base vs Overlay

```
tenants-apps/{team}/{appName}/
  base/
    xtenant-app.yaml          ← platform feature toggles: ingress, TLS, probes,
                                 rollout strategy, monitoring, secrets
  overlays/dev/
    patch-xtenant-app.yaml    ← env-specific values: replicas, resources,
                                 ingress host, cert issuer, DB name/tier
```

**The scaffold wizard writes only the base.** It declares which features are
on or off for the project. The Promotion panel later fills in the env-specific
values — replicas, resource limits, ingress hostnames — as JSON 6902 patches
on top of the base.


## Kubernetes Features

### Container Config

| Field | Description | Set at |
|---|---|---|
| `containerPort` | HTTP port your app listens on | Scaffold wizard |
| `image` | `{registry}/{team}/{appName}:latest` — ArgoCD Image Updater takes over after first deploy | Scaffold (base) |
| `imagePullSecrets` | Defaults to `["regcred"]` — the cluster's registry pull secret | Scaffold (base) |
| `env` | Plain (non-secret) environment variables, key/value | Scaffold wizard |
| `podAnnotations` | Extra pod annotations; monitoring annotations added here if enabled | Scaffold wizard |

### Replicas & Resources

Set per environment via the Promotion panel — they do not belong in the base because
dev and production have different sizing requirements.

```yaml
# overlays/production/patch-xtenant-app.yaml
- op: replace
  path: /spec/parameters/replicas
  value: 3
- op: replace
  path: /spec/parameters/resources
  value:
    requests: { cpu: "250m", memory: "256Mi" }
    limits:   { cpu: "1",    memory: "512Mi" }
```

### Health Probes

Enable liveness and readiness probes in the scaffold wizard by providing the
HTTP paths. The composition injects these as `httpGet` probes against `containerPort`.

```yaml
spec:
  parameters:
    probes:
      liveness:
        enabled: true
        path: /healthz
      readiness:
        enabled: true
        path: /ready
```

The `startup` probe is available for apps with slow cold-starts but is not
exposed in the scaffold wizard — add it manually to the base YAML after scaffolding
if needed.

| Field | Type | Default |
|---|---|---|
| `path` | string | required when enabled |
| `periodSeconds` | int | composition default |
| `failureThreshold` | int | composition default |

### Ingress

The ingress feature toggle lives in the **base** — it declares that the app is
HTTP-reachable. The hostname and cert issuer are **overlay-specific** and are
set by the Promotion panel when creating each environment overlay.

**Scaffold wizard toggles (go into base):**

| Toggle | Effect |
|---|---|
| `ingressEnabled: true` | Turns on the Ingress resource |
| `certManager: true` | Adds TLS block; `clusterIssuer` set per env via Promote |
| `ssoAuth: true` | Adds auth annotation; requires an OAuth2 proxy on the cluster |

**Overlay patch (set by Promotion panel):**

```yaml
- op: add
  path: /spec/parameters/ingress/host
  value: payment-api.dev.wxops.cloud
- op: add
  path: /spec/parameters/ingress/tls/clusterIssuer
  value: letsencrypt-staging
```

### Rollout Strategy

Default is `RollingUpdate`. Set `rolloutType` in the scaffold wizard to override:

| Value | When to use |
|---|---|
| `RollingUpdate` | Default; zero-downtime rolling replacement |
| `Recreate` | Apps that cannot run two versions concurrently (database schema changes) |
| `Canary` | Gradual traffic split; requires Darlane traffic weight config |

```yaml
spec:
  parameters:
    rolloutStrategy:
      type: Recreate
```

### Secret Reloader

When enabled, the composition adds a `Reloader` annotation that tells
[Stakater Reloader](https://github.com/stakater/Reloader) to restart pods
whenever the referenced ConfigMap or Secret changes. Enable in the scaffold wizard:

```yaml
spec:
  parameters:
    reloader:
      enabled: true
```

This is safe to leave on in all environments — Reloader is a no-op if the secret
doesn't change.

### Monitoring (Prometheus)

Enable `monitoringEnabled` in the scaffold wizard. The composition adds pod
annotations that Prometheus uses for service discovery:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

`metricsPath` defaults to `/metrics`. Set it in the scaffold wizard if your app
exposes metrics on a different path.

### Darlane (Debug Pods)

Darlane debug pods are **not configured at scaffold time**. They are injected
per-environment as an overlay patch through the Promotion panel UI or `wxops debug`.

See the [Darlane documentation](/docs/darlane/debug) for the full patch format,
traffic routing, file sync, and TTL configuration.


## Database

When the scaffold wizard's database option is enabled, the backend generates an
`XTenantDatabase` CR alongside the `XTenantApp`.

### Project-Level Config (Base)

Only settings that don't change between environments belong in the base:

| Field | Description |
|---|---|
| `spec.parameters.owner` | Postgres role owner — set to the team name |
| `spec.parameters.extensions` | Postgres extensions to install; defaults to `["uuid-ossp", "pgcrypto"]` |
| `spec.parameters.vaultSecretStoreName` | Always `vault-tenant` — the ClusterSecretStore on spoke clusters |

```yaml
apiVersion: platform.wxops.cloud/v1alpha1
kind: XTenantDatabase
metadata:
  name: rocket-team-payment-api-db
spec:
  parameters:
    owner: rocket-team
    extensions: [uuid-ossp, pgcrypto, pg_trgm]
    vaultSecretStoreName: vault-tenant
```

### Per-Environment Config (Overlay via Promote)

The Promotion panel adds these fields as JSON 6902 patches to each environment's
`kustomization.yaml`. None of them belong in the base.

| Field | Description | Example (dev) |
|---|---|---|
| `dbName` | Database name inside the cluster | `payment-api-dev` |
| `tier` | Cluster size preset: `micro`, `small`, `medium`, `large` | `micro` |
| `environment` | Used by the composition to select the right CNPG config | `dev` |
| `clusterRef` | Name of the shared CNPG cluster to attach to | `shared-pg-dev` |

For production workloads that cannot share a CNPG cluster, use `dedicatedCluster`:

```yaml
- op: add
  path: /spec/parameters/dedicatedCluster
  value:
    instances: 2
    storageSize: 50Gi
    postgresVersion: 16
    enablePooler: true
```

### Database Reclaim Policy

`databaseReclaimPolicy` controls what happens to the Postgres database object
when the `XTenantDatabase` XR is deleted. Default is `Retain` — the composition
keeps the database alive even after the XR is gone. This prevents accidental
data loss. Set to `Delete` only for ephemeral test environments.

:::warning[Never set `databaseReclaimPolicy: Delete` in staging or production]
The portal does not expose this field in the UI. Edit the base YAML directly
only if you need it for a short-lived environment.
:::


## Vault Secrets

Vault integration works through [External Secrets Operator](https://external-secrets.io/)
rather than direct Vault API calls. The scaffold generates `ExternalSecret` CRs
that pull secrets from Vault and materialise them as K8s Secrets on the spoke
cluster. The portal writes to Vault but **never reads or deletes** secrets.

### App Secrets

Enable `vaultSecrets` in the scaffold wizard. The ExternalSecret targets:

```
Vault path:    {team}/{appName}/env
K8s Secret:    {appName}-env
```

The `XTenantApp` mounts this secret when `secretsFrom.app.enabled: true`:

```yaml
spec:
  parameters:
    secretsFrom:
      app:
        enabled: true
```

Populate `{team}/{appName}/env` in Vault with any key/value pairs your app
reads as environment variables. The ExternalSecret syncs on a 1-minute interval.

### Database Credentials

Enable `databaseSecrets` in the scaffold wizard. The ExternalSecret targets:

```
Vault path:    {team}/databases/{appName}-db/connection-creds
K8s Secret:    {appName}-db-creds
```

The `XTenantApp` mounts this secret when `secretsFrom.database.enabled: true`:

```yaml
spec:
  parameters:
    secretsFrom:
      database:
        enabled: true
        # secretName defaults to {appName}-db-creds; set explicitly if different
```

The `XTenantDatabase` composition writes the connection string into this Vault
path after provisioning the database. No manual Vault writes needed.

### Vault Path Conventions

| Secret type | Vault path | K8s Secret name |
|---|---|---|
| App env vars | `{team}/{appName}/env` | `{appName}-env` |
| DB credentials | `{team}/databases/{appName}-db/connection-creds` | `{appName}-db-creds` |
| Custom DB name | `{team}/databases/{dbName}/connection-creds` | `{dbName}-creds` |

:::info[Write-only model]
The portal can write secrets to Vault (during scaffold and config updates) but
never reads them back and never deletes them. This is a security constraint —
secrets flow into the cluster via ExternalSecret, not through the portal UI.
:::


## Feature Reference

Quick reference for what belongs where:

| Feature | Scaffold wizard | Promotion panel |
|---|---|---|
| Container port | ✓ base | — |
| Env vars (plain) | ✓ base | — |
| Pod annotations | ✓ base | — |
| Liveness / readiness probe | ✓ base | — |
| Ingress enabled | ✓ base | — |
| TLS / cert-manager | ✓ base | — |
| SSO auth | ✓ base | — |
| Rollout strategy | ✓ base | — |
| Secret reloader | ✓ base | — |
| Prometheus monitoring | ✓ base | — |
| VaultSecrets / DatabaseSecrets | ✓ base | — |
| DB extensions | ✓ base | — |
| Replicas | — | ✓ overlay patch |
| CPU / memory resources | — | ✓ overlay patch |
| Ingress hostname | — | ✓ overlay patch |
| TLS ClusterIssuer | — | ✓ overlay patch |
| DB name, tier, environment | — | ✓ overlay patch |
| DB clusterRef | — | ✓ overlay patch |
| Darlane debug pod | — | ✓ overlay patch |
