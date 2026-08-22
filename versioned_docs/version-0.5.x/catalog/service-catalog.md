---
sidebar_position: 1
title: Service Catalog
description: How the W'xOps service catalog works, what entity types it supports, and how catalog data flows.
---

# Service Catalog

The W'xOps Service Catalog is a searchable, filterable registry of every service,
API, database, team, and document in your organization. It reads
Backstage-compatible YAML from your `gitops-infra` repository — no database,
no plugin, no catalog server.

:::tip[What W'xOps took from Backstage]
The catalog YAML shape and core kinds (Component, API, Resource, System, Group, User) — not the
runtime. See [Backstage Concepts, Not Backstage Runtime](../concepts/ecosystem#backstage-concepts-not-backstage-runtime)
for what that split actually means. The payoff: existing Backstage `catalog-info.yaml` files are
mostly already the right shape, so migrating in is trimming and relabeling, not a rebuild.

`Doc` is W'xOps' own addition on top of that borrowed shape — a kind Backstage doesn't have, for
linking an RFC, ADR, or runbook straight to the service it documents. More on why:
[Documentation Strategy](./documentation-strategy).
:::

## How It Works

```mermaid
flowchart LR
    GiteaRepo["gitops-infra/service-catalog/\n*.yaml entity files"]
    Cache["Portal cache\n(5-min TTL)"]
    Webhook["Gitea push webhook\n→ /api/v1/webhooks/catalog/refresh"]
    Search["FlexSearch index\n(client-side)"]
    Browser["Browser"]

    GiteaRepo -->|"Gitea API read\n(on cache miss)"| Cache
    Webhook -->|"cache invalidation"| Cache
    Cache -->|"entity list"| Browser
    Browser -->|"indexes entities"| Search
    Search -->|"local fuzzy search"| Browser
```

- The portal reads all YAML files from `service-catalog/` on first request and
  caches for 5 minutes.
- A Gitea push webhook calls `/api/v1/webhooks/catalog/refresh` to invalidate
  immediately on every push to `gitops-infra`.
- Search runs in-browser with FlexSearch — no round-trip per keystroke.

## Entity Types

| Kind | What it represents |
|---|---|
| `Component` | A service, library, or batch job |
| `API` | An OpenAPI, gRPC, or async API spec |
| `Resource` | A database, object store, queue, or Vault path |
| `System` | A product made up of related components |
| `Group` | A team or organization unit |
| `User` | A team member |
| `Doc` | An RFC, ADR, or Runbook (labeled "Document" in the portal UI) |

:::info[Room to grow: not every Backstage kind is implemented yet]
The portal validates, stores, and lets you filter or register by only the kinds in the table
above. Backstage's own catalog spec — which this YAML shape is otherwise compatible with — also
defines `Location` (federating multiple entity sources) and `Template` (scaffolder-as-entity).
Neither exists here today: a file with `kind: Location` or `kind: Template` wouldn't be rejected,
but nothing creates, validates, lists, or renders one.

`Location` isn't a near-term need — the portal already reads the whole `service-catalog/`
directory as one dataset, so there's nothing to federate. `Template` is the more interesting one:
golden-path templates today are plain `template.yaml` files in `wxops-templates`, entirely outside
the catalog. A `kind: Template` catalog entity could eventually carry the usage data the catalog
is already positioned to track — which templates are actually recommended for a team's stack
based on real adoption, which are falling out of use, which get scaffolded and then immediately
deprecated — turning template choice into something driven by observed behavior instead of a
static list. Not built, not scheduled — recorded here as a real direction, not a rejected idea.
:::

## Entity File Format

Entities follow the Backstage `backstage.io/v1alpha1` schema. The portal
extends it with `wxops.cloud/` annotations.

### Component example

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-api
  description: |
    Handles payment processing for checkout flows.
  annotations:
    wxops.cloud/scaffold-template: go-grpc-service
    wxops.cloud/scaffold-date: "2025-06-10"
    wxops.cloud/gitea-repo: wxops/payment-api
    wxops.cloud/vault-path: wxops/payment-api/dev
    wxops.cloud/lifecycle: development
spec:
  type: service
  lifecycle: development
  owner: group:wxops/rocket-team
  system: payments
  providesApis:
    - payment-api-v1
  dependsOn:
    - resource:payment-db
    - component:identity-service
```

### API example

```yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: payment-api-v1
  annotations:
    wxops.cloud/gitea-repo: wxops/payment-api
    wxops.cloud/openapi-path: api/openapi.yaml
spec:
  type: openapi
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

### Resource example

```yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: payment-db
  annotations:
    wxops.cloud/vault-path: wxops/payment-api/dev
spec:
  type: database
  lifecycle: development
  owner: group:wxops/rocket-team
  system: payments
  dependsOn:
    - component:payment-api
```

## Entity Detail Page

Each entity has a detail page with:

| Card | Content |
|---|---|
| Overview | Description, owner, lifecycle, system, type |
| Completeness score | A badge showing how filled-out this entity's metadata is |
| Relations | Dependencies, provides, consumes (graph) |
| Scaffold info | Template used, date scaffolded, gitops-infra commit |
| CI/CD | Latest workflow run at a glance; "View all" opens a searchable, paginated run history |
| Dependencies | Parsed manifest packages, summarized by file; "View all" opens search, filters, and a compare-against-a-release control |
| Cluster status | ArgoCD sync status, health, deployed revision (per env) |
| Activity | Recent PRs, promotions, config changes (role-gated) |
| Docs | Linked RFC/ADR/Runbook rendered as Markdown |
| Promotion | Lifecycle transition panel (role-gated) |
| OpenAPI | Interactive Swagger UI (for API kind) |
| Config | Editable overlay config (platform team only) |

### Completeness score

Every entity carries a badge — `4/6 complete`, color-banded green/amber/red —
computed fresh on every page load from whether these fields are actually
filled in: description, owner, tags, links, lifecycle, and (for `API` kind
only) whether a resolvable spec exists. Nothing is stored or cached
separately from the entity itself, so the score is always current with
whatever's committed in `gitops-infra` right now.

It's most useful for manually registered or older entities — anything
scaffolded through the golden path already fills in every one of these
fields by default, so a low score on a scaffolded service usually means
something was edited out afterward, not that the golden path missed it.

Hover the badge to see exactly which checks passed and which didn't.

### Dependencies

For `Component` entities with a linked source repository, the Dependencies
card parses `go.mod`, `package.json`, `requirements.txt`, or
`pyproject.toml` — root directory and one level of subdirectories — and
tracks what's actually installed, split into direct, dev, and indirect/
transitive.

The card itself stays small: one line per manifest, showing its file path
and package count, so a project with hundreds of transitive dependencies
doesn't turn the card into a wall of text. **View all** opens a search
view — instant filtering by package name, ecosystem, or version, plus
direct/dev/indirect toggles — for actually digging into what's there. A
manifest that hit the (generous) per-file cap says so explicitly rather than
silently dropping entries past it.

The **Compare against a release** control lives inside that same view: pick
any past release tag and see only what changed against the current default
branch — packages added, removed, or bumped to a different version, grouped
by manifest, not a flat list mixing every file together. Comparisons against
a release tag are cached indefinitely (a tag's contents never change); the
default branch's own manifest is cached briefly and refreshed on the next
view.

The CI/CD and Releases cards follow the same pattern — a compact glance view
plus a "View all" search dialog with pagination past what the summary shows.

## Lifecycle States

| Lifecycle | Who can set | Meaning |
|---|---|---|
| `experimental` | Any developer | Proof-of-concept, may be removed |
| `development` | Developer (via promotion panel) | Active development, `dev` overlay exists |
| `staging` | `platform-team` or `{team}:Managers` | Staging overlay promoted, RC image tagged |
| `production` | `platform-team` or `{team}:Managers` | Production overlay promoted, stable image |
| `deprecated` | Platform team | Retained for reference, not running |

The portal enforces lifecycle gating — non-manager developers cannot promote
past `experimental`.

## Catalog Directory Layout

```
gitops-infra/
└── service-catalog/
    ├── groups/
    │   └── rocket-team.yaml
    ├── users/
    │   └── alice.yaml
    ├── systems/
    │   └── payments.yaml
    └── components/
        ├── payment-api/
        │   ├── component.yaml
        │   ├── api.yaml
        │   └── resource-db.yaml
        └── identity-service/
            └── component.yaml
```

Subdirectory layout is convention — the portal reads all `*.yaml` files
recursively and recognizes entities by their `kind:` field.
