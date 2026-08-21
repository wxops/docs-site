---
sidebar_position: 3
title: Documentation Strategy
description: How ADRs, RFCs, and Runbooks work as first-class catalog entities — schema, repository layout, and portal rendering.
---

# Documentation Strategy

The W'xOps catalog treats documentation as a **first-class entity** (`kind: Doc`) rather than
a wiki page or folder of markdown nobody reads. Every ADR, RFC, and Runbook is version-controlled,
registered with typed metadata, rendered in the portal, and linked to the services it governs.

The result: when a new team member joins, they can open any service and see every architectural
decision, operational procedure, and open proposal — without asking anyone.


## Document Types

### ADR — Architecture Decision Record

Captures a decision that affects system architecture, with context and consequences.
**ADRs are immutable once accepted** — if a decision changes, the old ADR is superseded
by a new one, not edited.

**Lifecycle:** `proposed` → `under-review` → `accepted` → `superseded`

**Naming:** `adr-NNN-short-slug` (e.g. `adr-001-use-kafka-for-events`)

```markdown
# ADR-NNN: <Title>

## Status
Accepted

## Context
What problem are we solving? What constraints exist?

## Decision
What did we decide and why?

## Consequences
What are the trade-offs? What changes as a result?

## Alternatives Considered
What else did we evaluate? Why was it rejected?
```

When an ADR is superseded, set `spec.supersededBy` on the old one pointing to the new ADR.
The portal renders this as a linked decision chain in the entity sidebar.


### RFC — Request for Comments

Proposes a significant change for team-wide discussion before implementation begins.
Unlike ADRs, **RFCs are mutable during review** — the document evolves as feedback arrives.
When accepted, a corresponding ADR is created; the RFC status becomes `accepted`.

**Lifecycle:** `proposed` → `under-review` → `accepted` (or `deprecated` if rejected)

**Naming:** `rfc-NNN-short-slug` (e.g. `rfc-012-multi-cluster-tenancy`)

```markdown
# RFC-NNN: <Title>

## Summary
2-3 sentences: what are you proposing and why?

## Motivation
Why is this change needed?

## Detailed Design
Technical details. Mermaid diagrams supported.

## Drawbacks
Why should we NOT do this?

## Alternatives
Other approaches considered.

## Rollout Plan
Phases, timeline.

## Open Questions
Unresolved items for discussion.
```


### Runbook

Operational procedure for responding to incidents, performing maintenance, or executing
recurring tasks. Runbooks are **living documents** — updated as procedures change.

**Lifecycle:** `accepted` (active) or `deprecated` (replaced)

**Naming:** `runbook-short-slug` (e.g. `runbook-database-failover`)

```markdown
# Runbook: <Title>

## Overview
What does this runbook cover? When should you use it?

## Prerequisites
Access, permissions, tools needed before starting.

## Procedure

### Step 1: <Action>
Copy-pasteable commands. No ambiguity.

## Verification
How do you confirm the procedure worked?

## Rollback
If something goes wrong, how do you undo it?

## Escalation
Who to contact if this runbook doesn't resolve the issue.
```

:::warning[Runbooks must be executable]
During an incident, the on-call engineer needs commands they can paste, not prose to interpret.
Every runbook must have concrete steps, a verification check, and a rollback path.
:::


## Catalog Entity Schema

All documentation uses `kind: Doc` with `apiVersion: wxops.cloud/v1alpha1`.
The catalog YAML lives in `gitops-infra` under `{team}/docs/{name}.yaml`.

### ADR example

```yaml
apiVersion: wxops.cloud/v1alpha1
kind: Doc
metadata:
  name: adr-001-use-kafka-for-events
  title: "ADR-001: Use Kafka for Event Streaming"
  description: "Decision to adopt Kafka as the event backbone for inter-service communication"
  tags: [architecture, messaging]
spec:
  docType: adr
  docStatus: accepted
  owner: group:platform-team
  author: user:alice
  system: event-platform
  relatedTo:
    - component:default/order-service
    - component:default/notification-service
    - resource:default/kafka-cluster
  contentUrl: https://gitea.example.com/platform-team/docs/raw/branch/main/adrs/adr-001-use-kafka-for-events.md
```

### RFC example

```yaml
apiVersion: wxops.cloud/v1alpha1
kind: Doc
metadata:
  name: rfc-012-multi-cluster-tenancy
  title: "RFC-012: Multi-Cluster Tenant Isolation"
  description: "Proposal for dedicated clusters per tenant for compliance-sensitive workloads"
  tags: [architecture, multi-tenancy]
spec:
  docType: rfc
  docStatus: under-review
  draft: true                    # hidden from non-owners until ready
  owner: group:platform-team
  author: user:alice
  relatedTo:
    - system:default/tenant-platform
  contentUrl: https://gitea.example.com/platform-team/docs/raw/branch/main/rfcs/rfc-012.md
```

