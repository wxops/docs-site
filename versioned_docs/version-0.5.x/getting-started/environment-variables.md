---
sidebar_position: 2
title: Environment Variables
description: Full reference for all backend and frontend environment variables in W'xOps Portal.
---

# Environment Variables

## Backend

Copy `backend/.env.example` to `backend/.env` for local development. In
production, pass these as Kubernetes `env:` / `envFrom:` from a Secret.

### Core

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `8080` | | HTTP listen port |
| `FRONTEND_URL` | `http://localhost:3000` | ✅ | CORS allowed origin |
| `SESSION_SECRET` | — | ✅ | 64 hex chars — `openssl rand -hex 32` |
| `DEV_BYPASS_AUTH` | `false` | | Skip OIDC, auto-login as `dev/platform-team`. **Dev only.** |

### OIDC / Pinniped Supervisor

| Variable | Default | Required | Description |
|---|---|---|---|
| `OIDC_ISSUER_URL` | — | ✅ | Pinniped Supervisor `FederationDomain` issuer URL |
| `OIDC_CLIENT_ID` | `wxops-portal` | ✅ | Must start with `client.oauth.pinniped.dev-` |
| `OIDC_CLIENT_SECRET` | — | ✅ | From `OIDCClientSecretRequest` |
| `OIDC_REDIRECT_URI` | `http://localhost:3000/auth/callback` | ✅ | Must match `allowedRedirectURIs` in `OIDCClient` CR |
| `OIDC_SCOPES` | `openid,profile,email,groups,offline_access,pinniped:request-audience` | | `pinniped:request-audience` required for cluster token exchange |
| `OIDC_CA_BUNDLE_FILE` | — | | Path to PEM file for Supervisor TLS CA |
| `OIDC_CA_BUNDLE` | — | | Inline PEM for Supervisor TLS CA |
| `OIDC_TLS_SKIP_VERIFY` | `false` | | Skip TLS verification. **Dev only.** |

### Cluster Registry

| Variable | Default | Required | Description |
|---|---|---|---|
| `CLUSTERS_CONFIG_FILE` | — | | Path to `clusters.json` — skips K8s Secret discovery |
| `CLUSTERS_CONFIG` | — | | Inline JSON cluster list |
| `KUBECONFIG` | — | | Path to hub-cluster kubeconfig. Omit when running in-cluster. |
| `CLUSTER_NAMESPACE` | `wxops-system` | | Namespace where cluster Secrets are stored |

### Service Catalog

| Variable | Default | Required | Description |
|---|---|---|---|
| `GITEA_URL` | — | ✅ (prod) | Base URL — `https://gitea.example.com` |
| `GITEA_TOKEN` | — | ✅ (prod) | Personal access token with `repository` read+write scope |
| `GITEA_CATALOG_OWNER` | — | ✅ (prod) | Org or user that owns the `gitops-infra` repo |
| `GITEA_CATALOG_REPO` | `gitops-infra` | | Repo name containing the service catalog |
| `GITEA_CATALOG_PATH` | `service-catalog` | | Path inside the repo where entity YAML files live |
| `CATALOG_LOCAL_DIR` | — | | Local catalog dir for dev — overrides all `GITEA_CATALOG_*` vars |

### Scaffolding

| Variable | Default | Required | Description |
|---|---|---|---|
| `GITEA_TEMPLATE_OWNER` | *(GITEA\_CATALOG\_OWNER)* | | Org owning the scaffold template repo |
| `GITEA_TEMPLATE_REPO` | `scaffold-templates` | | Repo containing scaffold templates |
| `GITEA_BOT_USERNAME` | — | | CI bot username — added to main branch push whitelist |
| `GITEA_BOT_EMAIL` | — | | CI bot email — substituted into scaffold CI template files |
| `SCAFFOLD_LOCAL_DIR` | — | | Local template dir for dev |

### Vault

