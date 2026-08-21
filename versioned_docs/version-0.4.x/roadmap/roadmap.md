---
sidebar_position: 1
title: Roadmap
description: What shipped, what's next, and what's on the backlog for W'xOps Portal.
---

# Roadmap

Living document — updated as features ship.

## What Shipped

| Version | Headline | Status |
|---|---|---|
| v0.1.0 | Identity & multi-cluster SSO via Pinniped | `shipped` |
| v0.1.1–v0.1.2 | CI/CD pipeline, health probes, operations readiness | `shipped` |
| v0.1.3 | Full service catalog — 7 entity kinds, OpenAPI rendering, dependency graphs | `shipped` |
| v0.1.4 | Catalog UI refinements — Mermaid zoom, graph polish | `shipped` |
| v0.2.0 | Golden-path scaffolding, config-via-PR, lifecycle webhook, activity feed | `shipped` |
| v0.2.1 | Image Updater naming fix, nginx routing fix, Vault update from catalog | `shipped` |
| v0.3.0 | Lifecycle promotion UI, FlexSearch command palette, dark theme (Dracula) | `shipped` |
| v0.3.1 | Entity detail two-column layout, documentation drawer, build-time version stamping | `shipped` |
| v0.4.0 | `wxops` CLI binary + Darlane per-environment parallel debug pods | `shipped` |
| v0.4.1 | `darlane sync` delete propagation, kubectl companion cluster view, CLI download proxy | `shipped` |

---

## Next — v0.5.0: Runtime Observability

Live environment status from ArgoCD and Crossplane via Pinniped, plus lightweight
observability that links into the existing LGTM stack rather than duplicating it.

> **Scope decision:** The portal surfaces context, not dashboards. Native log/metric/trace
> viewers are explicitly out of scope — Grafana's signal correlation (Explore, exemplars,
> profiling) cannot be replicated cheaply. The portal's value is generating pre-scoped
> deep links from catalog context so developers land on the right view in one click.

### ArgoCD & Crossplane status

- Read ArgoCD `Application` CRs using the user's Pinniped token (RBAC-scoped, no
  service account needed). Application name derived from entity + env suffix:
  `{team}-{appName}-{env}`.
- Shows sync status, health, deployed image, and last deploy time inline on the
  entity detail page.
- Read `XTenantApp` / `XTenantDatabase` `.status.conditions` via the same auth —
  provisioning state, sync status, connection details.

### Environment status panel

Side-by-side environment card per overlay (dev / staging / production):

| Column | Source |
|---|---|
| Intended state | Git overlay in `gitops-infra` |
| Observed state | ArgoCD Application CR on cluster |
| Image tag | ArgoCD sync + Image Updater annotation |
| Last deploy | ArgoCD `status.operationState.finishedAt` |

Two sources, one view — no context switching between Gitea and ArgoCD.

### Active alerts

Single Alertmanager API call per service: `GET /api/v2/alerts?filter={app="name"}`.
Shows firing alerts with severity, duration, and runbook link. The one observability
signal worth surfacing natively: **is this service broken right now?**

### Grafana / Loki / Tempo deep links

Pre-scoped links built from catalog context — service name, namespace, team, env label
selectors. One click → Grafana Explore with the right filter already set.

Configured via env vars (`LGTM_GRAFANA_URL`, `LGTM_LOKI_URL`, `LGTM_TEMPO_URL`);
entity annotations can override per-service.

### Catalog quality

- **Completeness score** — per-entity quality score (description, owner, tags, links,
  lifecycle, API spec). Scaffolded entities score well by default.
- **DORA-lite metrics** — deployment frequency (prod workflow runs / week) and lead
  time (PR open → merge → image tag) computed from data already in the portal.

---

## Next — v0.6.0: Guardian & SRE Intelligence

Platform-injected safety and autonomous incident response — the next evolution of
Darlane from a developer tool into a full agent-ready execution platform.

> **Scope decision:** Guardian is opt-in per session, never mandatory. The
> platform team enables it cluster-wide; developers and agents benefit without
> configuration. SRE Agent is a pattern the platform enables, not a product —
> the agent is implemented by the team; the platform provides the wiring.

### Guardian Framework

Lightweight sidecars injected into Darlane pods that provide scanning, session
auditing, and (in a future release) AI code review — without requiring developer
action.

| Feature | Description |
|---|---|
| **Guardian Scanner** | Watches the `fileSync` volume for file changes and runs Trivy (CVE), Semgrep/gosec/Bandit (SAST), and secret-pattern detection before the app hot-reloads. Findings written as pod annotations, surfaced inline on the Darlane panel. Two modes: `advisory` (log + annotate) and `enforcement` (block hot-reload on critical findings). |
| **Guardian Audit** | Structured session log of every exec command, file write, network connection, and K8s API call made by the darlane pod's `ServiceAccount`. Ships to Loki under `job=guardian-audit`. Events signed with the cluster's Pinniped-issued workload identity — tamper-evident, SOC2-ready. Session summary emitted on TTL expiry and attached to agent PRs as chain-of-custody evidence. |
| **Guardian Intelligence Proxy** *(preview)* | LLM review sidecar that intercepts `fileSync` writes before the app processes them. Detects backdoors, credential exfiltration patterns, supply chain injection, security regressions, and prompt injection in AI apps. Advisory mode annotates and proceeds; enforcement mode holds the write pending human approval via portal notification. |

