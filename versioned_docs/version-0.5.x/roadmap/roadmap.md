---
sidebar_position: 1
title: Roadmap
description: What shipped, what's next, and what's on the backlog for W'xOps Portal.
---

# Roadmap

Living document — updated as features ship. Compressed on purpose: full per-feature
detail gets written up as the docs site itself gets refined, not all at once here.

## What Shipped

| Version | Headline |
|---|---|
| v0.1.0 | Identity & multi-cluster SSO via Pinniped |
| v0.1.1–v0.1.4 | CI/CD pipeline, full service catalog, catalog UI refinements |
| v0.2.0–v0.2.1 | Golden-path scaffolding, config-via-PR, lifecycle webhook |
| v0.3.0–v0.3.1 | Lifecycle promotion UI, command palette, dark theme |
| v0.4.0–v0.4.3 | `wxops` CLI + Darlane per-environment debug pods, CLI download proxy |
| v0.5.0 | Runtime Observability — live ArgoCD & Crossplane status, Grafana deep links, active alerts |
| v0.5.1 | Observability Completion — real application metrics (per-language Prometheus contract, `ServiceMonitor` emission, a Monitoring toggle that now actually works — the previous version silently did nothing, wrong Prometheus wiring — and one shared dashboard). Also: a catalog completeness score, and a rebuilt CI/releases/dependencies view with search, filters, and real pagination for teams shipping daily. |

Full history in the [release notes](/release-notes), which cover every version from v0.1.0.

## What's Next

| Version | Status | Headline |
|---|---|---|
| v0.6.0 | Planned | Refactor, modularization, and the first public open-source cut — Helm chart and Docker image for a self-serve quickstart. |
| Beyond v0.6.0 | Adoption-driven, not scheduled | Security & compliance, SRE & incident response, developer experience, cross-tenant visibility, multi-cluster. |

## Backlog

Not scheduled — every row targets **Next**, meaning it has no committed version yet.
None of these are rejected or deprioritized; they're waiting on the same thing: real
usage after the source opens. Once adopters are actually running the platform, which
of these get pulled forward is decided by what they actually hit friction on, not by
guessing now.

| Feature | What it covers |
|---|---|
| Cross-Tenant Dependency Visibility | "Consumed by" (API entities) / "Used by" (Resource entities) reverse-dependency views, plus a blast-radius check before deprecating something shared across teams |
| CLI Extensions | `wxops scaffold new` (interactive project creation from the CLI, mirroring the portal wizard) and `wxops darlane enable` (write Darlane config, open the PR, without leaving the terminal) |
| Inner-Loop Sync Transport | Replacing `darlane sync`'s `kubectl exec tar` (blocked on distroless/scratch images) with a transport that works everywhere — rsync, a sidecar file-receiver, or gRPC/WebSocket streaming, in increasing order of complexity |
| Documentation Collaboration | A single accountable-person field on entities, cross-tenant RFC review notifications, a doc coverage report (which Components have no ADR or runbook), full-text search inside doc content |
| Platform Quality | A full scaffold → CI → ArgoCD → promotion end-to-end test, a SOC2-ready audit trail (who promoted what, with approval chain), a production-readiness scorecard, Vault/RBAC/pod-security compliance status |
| Guardian & SRE Intelligence | Darlane's longer-term direction — a scanner that checks synced files for CVEs/secrets before hot-reload, a tamper-evident session audit log, and the log/metric/trace correlation wiring an SRE agent would need to validate a fix before opening a PR |
| DORA-lite Metrics | Deployment frequency and lead time, per service. **Blocked on a product decision, not engineering time**: nothing in the portal records a timestamped "reached production" event today — only current-state snapshots exist — so lead time needs either an accepted proxy-timestamp approximation or new background poll-and-diff infrastructure. Deployment frequency alone is buildable without that decision. |
| Per-Service Alert Scoping | Adding a real `app` label to alert rules so the portal can match a service's alerts exactly instead of guessing from the pod-name prefix. **Blocked on two decisions**: confirming an Operator config flag, and — the real gate — which alerts actually get per-tenant treatment. The wiring itself (a new `PrometheusRule` alongside the already-shipped `ServiceMonitor`) is understood; the content isn't decided. |

## Architecture Decisions

| Decision | Resolution |
|---|---|
| Scaffold default lifecycle | `experimental` — catalog entity only, no overlay generated |
| Promotion to staging/prod | Platform-team or team `Managers` only — security gate |
| Portal cluster access | User's own Pinniped token — RBAC-scoped, zero extra credentials |
| Portal writes to cluster | Never — all config changes go through Gitea PR |
| Vault from portal | Create/update only — no reads, no deletes |
| Catalog source of truth | Git (Gitea), not a portal database |
| No Backstage runtime | Borrow YAML schema only — keeps stack to Go + Next.js |
