---
sidebar_position: 3
title: Architecture
description: Hub-spoke topology, Pinniped auth, BFF proxy pattern, and how the portal is extended.
---

# Architecture

## Hub-Spoke Topology

```mermaid
flowchart TD
    Browser["Browser / wxops CLI"]

    subgraph hub["Hub Cluster"]
        Pinniped["Pinniped Supervisor\n(FederationDomain)"]
        Portal["W'xOps Portal\n(nginx + Go + Next.js)"]
        Gitea["Gitea\n(Git, CI, Registry)"]
        Vault["Vault\n(Secrets)"]
        ArgoHub["ArgoCD Hub\n(ApplicationSet controller)"]
        Crossplane["Crossplane\n(wxops-core packages)"]
    end

    subgraph spoke1["Spoke Cluster — dev"]
        Concierge1["Pinniped Concierge\n(JWTAuthenticator)"]
        K8s1["Kubernetes API"]
        XR1["XTenantApp XR"]
        Workload1["Deployment + Service\n+ IngressRoute"]
    end

    subgraph spoke2["Spoke Cluster — staging / prod"]
        Concierge2["Pinniped Concierge"]
        K8s2["Kubernetes API"]
        XR2["XTenantApp XR"]
        Workload2["Deployment + Service\n+ IngressRoute"]
    end

    Browser -->|"OIDC/PKCE login"| Pinniped
    Browser -->|"HTTPS"| Portal
    Portal -->|"token exchange (per cluster)"| Pinniped
    Portal -->|"read catalog + write repos/PRs"| Gitea
    Portal -->|"write secrets only"| Vault
    Portal -->|"K8s reads — user's own token"| Concierge1 --> K8s1
    Portal -->|"K8s reads — user's own token"| Concierge2 --> K8s2
    ArgoHub -->|"GitOps pull"| Gitea
    ArgoHub -->|"apply overlays/dev"| K8s1
    ArgoHub -->|"apply overlays/staging + prod"| K8s2
    Crossplane -->|"OCI package install"| K8s1
    Crossplane -->|"OCI package install"| K8s2
    XR1 -->|"compose"| Workload1
    XR2 -->|"compose"| Workload2
```

Most multi-cluster platforms require a privileged agent on every spoke. W'xOps does not. The only components needed on a spoke are **Pinniped Concierge** (validates JWTs) and the **Crossplane OCI package** (installed by ArgoCD). No portal sidecar, no shared service account, no cluster-admin credential stored anywhere.

| Layer | Hub | Spoke |
|---|---|---|
| Identity | Pinniped Supervisor (OIDC federation) | Pinniped Concierge (JWTAuthenticator) |
| GitOps control | ArgoCD (all ApplicationSets live here) | Receives manifests via ArgoCD |
| Platform API | Crossplane controller | Crossplane packages (OCI, via ArgoCD) |
| Observability | Portal reads cluster APIs via Pinniped | No agent — portal proxies on behalf of the user |

Spoke clusters are registered as K8s Secrets labelled `wxops.cloud/kind=cluster`. Each Secret carries the API server endpoint, CA bundle, and a unique JWTAuthenticator audience — one Secret registration drives both the portal cluster tabs and the ArgoCD cluster credential.

:::tip
Full Secret schema, CA bundle modes, and RBAC setup — [Cluster Registry](../platform/cluster-registry).
:::


## Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Portal as Portal (Go)
    participant Supervisor as Pinniped Supervisor
    participant Concierge as Spoke Concierge

    User->>Browser: Navigate to portal
    Browser->>Portal: GET / (no session cookie)
    Portal->>Browser: 302 → /auth/login → Supervisor /authorize?...&pkce...
    Browser->>Supervisor: Authorization request + upstream IdP login
    User->>Browser: Enter credentials
    Supervisor->>Browser: 302 → /auth/callback?code=...
    Browser->>Portal: GET /auth/callback?code=...
    Portal->>Supervisor: Exchange code + PKCE verifier → id_token + refresh_token
    Portal->>Browser: Set HttpOnly wxops_session cookie
    Browser->>Portal: GET / (with session cookie) → Portal UI

    Note over Portal, Concierge: Per-cluster token exchange (on demand)
    Portal->>Supervisor: token-exchange — target audience = spoke cluster ID
    Supervisor->>Portal: Cluster-scoped JWT (valid for one cluster only)
    Portal->>Concierge: K8s API call with cluster-scoped JWT
    Concierge->>Portal: K8s response (RBAC enforced on spoke)
