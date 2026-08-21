---
sidebar_position: 4
title: Runtime Observability
description: How the portal reads live ArgoCD and Crossplane state with your own credentials, and links into Grafana, Loki, Tempo, Pyroscope and Alertmanager.
---

# Runtime Observability

The portal has always known what *should* be deployed — the overlay in Git, the image
tag written back by ArgoCD Image Updater. Runtime observability closes the loop:
**intended state from Git, observed state from the cluster, and one click into the
signal that explains the difference.**

The Runtime tab on a Component page shows, per environment, whether CD delivered and
whether the platform provisioned — plus what is alerting right now.

## What it reads

| Source | Answers |
|---|---|
| ArgoCD `Application` | Did CD deliver? Sync state, health, the revision that landed, last operation phase |
| Crossplane `XTenantApp` | Did the platform provision it? Created, ready, live URL, running image |

Both are read **as the logged-in user**, using their own Kubernetes credentials via
Pinniped. A user who cannot `kubectl get application` cannot see it in the portal
either — see [Permissions](../security/permissions.md).

### Degraded states are first-class

A missing environment is not a failure. Each cell reports one of:

| State | Meaning |
|---|---|
| `not-found` | Not deployed to this environment yet — normal for an un-promoted service |
| `forbidden` | The RBAC prerequisite below has not been applied — an operator action, not an outage |
| `unreachable` | The cluster or API server did not answer |

One dead cluster degrades only its own cells. An expired session prompts a re-login
rather than painting every environment as down.

## Naming — how an entity maps to cluster objects

All derived from the entity's `gitea/source-location` annotation (`{team}/{app}`),
never from `metadata.name`:

| Object | Name | Where |
|---|---|---|
| ArgoCD `Application` | `{team}-{app}-{env}` | namespace `argocd` |
| `XTenantApp` (dev) | `{team}-{app}` | cluster-scoped |
| `XTenantApp` (staging/production) | `{team}-{app}-{env}` | cluster-scoped |
| Workload namespace | `tenant-{team}` (or `platform`) | — |

`env` is `dev`, `staging`, `production` — **`production`, not `prod`**. The staging and
production overlays patch in a rename so each environment gets a distinct
cluster-scoped object; dev uses the base name unchanged.

Readiness comes from the composition's own `.status.ready` / `.status.created`
write-back — **not** from Crossplane's `Ready` condition, which lags behind reality
due to watch-circuit throttling. A service already serving traffic could otherwise
still show as not-ready.

## RBAC prerequisite

Because reads happen as the user, two bindings per tenant are required:

| Binding | Why |
|---|---|
| `ClusterRoleBinding` → `tenant-platform-reader` | `XTenantApp` is cluster-scoped (Crossplane v2 `scope: Cluster`); a namespaced RoleBinding cannot reach it |
| `RoleBinding` in namespace `argocd` → `aggregate-argoproj-view` | `Application` CRs live in ArgoCD's namespace, not the tenant's |

`tenant-platform-reader` grants **`get` only, not `list`** — the portal reads
composites by exact name, so `list` would add no capability while letting one tenant
enumerate another's composites.

**Until these are applied the panel degrades, it does not break.** Every cell shows
"Cluster RBAC not applied" and the rest of the page is unaffected — the portal has no
privileged fallback credential to reach for.

Manifests and apply steps are in [Production Deployment](../getting-started/deployment.md).

## Configuration

All runtime backend variables — **not** build-time values — so changing a dashboard
URL is a Deployment edit, not a CI rebuild.

| Variable | Default | Purpose |
|---|---|---|
| `ARGOCD_URL` | _(empty)_ | ArgoCD base URL. Empty hides the ArgoCD button. |
| `ARGOCD_NAMESPACE` | `argocd` | Namespace holding `Application` CRs |
| `LGTM_GRAFANA_URL` | _(empty)_ | Grafana base URL. Empty hides all signal links. |
| `LGTM_LOKI_DATASOURCE` | `Loki` | Loki datasource name/uid |
| `LGTM_TEMPO_DATASOURCE` | `Tempo` | Tempo datasource name/uid |
| `LGTM_PROMETHEUS_DATASOURCE` | `prometheus` | Prometheus datasource uid (lowercase in kube-prometheus-stack) |
| `LGTM_PYROSCOPE_DATASOURCE` | `Pyroscope` | Pyroscope datasource name/uid |
| `ALERTMANAGER_URL` | _(empty)_ | Enables the alerts panel. Empty disables it entirely. |

