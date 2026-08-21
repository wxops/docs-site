---
sidebar_position: 6
title: XTenantApp
description: Full field reference for the XTenantApp Crossplane XR — Deployment, Service, IngressRoute, Darlane twin, and optional Certificate.
---

# XTenantApp

Tenant application scaffold — provisions a `Deployment` + `Service` +
optional `IngressRoute` + optional `ServiceAccount` for an application workload,
following `app.kubernetes.io/*` label conventions.

`tenant-app` deliberately stops at the application workload. Vault-backed secrets
and databases ([XTenantDatabase](./xtenant-database)) are provisioned separately
and referenced via `secretsFrom`.

| | |
|---|---|
| **Group** | `platform.wxops.cloud` |
| **Kind** | `XTenantApp` |
| **Plural** | `xtenantapps` |
| **Scope** | `Cluster` |
| **API version** | `v1alpha1` (served, storage) |
| **Composition function** | `function-kcl` |

## What it composes

| Composed resource | Condition |
|---|---|
| `Deployment` | Always |
| `Service` | `service.enabled: true` (default) |
| `IngressRoute` (Traefik) | `ingress.enabled: true` |
| `TraefikService` (weighted split) | `darlane.trafficWeight > 0` |
| `Certificate` (cert-manager) | `ingress.tls.clusterIssuer` set |
| `ServiceAccount` | `serviceAccount.create: true` |
| `PersistentVolumeClaim` | `volumes[].create: true` |
| Darlane `Deployment` (`<app>-dev`) | `darlane.enabled: true` |


## `spec.parameters`

### Core identity

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `appName` | `string` | yes | | Application name. Used as `Deployment`/`Service`/`IngressRoute` name and `app.kubernetes.io/name` label. |
| `namespace` | `string` | yes | | Target namespace for all composed resources. |
| `environment` | `string` | | `"dev"` | One of `dev`, `staging`, `prod`. Applied as `wxops.cloud/environment` label — metadata for dashboards and Kyverno policies; does not affect composed resource behavior. |
| `appFlavor` | `string` | | `"webapp"` | One of `webapp`, `ai`, `ai-webapp`, `geo-webapp`, `search-webapp`. Applied as `wxops.cloud/app-flavor` label for platform automation (e.g. selecting pgvector/postgis extensions). Does not affect this XR's composed resources. |
| `templateId` | `string` | | | Scaffold template identifier. Applied as `wxops.cloud/template-id` annotation for catalog linking. |
| `repository.url` | `string` | | | Source repository URL. Applied as `wxops.cloud/repo-url` annotation. |

### Container

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `image` | `string` | yes | | Container image reference (`repository:tag`). Use the single-string form so ArgoCD Image Updater can target it via Kustomize image-transformer. |
| `imagePullPolicy` | `string` | | `"IfNotPresent"` | One of `Always`, `IfNotPresent`, `Never`. |
| `imagePullSecrets` | `array<string>` | | `[]` | Names of existing `kubernetes.io/dockerconfigjson` Secrets in the target namespace. |
| `replicas` | `integer` | | `1` | |
| `containerPort` | `integer` | | `8080` | |
| `terminationGracePeriodSeconds` | `integer` | | `30` | Seconds between SIGTERM and SIGKILL. Increase for apps with long-running requests or connection draining. |
| `resources` | `object` | | | `requests`/`limits` × `cpu`/`memory`, passed through verbatim. |
| `env` | `array<{name, value}>` | | `[]` | Plain (non-secret) environment variables. |
| `envFrom` | `array<{secretRef\|configMapRef: {name}}>` | | `[]` | Additional `envFrom` sources, merged after `secretsFrom`-managed refs. |
| `podAnnotations` | `object` | | `{}` | Annotations on the pod template (e.g. Prometheus scraping). |
| `deploymentAnnotations` | `object` | | `{}` | Extra annotations on the `Deployment` metadata. |
| `labels` | `object` | | `{}` | Extra labels on all composed resources. Standard `app.kubernetes.io/*` and `wxops.cloud/*` labels always win — selectors depend on them. |
| `command` | `array<string>` | | image default | Override container `ENTRYPOINT`. |
| `args` | `array<string>` | | image default | Override container `CMD`. |

### `rolloutStrategy`

| Field | Type | Default | Description |
|---|---|---|---|
| `rolloutStrategy.type` | `string` | `"RollingUpdate"` | One of `RollingUpdate`, `Recreate`. |
| `rolloutStrategy.rollingUpdate.maxSurge` | `string\|integer` | `"25%"` | Only when `type: RollingUpdate`. |
| `rolloutStrategy.rollingUpdate.maxUnavailable` | `string\|integer` | `"25%"` | Only when `type: RollingUpdate`. |

