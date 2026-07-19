---
sidebar_position: 2
title: Catalog Entity Guide
description: How to write catalog entity YAML for services, APIs, resources, teams, and users.
---

# Catalog Entity Guide

## Required Fields

Every entity must have:

```yaml
apiVersion: backstage.io/v1alpha1   # always this exact value
kind: Component                      # see table below
metadata:
  name: my-service                   # lowercase, hyphen-separated
spec:
  owner: group:org/team-name        # "group:" prefix required
  lifecycle: experimental            # starting state
```

## Component

Use for services, libraries, jobs, CLIs, or websites.

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-api
  description: "Stripe-compatible payment processing for checkout flows."
  tags:
    - go
    - grpc
  annotations:
    wxops.cloud/scaffold-template: go-grpc-service
    wxops.cloud/scaffold-date: "2025-06-10"
    wxops.cloud/gitea-repo: wxops/payment-api
    wxops.cloud/vault-path: wxops/payment-api/dev
    wxops.cloud/lifecycle: development
spec:
  type: service           # service | library | website | tool | database | pipeline | ML model
  lifecycle: development
  owner: group:wxops/rocket-team
  system: payments
  providesApis:
    - payment-api-v1
  dependsOn:
    - resource:payment-db
    - component:identity-service
  consumesApis:
    - notification-api-v1
```

### `wxops.cloud/` annotations reference

| Annotation | Required | Description |
|---|---|---|
| `wxops.cloud/scaffold-template` | No | Template ID used to create this service |
| `wxops.cloud/scaffold-date` | No | ISO date when scaffold was run |
| `wxops.cloud/gitea-repo` | No | `org/repo` for repo links and CI/CD card |
| `wxops.cloud/vault-path` | No | `org/appName/env` — Vault KV path prefix. Never exposes secrets. |
| `wxops.cloud/lifecycle` | No | Current lifecycle override (also in `spec.lifecycle`) |

## API

Use for OpenAPI, gRPC, GraphQL, or async APIs.

```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: payment-api-v1
  description: "gRPC API for payment operations."
  annotations:
    wxops.cloud/gitea-repo: wxops/payment-api
    wxops.cloud/openapi-path: api/openapi.yaml    # relative path in repo
spec:
  type: openapi         # openapi | grpc | graphql | asyncapi
  lifecycle: development
  owner: group:wxops/rocket-team
  system: payments
  definition: |
    openapi: "3.0.0"
    info:
      title: Payment API
      version: "1.0.0"
    paths: {}
```

When `wxops.cloud/openapi-path` is set, the portal fetches the spec from
Gitea at render time and shows an interactive Swagger UI on the API detail page.

## Resource

Use for databases, object stores, queues, Vault paths, or external services.

```yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: payment-db
  description: "PostgreSQL for payments bounded context."
  annotations:
    wxops.cloud/vault-path: wxops/payment-api/dev
spec:
  type: database        # database | s3 | queue | messaging | cache | external-service
  lifecycle: development
  owner: group:wxops/rocket-team
  system: payments
  dependsOn:
    - component:payment-api
```

:::warning[vault-path naming]
The portal derives `appName` from the vault-path annotation using segment `[1]`
(`org/appName/env`). Resource entities are named `{appName}-vault` in the catalog —
never use `entity.metadata.name` to look up the Vault path.
:::

## System

A logical product boundary that groups related Components and APIs.

```yaml
apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: payments
  description: "End-to-end payment processing platform."
spec:
  owner: group:wxops/rocket-team
  domain: ecommerce
```

## Group

A team or org unit. Gitea org/teams become Groups automatically via the
`{org}:{team}` → `group:{org}/{team}` mapping.

```yaml
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: rocket-team
  description: "Payment and checkout domain team."
spec:
  type: team            # team | department | organization | temporary
  profile:
    displayName: "Rocket Team"
    email: rocket-team@example.com
  parent: wxops
  children: []
  members:
    - user:alice
    - user:bob
```

## User

A team member. Pinniped sessions produce an `email` claim — the portal
strips `@domain` to get the username for catalog entity references.

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: alice                    # email prefix, not full email
  description: "Backend engineer on Rocket Team."
spec:
  profile:
    displayName: "Alice Smith"
    email: alice@example.com
    picture: https://avatars.example.com/alice
  memberOf:
    - group:wxops/rocket-team
```

## Document

An RFC, ADR, or Runbook linked to a Component.

```yaml
apiVersion: backstage.io/v1alpha1
kind: Document
metadata:
  name: rfc-001-payment-retry-strategy
  description: "Retry strategy for payment gateway failures."
  annotations:
    wxops.cloud/gitea-repo: wxops/payment-api
    wxops.cloud/doc-path: docs/rfcs/001-retry-strategy.md
spec:
  type: rfc             # rfc | adr | runbook
  lifecycle: active
  owner: group:wxops/rocket-team
  system: payments
  relatedTo:
    - component:payment-api
```

The portal fetches the Markdown from Gitea and renders it on the entity page
with syntax highlighting and Mermaid diagram support.

## Common Mistakes

| Mistake | Correct form |
|---|---|
| `owner: rocket-team` | `owner: group:wxops/rocket-team` |
| `dependsOn: payment-db` | `dependsOn: - resource:payment-db` |
| Naming a Resource entity `payment-api-vault` | Entity name in catalog can be anything; Vault path is derived from the annotation |
| Exposing gitops-infra PR URLs in descriptions | PR links to gitops-infra are internal — use titles/status only |