Every link builder returns an empty string when its base URL is unset, and the UI
hides empty links. Full reference in
[Environment Variables](../getting-started/environment-variables.md).

## Deep links — what they actually query

Links open Grafana Explore with the selector already set. They are built from the
labels the platform really emits, so if you change the collector config, change these
too.

**Every query is scoped to a single environment.** Dev, staging and production share
one namespace and one `app` label, so without scoping every panel would blend all
three together. The discriminator is the workload name:

| Environment | Deployment | Pods |
|---|---|---|
| dev | `{app}` | `{app}-…` |
| staging | `{app}-staging` | `{app}-staging-…` |
| production | `{app}-production` | `{app}-production-…` |
| Darlane twin | `{app}-darlane` | `{app}-darlane-…` |

`{app}-` as a prefix matches *everything* in that table — so dev needs an explicit
exclusion, not just a prefix.

**Logs (Loki).** The `app` label is identical across environments, so the `pod`
matcher does the scoping:

```logql
# staging
{namespace="tenant-rocket-team", pod=~"python-demo-staging-.+", app="python-demo"}

# dev — must exclude the other environments and the debug twin
{namespace="tenant-rocket-team", pod=~"python-demo-.+", pod!~"python-demo-(staging|production|darlane)-.+", app="python-demo"}
```

**Traces (Tempo).** `k8s.deployment.name` is already environment-specific, so this is
an exact match:

```traceql
{resource.k8s.namespace.name="tenant-rocket-team" && resource.k8s.deployment.name="python-demo-staging"}
```

`service.name` is deliberately unused — it comes from each application's own OTEL SDK
config, which the platform does not set.

**CPU (Prometheus).** cAdvisor series, per pod:

```promql
sum(rate(container_cpu_usage_seconds_total{namespace="tenant-rocket-team", pod=~"python-demo-staging-.+", container!="", container!="POD"}[5m])) by (pod)
```

**Memory (Prometheus).** Working set, not total usage:

```promql
sum(container_memory_working_set_bytes{namespace="tenant-rocket-team", pod=~"python-demo-staging-.+", container!="", container!="POD"}) by (pod)
```

`container_memory_working_set_bytes` is the figure the kernel OOM killer evaluates
against the limit. `container_memory_usage_bytes` includes reclaimable page cache and
routinely looks alarming for a workload nowhere near being killed — the wrong number
to show someone debugging an OOMKill. Both queries drop the pause container and the
pod-level rollup, which would otherwise double-count.

An environment the platform does not create (`prod`, `qa`, an empty string) produces
**no link at all**, rather than a query that silently matches nothing — or worse,
everything. Names taken from catalog entities are stripped to DNS-1123 characters
before interpolation, so a crafted entity name cannot escape the quoted selector.

## Active alerts

With `ALERTMANAGER_URL` set, the Runtime tab shows what is currently firing for the
service, above the environment panel — *"is this broken right now?"* outranks *"what
is deployed?"*. Alerts are sorted critical-first with severity, firing duration, the
affected pod, and the rule's runbook link.

Deliberately minimal: one read, no silencing or acknowledgement — those stay in
Alertmanager's own UI.

:::note[Filtering]
No alert rule in the platform carries an `app` label today, so the portal queries by
`namespace` and narrows to the service by matching the alert's `pod` label against the
`{app}-` prefix. That covers every environment and the Darlane twin. Alerts with no
`pod` label are namespace-scoped rules and are shown too, since they affect this
service along with everything else in the namespace.
:::

## Network behaviour

For **Grafana, Loki, Tempo and Pyroscope** the portal builds URLs and never follows
them — your browser talks to Grafana using your own Grafana session. No log, metric or
trace data ever transits the portal.

