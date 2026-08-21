---
sidebar_position: 1
title: Introduction
description: What W'xOps is, why it exists, and how it makes the full project lifecycle self-documenting.
---

# W'xOps Portal

An Internal Developer Portal built on Kubernetes-native tooling. One login,
one catalog, one place to scaffold, observe, and manage services across
environments.

![W'xOps platform landscape — stakeholders, the WxIDP portal, and the WxInfrastructure/WxPlatform planes](./assets/wxops-landscape.png|750x500)

## Why This Exists

In the AI era, a developer can scaffold, implement, and ship a service in a
single day. The bottleneck isn't writing code anymore — it's **context**.

When a new team member joins on day 2, they inherit a system built on day 1
by someone who may have already moved on. Without a portal, they ask:
_"What is this service? Why was it built this way? What does it depend on?
Is it running? Where are the secrets? Who owns it?"_

The answers live in Slack threads, meeting notes, tribal knowledge, and
half-written wikis. They rot within weeks.

W'xOps Portal makes the **entire project lifecycle self-documenting**:

| Day-2 question | Portal answers with |
|---|---|
| What is this service? | Catalog entity: description, owner, system, type |
| Why was it built this way? | RFC and ADR docs linked via `relatedTo` |
| What template was used? | Scaffold info card: template-id, scaffold date |
| What does it depend on? | Relationships: dependsOn, consumesApis |
| Is it running? | ArgoCD sync status via Pinniped (per environment) |
| What version is deployed? | CI/CD card: latest image tags per branch |
| Where are the secrets? | Vault path annotation (write-only, no exposure) |
| How do I operate it? | Runbook doc linked to the component |
| Who owns it? | Owner field → team, with team members listed |
| What happened before I joined? | Activity feed: PRs, promotions, config changes |

## How It Fits Together

| System | Role | Portal interaction |
|---|---|---|
| **Gitea** | Git hosting, CI/CD, container registry | Read repos/commits/PRs/workflow runs. Write: create repos, commit files, open PRs |
| **Vault** | Secret management | Write-only: create/update secrets. No read, no delete |
| **Pinniped** | SSO + K8s auth | User login (OIDC/PKCE), session forwarded to K8s for cluster reads |
| **ArgoCD** | GitOps continuous delivery | Read Application CRs via K8s API (sync status, health, deployed images) |
| **Crossplane** | Infrastructure provisioning | XTenantApp, XTenantDatabase CRs; read status via K8s API |
| **Kubernetes** | Runtime platform | Read-only from portal — pods, services, ingress status via Pinniped credentials |

## Core Features

### Service Catalog

A registry of all services, APIs, databases, teams, and documentation. Catalog
data lives in `gitops-infra/service-catalog/` as Backstage-compatible YAML. The
portal reads it via Gitea API with a 5-minute cache — no catalog server required.

→ [Service Catalog](/docs/catalog/service-catalog)

### Golden-Path Scaffolding

One-click project creation from curated templates. The portal creates a Gitea
repo, XTenantApp manifests, catalog entities, Vault secrets, and a gitops-infra
PR — all from a single form. ArgoCD picks up the merge; Crossplane provisions.

→ [Golden Path](/docs/scaffolding/golden-path)

### Lifecycle Promotion

PR-driven, role-gated promotion from `experimental` through `development`,
`staging`, and `production`. The Promotion panel on each Component detail page
manages overlays, shows open PRs, and tracks deployed image tags per environment.

### Darlane (Inner-Loop Debug)

On-demand parallel debug pods provisioned by the XTenantApp Composition. Sync
files live with `wxops darlane sync`, mirror production traffic via Mirrord, exec
directly — without touching the main deployment.

→ [Darlane](/docs/darlane/overview)

### `wxops` CLI

Terminal access to login, catalog browsing, service debugging, file sync, and
pod restart — without direct Gitea or Kubernetes credentials.

→ [CLI Reference](/docs/cli/overview)

### Multi-Cluster Access

One Pinniped login, all spoke clusters. The portal proxies K8s reads using the
user's own token — RBAC controls what each user sees; no service accounts needed
on spokes.

→ [Architecture](/docs/concepts/architecture)