### `serviceAccount`

| Field | Type | Default | Description |
|---|---|---|---|
| `serviceAccount.create` | `boolean` | `false` | If true, compose a new `ServiceAccount` in the target namespace. |
| `serviceAccount.name` | `string` | `appName` | SA name. When `create: false`, must reference an existing SA. |
| `serviceAccount.annotations` | `object` | `{}` | Annotations on the created SA. Use for workload identity bindings (`eks.amazonaws.com/role-arn`, `iam.gke.io/gcp-service-account`). Ignored when `create: false`. |

### `securityContext`

Pod-level fields apply to all containers; container-level fields apply to the main app container (and darlane when enabled).

| Field | Type | Default | Description |
|---|---|---|---|
| `securityContext.runAsNonRoot` | `boolean` | | Pod-level. Require all containers to run as non-root. |
| `securityContext.runAsUser` | `integer` | | Pod-level. UID for all containers. |
| `securityContext.runAsGroup` | `integer` | | Pod-level. Primary GID for all containers. |
| `securityContext.fsGroup` | `integer` | | Pod-level. GID applied to mounted volumes. |
| `securityContext.readOnlyRootFilesystem` | `boolean` | | Container-level. Mount root filesystem read-only. |
| `securityContext.allowPrivilegeEscalation` | `boolean` | | Container-level. Set `false` for hardened workloads. |
| `securityContext.capabilities.drop` | `array<string>` | `[]` | Container-level. Capabilities to drop. Use `["ALL"]` for the recommended baseline. |
| `securityContext.capabilities.add` | `array<string>` | `[]` | Container-level. Capabilities to add back (e.g. `["NET_BIND_SERVICE"]`). |

### `secretsFrom`

Wires `envFrom.secretRef` entries by name. This XR only adds the reference — it
does not provision or wait for the Secret. The Deployment will fail to start
(`CreateContainerConfigError`) until referenced Secrets exist.

| Field | Type | Default | Description |
|---|---|---|---|
| `secretsFrom.app.enabled` | `boolean` | `false` | Adds `envFrom.secretRef` → `secretsFrom.app.secretName`. |
| `secretsFrom.app.secretName` | `string` | `"{appName}-env"` | Name of the app env Secret. |
| `secretsFrom.database.enabled` | `boolean` | `false` | Adds `envFrom.secretRef` → `secretsFrom.database.secretName`. |
| `secretsFrom.database.secretName` | `string` | `"{appName}-db-creds"` | Name of the database credentials Secret, written by `XTenantDatabase`. |

### `reloader`