### Runbook example

```yaml
apiVersion: wxops.cloud/v1alpha1
kind: Doc
metadata:
  name: runbook-database-failover
  title: "Runbook: PostgreSQL Database Failover"
  description: "Step-by-step procedure for failing over a CNPG PostgreSQL cluster"
  tags: [operations, database, incident-response]
spec:
  docType: runbook
  docStatus: accepted
  owner: group:platform-team
  author: user:bob
  relatedTo:
    - resource:default/payments-db
    - resource:default/orders-db
  contentUrl: https://gitea.example.com/platform-team/docs/raw/branch/main/runbooks/database-failover.md
```

### Key field reference

| Field | Values | Notes |
|---|---|---|
| `spec.docType` | `adr` `rfc` `runbook` `documentation` | Never use `documentation` as a catch-all |
| `spec.docStatus` | `proposed` `under-review` `accepted` `deprecated` `superseded` | |
| `spec.draft` | `true` / `false` | `true` hides from all except owner group and platform-team |
| `spec.relatedTo` | `component:` `resource:` `system:` refs | At least one required — orphaned docs are unfindable |
| `spec.contentUrl` | Raw Gitea URL | Must be `/raw/` path, not `/src/` — portal fetches and renders the markdown directly |
| `spec.supersededBy` | `doc:default/<name>` | Set on old ADR when superseded; portal renders the chain |

:::warning[contentUrl must be a raw URL]
```
# Correct — returns plain markdown
https://gitea.example.com/team/repo/raw/branch/main/docs/adr-001.md

# Wrong — returns Gitea HTML page
https://gitea.example.com/team/repo/src/branch/main/docs/adr-001.md
```
:::


## Repository Layout

Documentation content (markdown) and catalog entities (YAML) live in separate places:

```
gitea/platform-team/docs/          # Content: markdown files
├── adrs/
│   ├── adr-001-use-kafka-for-events.md
│   └── adr-002-vault-for-secrets.md
├── rfcs/
│   └── rfc-012-multi-cluster-tenancy.md
└── runbooks/
    ├── database-failover.md
    └── rotate-vault-tokens.md

gitops-infra/platform-team/        # Catalog: entity YAML files
└── docs/
    ├── adr-001-use-kafka-for-events.yaml
    ├── rfc-012-multi-cluster-tenancy.yaml
    └── runbook-database-failover.yaml
```

For service-specific docs, content lives in the service repo under `docs/`:

```
gitea/rocket-team/payment-service/
└── docs/
    ├── adr-001-payment-gateway-choice.md
    └── runbook-payment-reconciliation.md

gitops-infra/rocket-team/
└── docs/
    ├── adr-001-payment-gateway-choice.yaml
    └── runbook-payment-reconciliation.yaml
```

This separation means catalog metadata changes (status, tags) go through `gitops-infra` PRs
while content changes go through the content repo's own PRs — independently reviewable.


## Portal Rendering

When a user opens a Doc entity:

1. The catalog reads the YAML from `{team}/docs/` in `gitops-infra` on the 5-minute cache cycle
2. `GetDocContent` fetches the markdown from `spec.contentUrl` (authenticated Gitea raw URL)
3. The Doc viewer renders markdown with GFM tables, syntax highlighting, and embedded Mermaid diagrams
4. The sidebar shows: docType + docStatus badges, decision chain (`supersededBy`), related entities, and source links

### Status badge colors

| docStatus | Color |
|---|---|
| `proposed` | Amber |
| `under-review` | Blue |
| `accepted` | Green |
| `deprecated` | Gray |
| `superseded` | Orange |

### Draft visibility

`spec.draft: true` restricts visibility to members of `spec.owner` and `platform-team`.
Remove the flag only when the document is ready for the full team. Stale drafts are
invisible to everyone else — they don't clutter the catalog.


## Quick Checklist

Before committing a Doc entity YAML to `gitops-infra`:

- `kind: Doc` with `apiVersion: wxops.cloud/v1alpha1`
- `spec.docType` is `adr`, `rfc`, `runbook`, or `documentation`
- `spec.docStatus` matches the document's current state
- `spec.owner` is a valid `group:` reference
- `spec.relatedTo` has at least one component / system / resource reference
- `spec.contentUrl` uses the `/raw/` Gitea path, not `/src/`
- If `docStatus: accepted` on an ADR — content is frozen; supersede instead of editing
- If an RFC moves to `accepted` — a corresponding ADR exists or is being created
- No credentials, tokens, or PII anywhere in the markdown content