```

- PKCE with S256 — client secret is never in the browser
- `wxops_session` is `HttpOnly` — browser JavaScript cannot read it
- Every cluster read uses the user's own token; a token for dev is cryptographically rejected by staging's Concierge
- Gitea groups flow through the OIDC token as `orgName:teamName` claims — see [Identity and Catalog](./identity-and-catalog) for group-to-namespace mapping


## Multi-Cluster Delivery

The same service definition deploys to dev, staging, and production through three cooperating layers.

```mermaid
flowchart LR
    Scaffold["Portal Scaffold\ncreates base/ + overlays/dev/"]
    Git["gitops-infra (Gitea)\nsource of truth"]
    AS1["ApplicationSet\ntenants-apps\nauto-sync dev"]
    AS2["ApplicationSet\ntenants-apps-stable\nmanual gate staging/prod"]
    XR1["XTenantApp XR\n→ Deployment + Service\n+ IngressRoute + Secrets"]

    Scaffold --> Git
    Git --> AS1 -->|"prune + selfHeal"| XR1
    Git --> AS2 -->|"human clicks Sync"| XR1
```

**Overlay structure** — the portal scaffold commits `base/` (env-agnostic claim) + `overlays/dev/` (env-specific patch). Promotion to staging/prod creates additional overlay directories. ArgoCD ApplicationSets discover directories automatically via git-dir generator — adding a directory provisions an Application; removing it prunes it.

**ApplicationSets** — two sets at sync wave 5: `tenants-apps` auto-syncs dev (changes visible within seconds of a merge); `tenants-apps-stable` detects OutOfSync but waits for a human Sync click on staging/prod.

**Crossplane XR** — ArgoCD delivers `XTenantApp` claim manifests to each spoke. Crossplane expands each claim into ~6–8 Kubernetes resources (Deployment, Service, IngressRoute, Certificate, ExternalSecret, optional Darlane twin). Platform teams update the Composition once; all tenants get the update on the next sync.

**Multi-cluster scaling** — a matrix generator pairs each overlay path with the ArgoCD cluster Secret carrying a matching `environment: dev|staging|production` label. Adding a new cluster requires only creating a labelled cluster Secret — no changes to the ApplicationSet.

:::tip[Deep dives]
- Overlay anatomy and Image Updater wiring — [Platform Features](../scaffolding/features)
- ApplicationSet planes, RBAC, Vault/ESO secrets — [GitOps Infrastructure](../platform/gitops-infrastructure)
- XTenantApp Composition breakdown, KCL engine — [Crossplane APIs](../api/crossplane-apis)
- Scaffold wizard that generates the initial overlay — [Golden-Path Scaffolding](../scaffolding/golden-path)
:::


## Portal Process Model and BFF

Three processes share one container on loopback:

```
nginx :80       → routes browser traffic; the only public entry point
Go :8080        → auth, catalog, scaffold, cluster, webhook handlers
Next.js :3000   → pages, server components, BFF route handlers
```

**Why nginx?** The Go backend runs on an internal loopback address that browser JavaScript can never reach. The `wxops_session` cookie is `HttpOnly` so browser code cannot read it either. nginx acts as the integration layer that makes both constraints work together: it routes OIDC and direct API traffic (`/auth/*`, `/api/v1/*`) straight to Go, and routes interactive browser calls (`/api/*`) to Next.js BFF route handlers that run on the server, read the cookie from `next/headers`, and proxy to Go on the user's behalf. The browser never sees the backend URL or the session token value — nginx enforces this boundary at the edge.

**Two fetch paths:**

| Path | When | How |
|---|---|---|
| A — Server Component | Data needed at page render | `async` component calls Go directly over loopback, forwards session cookie |
| B — BFF Route Handler | Interactive or auto-refreshing data | Browser fetches `/api/…`; handler in `src/app/api/` reads cookie server-side, proxies to Go |

No client-side code ever calls Go directly. All 13 BFF routes in `src/app/api/` follow the same shape: read cookie → fetch `BACKEND_URL/api/v1/…` → return `NextResponse.json`.


## Security Boundaries

| Boundary | Rule |
|---|---|
| Portal → K8s | Read-only on all clusters. Never writes to any K8s API. |
| Portal → Vault | Write-only. Creates/updates KV v2 secrets. Never reads or deletes. |
| Portal → Gitea | Read + write. Always verifies remote resource exists before touching Vault. |
| Lifecycle promotion | Only `platform-team` or `{team}:Managers` can promote past `experimental`. |
| gitops-infra PR URLs | Never surfaced to tenant users — portal returns status text only. |


## Extending the Portal

The portal is a **programmable platform layer**. Every capability in the UI today — catalog browsing, scaffold wizard, cluster inspection, Darlane debug, lifecycle promotion — was added through the same four extension surfaces. Anyone with access to the codebase can add a new capability without touching existing features.

### The four surfaces

```mermaid
flowchart TB
    subgraph UI["Portal UI"]
        UI1["New tab / card / wizard step\nor dashboard widget"]
        UI2["src/app/api/&lt;domain&gt;/ — BFF route"]
        UI3["backend/internal/handlers/&lt;domain&gt;.go"]
        UI1 --> UI2 --> UI3
    end

    subgraph CAT["Catalog Entity"]
        CAT1["New kind or annotation\ndrives UI visibility"]
        CAT2["service-catalog/&lt;team&gt;/*.yaml\n(Backstage-compatible YAML)"]
        CAT1 --> CAT2
    end

    subgraph XR["Crossplane XR"]
        XR1["New platform resource type\n(database tier, mesh, queue…)"]
        XR2["wxops-core\nnew XRD + Composition"]
        XR1 --> XR2
    end

    subgraph GITOPS["GitOps Integration"]
        GI1["New overlay type, plane,\nor auto-provisioned resource"]
        GI2["wxops-gitops-infrastructure\nnew ApplicationSet or\nKyverno GeneratingPolicy"]
        GI1 --> GI2
    end

    CAT2 -->|"annotation read by\nGo handler"| UI3
    XR2  -->|"XR claim committed\nby scaffold or portal"| GITOPS
    UI3  -->|"reads XR status\nvia Pinniped"| XR2
    GI2  -->|"ArgoCD applies XR claim\nto spoke cluster"| XR2
```

### Example: adding service mesh visibility

This is what a complete new capability looks like across all four surfaces:

| Surface | What you add | Result |
|---|---|---|
| Crossplane XR | `XServiceMesh` XRD + Composition in `wxops-core` | Istio `VirtualService` + `PeerAuthentication` provisioned per app, same as `XTenantApp` |
| GitOps | `base/xservice-mesh.yaml` claim generated by scaffold | ArgoCD applies it to each spoke; Crossplane expands it |
| Catalog entity | `wxops.cloud/mesh-enabled: "true"` annotation on Component | Portal reads the annotation to decide whether to show the Mesh tab |
| Portal UI | Go handler reads mesh CRs via Pinniped; BFF route at `/api/catalog/entities/[kind]/[name]/mesh`; client component renders traffic metrics | Developers see live mesh status on their service page |

Each surface is independent. The mesh XR can ship before the portal UI tab is built. The catalog annotation can be added manually before scaffold supports it. Nothing is coupled to a deploy sequence.

### What this means for stakeholders

- **New infrastructure resource type** → add an XRD + Composition to `wxops-core`. Platform engineers write it once; every tenant gets it as a form field in the scaffold wizard.
- **New developer visibility surface** → add a Go handler + BFF route + UI card. No schema changes, no database migrations, no infrastructure changes.
- **New automated provisioning rule** → add a Kyverno `GeneratingPolicy` to `wxops-gitops-infrastructure`. It runs on namespace creation automatically — no portal code change needed.
- **New catalog insight** → add an annotation convention to the entity YAML schema. Any CI job or tool that writes entities can populate it; the portal reads and renders it.

The platform grows incrementally. The four surfaces stay decoupled — a new XR does not require a portal release, and a new portal tab does not require a GitOps change.
