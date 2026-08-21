---
sidebar_position: 1
title: Why W'xOps
description: The one-sentence pitch, what makes it architecturally different, and how it compares to Backstage, Port, and Choreo.
---

# Why W'xOps

## The one-sentence pitch

> One login gives you the portal, `kubectl`, and GitOps —
> no database, no agents, no permission drift.

That sentence is a direct claim about architecture, not marketing copy. Each
piece of it rules out an entire category of operational problems.

## The Problem

Platform engineering teams run into the same wall: developers wait on platform
for cloud resources, secret rotation, and environment promotion. Platform teams
spend half their time answering "what environment is this in?", "where is the
staging secret?", "why didn't my image update?".

The root cause isn't slow processes — it's **missing context at the point of
action**. Everyone is making decisions with incomplete information.

| Without IDP | With W'xOps |
|---|---|
| "Ping platform to find out if the DB exists" | Service catalog: resource status on the entity page |
| "Ask in Slack which secret prefix staging uses" | Vault annotation on the catalog entity |
| "Open Argo separately to check sync status" | ArgoCD status inline, grouped by environment |
| "Read the GitOps PR history to find who promoted to prod" | Activity feed on the component |
| "Clone the gitops-infra repo and hand-edit a YAML overlay" | Promotion panel: one button, role-gated |
| "Find out what template the team used when they scaffolded" | Scaffold info card: template-id, date, commit |

## What makes W'xOps different

### Single binary, zero dependencies

W'xOps ships as a single Go binary with the Next.js frontend embedded inside it.
There is no database, no cache layer, no message queue, no plugin registry. The
entire portal runs in **one container**.

State lives in Git. The portal is stateless — restart it, redeploy it, move it
to a different cluster, and it just reconnects.

### Pinniped: one identity across everything

This is the architectural decision that separates W'xOps from every other IDP.

[Pinniped](https://pinniped.dev) is the open-source Kubernetes-native OIDC
project originally built by VMware.
When a developer logs into W'xOps, they receive a Pinniped-issued token. That
same token works for `kubectl` — no second login, no separate kubeconfig
ceremony, no service accounts to rotate.

The consequence: **there is no portal permission system**. Access control is
Kubernetes RBAC, enforced via `ClusterRoleBinding` on spoke clusters. The portal
reads the groups from the OIDC token and derives what the user can see. Nothing
is stored, nothing can drift.

Other IDPs have a split identity problem: you configure access in the portal
*and* in Kubernetes, and over time they diverge. W'xOps structurally cannot
have that problem.

### Hub-Spoke without agents

W'xOps manages multiple Kubernetes clusters from a single portal. Spoke clusters
register by creating a labelled Secret on the hub — no agent process runs on
spokes, no outbound credential management, no network policy exceptions.

Adding a new cluster is one Secret.

### Portal is read-only — always

W'xOps never writes to a cluster. Config changes go through a Gitea PR. The
portal creates the PR, the team reviews it, ArgoCD syncs it.

This is not a policy — it is a structural guarantee. There is no code path in
the portal that issues a write to the Kubernetes API. Every change has a PR,
a reviewer, and an audit trail in Git.

## How it compares

| | W'xOps | Backstage | Port | Choreo |
|---|---|---|---|---|
| Deployment | Single binary, one container | Node.js + PostgreSQL + plugins | SaaS only | Heavy enterprise platform |
| Database | None — Git is the store | PostgreSQL required | SaaS-managed | Yes |
| Auth | Pinniped OIDC → shared K8s token | Custom plugin per provider | Proprietary | WSO2 Identity |
| K8s permission model | Native RBAC via Pinniped groups | Service accounts + plugin config | Not K8s-native | Managed |
| Multi-cluster | Hub-Spoke, no agents | Per-cluster service accounts | API integration | PaaS-managed |
| Portal writes to cluster | Never — GitOps PRs only | Plugin-dependent | Yes (via integrations) | Yes |
| Self-hosted | Yes | Yes (but complex) | No | Limited |
| Data stays in your infra | Yes | Yes | No | Partial |

## What W'xOps deliberately does not do

| Feature | Reason |
|---|---|
| Direct cluster writes | All config changes must go through a Gitea PR |
| Secret reads | Portal cannot become a secret exfiltration vector |
| Delete operations | Platform team only — never self-service |
| Separate permission system | K8s RBAC via Pinniped already exists |
| Helm rendering | Values files are plain YAML — no wrapper needed |

These aren't missing features. They are deliberate omissions that keep the
attack surface small and the operational model simple.

## When W'xOps is the right choice

- Your team already runs Kubernetes and wants the portal to **extend** it,
  not sit beside it
- You are in a regulated environment where **data must stay inside your
  infrastructure**
- You want a **single login** that works for the portal, `kubectl`, and CI/CD
  tokens — no credential management side project
- You want **zero operational overhead** — no database to back up, no plugin
  ecosystem to maintain, no version matrix to reconcile

## When it might not be

- You need a **broad plugin ecosystem** covering dozens of third-party tools
  today. Backstage wins on breadth.
- You have **500+ services** and need complex graph queries over catalog entities.
  A DB-backed catalog has an edge at that scale.
- Your team is not running Kubernetes and has no plans to. W'xOps is
  Kubernetes-native by design, not an abstraction over it.