The portal only **creates or updates** secrets — never reads or deletes.

| Variable | Default | Required | Description |
|---|---|---|---|
| `VAULT_ADDR` | — | | Vault server address. When empty, Vault write is skipped. |
| `VAULT_TOKEN` | — | | Token with `wxops-portal` policy |
| `VAULT_KV_MOUNT` | `secret` | | KV v2 mount path |

### CLI Download Proxy

| Variable | Default | Required | Description |
|---|---|---|---|
| `GITEA_PORTAL_OWNER` | *(GITEA\_CATALOG\_OWNER)* | | Org that owns the portal release repo |
| `GITEA_PORTAL_REPO` | `wxops-portal-v2` | | Repo where `wxops-*` release binaries are attached |

### Runtime Observability

Added in **v0.5.0**. Every variable is optional — each unset value simply hides its
feature. See [Runtime Observability](../platform/observability.md) for what these drive.

| Variable | Default | Required | Description |
|---|---|---|---|
| `ARGOCD_URL` | _(empty)_ | | ArgoCD base URL. Empty hides the ArgoCD buttons. Replaces the removed `NEXT_PUBLIC_ARGOCD_URL`. |
| `ARGOCD_NAMESPACE` | `argocd` | | Namespace holding `Application` CRs |
| `LGTM_GRAFANA_URL` | _(empty)_ | | Grafana base URL. Empty hides all signal links. |
| `LGTM_LOKI_DATASOURCE` | `Loki` | | Loki datasource name or uid |
| `LGTM_TEMPO_DATASOURCE` | `Tempo` | | Tempo datasource name or uid |
| `LGTM_PROMETHEUS_DATASOURCE` | `prometheus` | | Prometheus datasource uid — lowercase in kube-prometheus-stack |
| `LGTM_PYROSCOPE_DATASOURCE` | `Pyroscope` | | Pyroscope datasource name or uid |
| `ALERTMANAGER_URL` | _(empty)_ | | Enables the active-alerts panel. The portal's only outbound call to an observability backend — leaving it unset disables both the panel and the egress. |

```bash
# In-cluster Alertmanager with kube-prometheus-stack
ALERTMANAGER_URL=http://kube-prometheus-stack-alertmanager.monitoring.svc.cluster.local:9093
```

:::note
Enabling `ALERTMANAGER_URL` adds an outbound destination. Add the matching rule to the
portal's egress NetworkPolicy.
:::

### Catalog Cache Webhook

| Variable | Default | Required | Description |
|---|---|---|---|
| `WEBHOOK_TOKEN` | — | | Shared secret for `Authorization: Bearer` on `POST /api/v1/webhooks/catalog/refresh` |

```bash
# Gitea → gitops-infra → Settings → Webhooks → Add
# URL:     https://<portal-host>/api/v1/webhooks/catalog/refresh
# Header:  Authorization: Bearer <WEBHOOK_TOKEN>
# Trigger: Push events
```

## Frontend

### Runtime variable

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8080` | Internal URL of the Go backend for Next.js SSR |

### Build-time variables

:::warning
These must be passed as `--build-arg` to `docker build`. Passing them at container runtime has no effect — the bundle is already sealed.
:::

| Variable | Build-arg | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_APP_VERSION` | `APP_VERSION` | `0.0.0` | Semver string baked into the portal UI version badge. |

:::info[Removed in v0.5.0]
`NEXT_PUBLIC_ARGOCD_URL` no longer exists. Use the backend variable `ARGOCD_URL`
instead — it is read at runtime and served inside the API response, so changing the
ArgoCD URL is a Deployment edit rather than an image rebuild. Drop the build-arg from
your `docker build` and any CI wiring that passes it.
:::

## Secret management in production

```yaml
envFrom:
  - secretRef:
      name: wxops-portal-secrets   # created by ESO from Vault
env:
  - name: FRONTEND_URL
    value: "https://portal.example.com"
```
