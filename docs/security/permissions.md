---
sidebar_position: 1
title: Permissions & RBAC
description: Role matrix, Kubernetes RBAC setup, and security constraints for W'xOps Portal.
---

# Permissions & RBAC

## Role Model

W'xOps derives permissions from Pinniped group membership. There are no
application-level roles — group claims from the Pinniped Supervisor are
the single source of truth.

| Group pattern | Role | Who |
|---|---|---|
| `*:platform-team` | Platform admin | Full access, all tenants, all lifecycle stages |
| `{org}:{team}:Managers` | Team manager | Can promote services in their org past `experimental` |
| `{org}:{team}` | Developer | Can scaffold, use Darlane, view catalog in their namespace |
| _(no group match)_ | Read-only | Can view the public catalog; cannot scaffold or exec |

### Group format

Gitea OIDC sends groups as `orgName:teamName` (two levels only):

```
wxops:platform-team   →  platform admin
wxops:rocket-team     →  developer on rocket-team
wxops:Managers        →  team manager for wxops org
```


## Capability Matrix

| Capability | Developer | Manager | Platform |
|---|---|---|---|
| Browse catalog | ✅ | ✅ | ✅ |
| View CI/CD status | ✅ (own team) | ✅ (own team) | ✅ (all) |
| View cluster pods/deployments | ✅ (own namespace) | ✅ (own namespace) | ✅ (all) |
| Scaffold new project | ✅ | ✅ | ✅ |
| Enable/disable Darlane | ✅ (own service) | ✅ | ✅ |
| Sync files via Darlane | ✅ (own service) | ✅ | ✅ |
| Promote to `development` | ✅ | ✅ | ✅ |
| Promote to `staging` | ❌ | ✅ | ✅ |
| Promote to `production` | ❌ | ✅ | ✅ |
| Edit config overlay | ❌ | ✅ | ✅ |
| View gitops-infra PR URLs | ❌ | ❌ | ✅ |
| Delete any resource | ❌ | ❌ | ✅ |
| Manage cluster registry | ❌ | ❌ | ✅ |


## Kubernetes RBAC on Spoke Clusters

The portal proxies K8s reads using the user's Pinniped cluster-scoped token.
The spoke cluster's RBAC controls what each user can see.

### Minimum viewer ClusterRole

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: wxops-portal-tenant-viewer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "resourcequotas", "events"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list"]
- apiGroups: ["pkg.crossplane.io"]
  resources: ["*"]
  verbs: ["get", "list"]
```

### Bind per tenant namespace

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: wxops-portal-viewer
  namespace: tenant-wxops          # one RoleBinding per namespace
subjects:
- kind: Group
  name: wxops:rocket-team           # full Gitea group string
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: wxops-portal-tenant-viewer
  apiGroup: rbac.authorization.k8s.io
```

### Platform team binding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: wxops-platform-team-cluster-reader
subjects:
- kind: Group
  name: wxops:platform-team
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: view                       # built-in read-only cluster role
  apiGroup: rbac.authorization.k8s.io
```


## Security Constraints

These are non-negotiable. Violating any of them is a security bug.

### 1. Portal is read-only for clusters

The portal never writes to any K8s API. All configuration changes go through
Gitea PR → ArgoCD sync. This ensures every change has a reviewable, auditable
commit.

### 2. Vault: no read, no delete

The portal can only `kv put` to Vault. It cannot read secrets back, and it
cannot delete secret paths. Before writing to Vault, the portal must verify that
the Gitea repo and gitops-infra entry for the target service already exist.

### 3. Delete is platform-team only

No delete operation is exposed to tenant developers in any surface — UI or API.
Deletion requires a gitops-infra PR authored by a platform-team member.

### 4. gitops-infra PR URLs are internal

PR URLs pointing to `gitops-infra` are never returned in API responses to
tenant users. The portal returns status text (`PR #42 merged`) — never a
clickable link to an internal gitops repository.

### 5. Lifecycle promotion is role-gated

```
experimental   →  developer (anyone on the owning team)
development    →  developer
staging        →  platform-team OR {org}:Managers
production     →  platform-team OR {org}:Managers
```

The backend re-validates the user's Pinniped group claims on every promotion
request — the frontend check is informational only.


## Namespace Derivation

The portal never calls `GET /api/v1/namespaces` for tenant users (returns all
or 403). Namespaces are derived from Pinniped group membership:

```
group: wxops:rocket-team  →  namespace: tenant-wxops
group: acme:backend-team  →  namespace: tenant-acme
```

The mapping is `tenant-{orgName}` — the org is the unit of tenancy. All
sub-teams within an org share one namespace.


## Audit Trail

Every write action is logged:

- Scaffold: Gitea repo creation, initial commit SHA, gitops-infra PR number
- Vault: secret path written (not the value)
- Promotion: target lifecycle, PR number, PR title
- Catalog refresh: timestamp, triggering webhook token prefix

Logs are structured JSON (Go `slog`) and sent to stdout for log aggregation.