### SRE Agent — Intelligence Model

Autonomous incident response built on the Darlane execution platform and the
platform's existing observability stack. No new infrastructure required — the
agent reads signals the platform already collects.

| Feature | Description |
|---|---|
| **Signal correlation** | Agent ingests Loki error traces, Prometheus/Mimir metrics (latency, error rate, saturation), Tempo distributed call chains, Kubernetes events (OOM, evictions), and the Guardian audit log (recent changes, identity) — all correlated within the same time window as the firing alert. |
| **LLM hypothesis formation** | Agent forms ranked hypotheses from correlated signals, generates a targeted fix for the top hypothesis, and logs its reasoning chain. Hypothesis text is included in the PR body so reviewers can understand the decision, not just the change. |
| **Security-specific reasoning** | Agent recognises auth cascade failures (Vault token renewal failure → 401 storm), privilege escalation attempts (unexpected identity in Guardian audit), and credential leaks in injected code (Guardian Scanner blocks these before hot-reload). |
| **Validated-fix PR** | Agent injects fix into darlane via `fileSync`, mirrors production traffic read-only via mirrord, measures outcome in Prometheus. PR body includes full evidence chain: signals observed → hypothesis → fix → validation metrics → Guardian session log link. Reviewers approve a validated fix, not a guess. |
| **Guardian safety contract** | SRE Agent sessions always run with `guardian.enabled: true`. Guardian Audit logs every agent action under its dedicated `ServiceAccount` identity. Guardian Scanner validates each injected diff before the app reloads. K8s RBAC + audit log + static analysis makes autonomous execution safe to approve. |

---

## Backlog

Not scheduled. Prioritized by real usage feedback.

### Cross-Tenant Dependency Visibility

Today the catalog shows relationships in one direction — a Component lists who it depends
on. The provider side has no visibility, which creates a blind spot for breaking-change
impact analysis.

| Feature | Description |
|---|---|
| "Consumed by" on API entities | API detail lists all Components (across all tenants) that declare `consumesApis` pointing here — owner sees who is affected by a breaking change |
| "Used by" on Resource entities | Resource detail lists all Components that declare `dependsOn` — blast-radius visibility before modifying or deprecating a shared resource |
| Cross-tenant dependency graph | System Mermaid graph extended to show edges crossing team boundaries (dashed arrows), with opt-in visibility control |
| Breaking-change blast radius | Deprecating an API shows "N components across M teams consume this" before confirming |

### CLI Extensions

| Feature | Description |
|---|---|
| `wxops scaffold new` | Interactive project creation from CLI — mirrors the portal wizard |
| `wxops darlane enable` | Write Darlane config and open PR from CLI |

### Inner-Loop Sync Transport

`darlane sync` currently uses `kubectl exec tar xf -` — simple, zero daemon, but
blocked by distroless/scratch images. Planned options:

| Transport | Distroless | Delta | Complexity |
|---|---|---|---|
| rsync over `kubectl exec` | ✗ | Yes (byte-level) | Low |
| Sidecar file-receiver agent | ✓ | No | Medium |
| gRPC streaming agent | ✓ | Yes | High |
| WebSocket relay through portal | ✓ | Yes | High |

### Documentation Collaboration

| Feature | Description |
|---|---|
| PIC field on entities | `spec.pic: user:alice` — single accountable person, distinct from the owning team |
| Cross-tenant RFC review notification | Portal flags RFCs pending review on the consuming team's Group page |
| Doc coverage report | Which Components have zero ADRs? Which have no runbook? |
| Full-text search inside doc content | Extend catalog search to reach inside markdown content, not just entity metadata |

### Platform Quality

| Feature | Description |
|---|---|
| E2E scaffold test | Full scaffold → CI trigger → ArgoCD sync → lifecycle promotion cycle (deferred until XTenantApp Composition is stable) |
| Audit trail | SOC2-ready: who promoted what, when, with approval chain |
| Scorecard / maturity | Production readiness checklist (monitoring, docs, tests, SLOs) |
| Compliance status | Vault policy coverage, RBAC audit, pod security per namespace |

---

## Architecture Decisions

Key decisions that shape all future work.

| Decision | Resolution |
|---|---|
| Scaffold default lifecycle | `experimental` — catalog entity only, no overlay generated |
| Promotion to staging/prod | Platform-team or team `Managers` only — security gate |
| Portal cluster access | User's own Pinniped token — RBAC-scoped, zero extra credentials |
| Portal writes to cluster | Never — all config changes go through Gitea PR |
| Vault from portal | Create/update only — no reads, no deletes |
| Catalog source of truth | Git (Gitea), not a portal database |
| Gitops PR URLs | Not exposed to developers — devs don't have gitops-infra access |
| No Backstage runtime | Borrow YAML schema only — keeps stack to Go + Next.js |
| Native log/metric viewers | Out of scope — Grafana handles correlation; portal generates deep links |