| Field | Type | Default | Description |
|---|---|---|---|
| `reloader.enabled` | `boolean` | `false` | Adds `reloader.stakater.com/auto: "true"` to the Deployment. Triggers a rolling restart when referenced ConfigMaps/Secrets change. Requires [Stakater Reloader](https://github.com/stakater/Reloader) in-cluster. |

### `volumes`

Mount volumes into the main app container. Supply exactly one discriminator per entry.

| Discriminator | Source |
|---|---|
| `claimName` | `PersistentVolumeClaim` — reference existing, or create with `create: true` |
| `configMapName` | Named `ConfigMap` |
| `secretName` | Named `Secret` |

| Field | Type | Default | Description |
|---|---|---|---|
| `volumes[].name` | `string` | required | Volume name. |
| `volumes[].mountPath` | `string` | required | Absolute mount path inside the container. |
| `volumes[].subPath` | `string` | | Subpath within the volume. |
| `volumes[].readOnly` | `boolean` | `false` | |
| `volumes[].claimName` | `string` | | PVC name. Mutually exclusive with `configMapName`/`secretName`. |
| `volumes[].create` | `boolean` | `false` | If true, compose a new PVC named `claimName`. |
| `volumes[].storageClass` | `string` | | StorageClass for the new PVC. Required when `create: true`. |
| `volumes[].size` | `string` | | PVC capacity (e.g. `"10Gi"`). Required when `create: true`. |
| `volumes[].accessModes` | `array<string>` | `["ReadWriteOnce"]` | Only used when `create: true`. |
| `volumes[].configMapName` | `string` | | Name of an existing ConfigMap. Mutually exclusive with `claimName`/`secretName`. |
| `volumes[].secretName` | `string` | | Name of an existing Secret. Mutually exclusive with `claimName`/`configMapName`. |
| `volumes[].items[]` | `array` | | Key-to-path projections. Each entry: `{key, path}`. |

### `service`

| Field | Type | Default | Description |
|---|---|---|---|
| `service.enabled` | `boolean` | `true` | |
| `service.type` | `string` | `"ClusterIP"` | One of `ClusterIP`, `NodePort`, `LoadBalancer`. |
| `service.port` | `integer` | `80` | Service port. `targetPort` is always `containerPort`. |

### `probes`

HTTP GET probes against `containerPort`. `liveness` and `readiness` default to enabled when `service.enabled` is true — implementing `GET /healthz` and `GET /readyz` on `containerPort` is a **golden-path contract** for all scaffolded services.

| Field | Type | Default | Description |
|---|---|---|---|
| `probes.liveness.enabled` | `boolean` | `service.enabled` | |
| `probes.liveness.path` | `string` | `"/healthz"` | |
| `probes.liveness.initialDelaySeconds` | `integer` | `10` | |
| `probes.liveness.periodSeconds` | `integer` | `10` | |
| `probes.liveness.timeoutSeconds` | `integer` | `1` | |
| `probes.liveness.failureThreshold` | `integer` | `3` | |
| `probes.readiness.enabled` | `boolean` | `service.enabled` | |
| `probes.readiness.path` | `string` | `"/readyz"` | |
| `probes.readiness.initialDelaySeconds` | `integer` | `5` | |
| `probes.readiness.periodSeconds` | `integer` | `10` | |
| `probes.readiness.timeoutSeconds` | `integer` | `1` | |
| `probes.readiness.failureThreshold` | `integer` | `3` | |
| `probes.startup.enabled` | `boolean` | `false` | Gates liveness/readiness until the first successful check. Useful for slow-starting apps. |
| `probes.startup.path` | `string` | `"/healthz"` | |
| `probes.startup.periodSeconds` | `integer` | `10` | |
| `probes.startup.failureThreshold` | `integer` | `30` | |

### `ingress`

`ingress.enabled: true` always emits a Traefik `IngressRoute` — never a standard `Ingress`. This is required for `darlane.trafficWeight` to switch between a plain `Service` and a `TraefikService` weighted split with zero downtime.

| Field | Type | Default | Description |
|---|---|---|---|
| `ingress.enabled` | `boolean` | `false` | Emits a Traefik `IngressRoute`. |
| `ingress.host` | `string` | | **Required when `enabled: true`.** Used as the hostname in the Traefik `Host(...)` match rule on the `IngressRoute`. |
| `ingress.path` | `string` | `"/"` | URL path prefix used in the Traefik `PathPrefix(...)` match rule. |
| `ingress.annotations` | `object` | `{}` | Merged onto `IngressRoute` metadata. |
| `ingress.tls.enabled` | `boolean` | `false` | Sets `entryPoints: [websecure]` and `spec.tls.secretName`. |
| `ingress.tls.secretName` | `string` | `"{appName}-tls"` | TLS Secret name. When `clusterIssuer` is set, cert-manager writes into this name. |
| `ingress.tls.clusterIssuer` | `string` | | If set (and `tls.enabled`), emits a cert-manager `Certificate` CR. cert-manager auto-provisions the Secret. Requires cert-manager and the named `ClusterIssuer` in-cluster. |
| `ingress.auth.enabled` | `boolean` | `false` | Adds `auth-errors` and `forward-auth-redirect` Traefik `Middleware` references — SSO via oauth2-proxy ForwardAuth. Both `Middleware` CRDs must exist in `kube-system`. |


## `darlane` — debug twin Deployment

When enabled, a second `<appName>-dev` Deployment is created alongside the main one —
same image/env/secrets, scaled to `0` by default, with no `Service`/`IngressRoute` of
its own. Scale it on-demand, route real traffic via `trafficWeight` for A/B testing,
or use `mirrord` CLI directly against the pod for local development with real cluster
env and secrets.

:::tip[Full guide]
[Darlane Overview](../darlane/overview) — exec, file sync, traffic mirroring, A/B testing, and SRE agent workflow.
:::

### Core

| Field | Type | Default | Description |
|---|---|---|---|
| `darlane.enabled` | `boolean` | `false` | |
| `darlane.replicas` | `integer` | `0` | Scale to `1` on-demand to start the debug pod. |
| `darlane.image` | `string` | main `image` | Optional image override. |
| `darlane.command` | `array<string>` | `["sleep", "infinity"]` | Keeps the pod alive for `kubectl exec`/port-forward. |
| `darlane.args` | `array<string>` | | Args override. |
| `darlane.containerPort` | `integer` | main `containerPort` | Override when dev server starts on a different port (e.g. hot-reload on `3000` vs production on `8080`). |
| `darlane.env` | `array<{name,value}>` | `[]` | Extra env vars layered on top of main app env. Darlane values win on key collision. |
| `darlane.resources` | `object` | | Independent resource requests/limits. Omit to inherit main app resources. |
| `darlane.securityContext` | `object` | | Applied on top of main `securityContext`. `readOnlyRootFilesystem` defaults to `false` so `apt`/`pip` installs work. |
| `darlane.productionOverride` | `boolean` | `false` | Required when `environment: prod` to enable darlane — double opt-in, visible in XR diffs. |
| `darlane.ttl` | `string` | | Adds `wxops.cloud/darlane-ttl` annotation (e.g. `"4h"`). Enforcement via separate Kyverno policy. |

### Traffic routing

Route a slice of real `IngressRoute` traffic to the darlane pod. Three controls compose freely.

| Field | Type | Default | Description |
|---|---|---|---|
| `darlane.trafficWeight` | `integer` | `0` | `0` = debug only · `1–99` = A/B split · `100` = full canary. Emits a `ClusterIP` Service + Traefik `TraefikService` weighted split. Requires `ingress.enabled: true`. |
| `darlane.stickySession.enabled` | `boolean` | `false` | Pin browser sessions to the same backend via a Traefik cookie. Requires `trafficWeight > 0`. |
| `darlane.stickySession.cookieName` | `string` | `"darlane-ab"` | Override if multiple apps share the same domain. |
| `darlane.stickySession.secure` | `boolean` | `true` | Set the `Secure` flag (HTTPS only). |
| `darlane.stickySession.sameSite` | `string` | `"lax"` | `lax` · `strict` · `none` (requires `secure: true`). |
| `darlane.headerRouting.enabled` | `boolean` | `false` | Pin requests with a specific header directly to darlane — bypasses `trafficWeight` entirely. Requires `ingress.enabled: true`. |
| `darlane.headerRouting.header` | `string` | | HTTP header name (e.g. `X-Target-Env`). Required when `enabled: true`. |
| `darlane.headerRouting.value` | `string` | | Header value to match (e.g. `darlane`). Required when `enabled: true`. |
| `darlane.telemetryPort` | `integer` | | Emits `{appName}-darlane-telemetry` Service for OTEL/Prometheus. Common: `4317` (gRPC), `4318` (HTTP), `9090`. |

### `darlane.volumes`

Same discriminator pattern as main `volumes[]` — set exactly one of `claimName`, `configMapName`, or `secretName`. PVC creation (`create: true`) is not supported in darlane volumes; reference existing claims only.

| Field | Type | Default | Description |
|---|---|---|---|
| `darlane.volumes[].name` | `string` | required | Volume name. |
| `darlane.volumes[].mountPath` | `string` | required | Absolute mount path. |
| `darlane.volumes[].subPath` | `string` | | Subpath within the volume. |
| `darlane.volumes[].readOnly` | `boolean` | `false` | |
| `darlane.volumes[].claimName` | `string` | | Name of an existing PVC. |
| `darlane.volumes[].configMapName` | `string` | | Name of an existing ConfigMap. |
| `darlane.volumes[].secretName` | `string` | | Name of an existing Secret. |
| `darlane.volumes[].items[]` | `array` | | Key-to-path projections: `{key, path}`. |

### `darlane.serviceAccount`

| Field | Type | Default | Description |
|---|---|---|---|
| `darlane.serviceAccount.create` | `boolean` | `false` | Emits a dedicated `ServiceAccount` named `{appName}-darlane` (or `name`). |
| `darlane.serviceAccount.name` | `string` | `{appName}-darlane` | When `create: false`, must reference an existing SA. |
| `darlane.serviceAccount.annotations` | `object` | `{}` | Workload identity bindings (`eks.amazonaws.com/role-arn`, `iam.gke.io/gcp-service-account`). Ignored when `create: false`. |


## Minimal example

```yaml
apiVersion: platform.wxops.cloud/v1alpha1
kind: XTenantApp
metadata:
  name: payment-api
spec:
  parameters:
    appName: payment-api
    namespace: tenant-wxops
    environment: dev
    image: gitea.example.com/rocket-team/payment-api:dev-2025-01-15_10-30-00-abc1234
    replicas: 2
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        memory: 256Mi
    secretsFrom:
      app:
        enabled: true       # envFrom → payment-api-env
      database:
        enabled: true       # envFrom → payment-api-db-creds
    ingress:
      enabled: true
      host: payment-api.dev.example.com
      tls:
        enabled: true
        clusterIssuer: letsencrypt-prod
    darlane:
      enabled: true
      trafficWeight: 10     # 10% of real traffic to debug pod
```

## See also

- [XTenantDatabase](./xtenant-database) — PostgreSQL database with Vault-backed credentials
- [Darlane Overview](../darlane/overview) — full darlane developer guide
- [Platform Features](../scaffolding/features) — scaffold wizard field mapping (base vs overlay)
- [Crossplane APIs](./crossplane-apis) — package catalog and installation