**Alertmanager is the exception.** It is queried server-side, which is why it is
opt-in: read-only, timeout-bounded, result-capped, and disabled unless
`ALERTMANAGER_URL` is set. Enabling it means adding an Alertmanager rule to the
portal's egress NetworkPolicy.

One caveat worth stating plainly: Alertmanager has no Kubernetes RBAC, so **that read
is not user-scoped**. The portal narrows to one tenant in code, which is a correctness
measure rather than a security boundary. Alert payloads carry metadata rather than
application data, and the endpoint still requires an authenticated session — but if
that residual exposure is unacceptable, leave `ALERTMANAGER_URL` unset.

## Application metrics

The metric contract, `ServiceMonitor`/`PodMonitor` emission, the scaffold wizard's
Monitoring toggle, and the shared golden-path dashboard have landed — this section
describes how they fit together. (Code-complete across all four repos as of this writing;
see the [Roadmap](../roadmap/roadmap.md) for release status.)

**The contract.** Every golden-path template (Go, Node.js, Python) emits the same three
metrics from a real Prometheus client library, not a hand-rolled `/metrics`:

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | counter | `method`, `path`, `status` |
| `http_request_duration_seconds` | histogram | `method`, `path` |
| `http_requests_in_flight` | gauge | — |

`path` is always the route *pattern* (`/healthz`), never the raw URL — Prometheus runs
platform-wide with no cluster-wide cardinality limits, so a raw-path label degrades
monitoring for every tenant, not just the offending service.

**Turning it on.** Monitoring is a checkbox in the scaffold wizard and Edit Config, same
tier as Darlane. Enabling it sets `spec.parameters.monitoring.enabled` on the `XTenantApp`
— the composition emits a real `ServiceMonitor` (or `PodMonitor` when the workload has no
Service) carrying the `release: kube-prometheus-stack` label Prometheus Operator selects
on, plus a per-monitor `sampleLimit`. `prometheus.io/scrape` pod annotations are no longer
used anywhere in the golden path — Prometheus Operator ignores them without an
`additionalScrapeConfig`, which this platform doesn't run.

**The dashboard.** One Grafana dashboard, keyed on the contract metric names — P95/P99
latency, error rate, request rate, and in-flight saturation — parameterized by
`$namespace`/`$app`/`$env` so it works for every golden-path service with no per-team
configuration.

:::note[`$env` is a naming convention, not a real label yet]
The `ServiceMonitor` sets no `targetLabels`, so environment isn't a scrapeable Prometheus
label today — dev, staging and production share one namespace, distinguished only by an
`appName` suffix. The dashboard's `$env` variable is regex-derived from that suffix. A real
`environment` label is a tracked fast-follow, not yet done.
:::

## Known limitations

Stated plainly, because a link that silently returns nothing is worse than one you
knew was approximate. All are platform-side.

| Limitation | Consequence |
|---|---|
| Prometheus `sampleLimit` is per-`ServiceMonitor` from the composition; `targetLimit` / `labelLimit` are still `0` cluster-wide | A tenant cannot raise their own sample cap, but a high-cardinality label from an unrelated cluster-wide target can still degrade monitoring platform-wide |
| The collector stamps a fixed `cluster` label | Log links cannot be scoped per cluster in a multi-cluster estate |
| Alerts carry no `app` label | Narrowing is by `pod` prefix, as described above |
| Alertmanager's receiver is `null` | Alerts are visible in the portal and Grafana but route nowhere — no paging |
| Only traces flow through the collector's OTLP pipeline | OTLP logs and metrics sent to it are dropped |
| No GPU exporter deployed | GPU utilisation metrics do not exist |
| Observability endpoints are global, not per-cluster | One Grafana for every registered cluster |

## Reference

- [Cluster Registry](./cluster-registry.md) — how spoke clusters are discovered
- [Production Deployment](../getting-started/deployment.md) — RBAC manifests and apply steps
- [Environment Variables](../getting-started/environment-variables.md) — full configuration reference
- [Permissions](../security/permissions.md) — the role model behind these reads
