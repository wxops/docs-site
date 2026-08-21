---
sidebar_position: 3
title: Gitea Resources
description: Field reference for XGiteaOrg, XGiteaTeam, XGiteaUser, and XGiteaRepository — Crossplane XRs that provision Gitea via the REST API.
---

# Gitea Resources

Four Crossplane XRs provision Gitea resources via the Gitea REST API. They are used by the portal scaffold flow to create repositories and ensure the tenant organisation structure exists before any code or GitOps manifest is committed.

All four XRs share the same `credentialsSecretRef` pattern — a `Secret` in tfvars format:

```yaml
gitea_token = "your-gitea-admin-api-token"
```

No password field is needed. Initial user passwords are auto-generated.

| Kind | Provisions | Package |
|---|---|---|
| `XGiteaOrg` | Gitea organisation | `gitea-org` |
| `XGiteaTeam` | Team within an org, with managed membership | `gitea-team` |
| `XGiteaUser` | Gitea user account | `gitea-user` |
| `XGiteaRepository` | Repository owned by an org | `gitea-repository` |

All kinds are in group `platform.wxops.cloud/v1alpha1`, cluster-scoped.


## XGiteaOrg

Manages a Gitea organisation with visibility and metadata.

| | |
|---|---|
| **Kind** | `XGiteaOrg` |
| **Plural** | `xgiteaorgs` |

### `spec.parameters`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `giteaUrl` | `string` | yes | | Base URL of the Gitea instance (e.g. `https://gitea.example.com`). |
| `insecure` | `boolean` | | `false` | Skip TLS verification. Use only for local/dev instances. |
| `orgName` | `string` | yes | | Organisation login name. **Immutable after creation.** |
| `fullName` | `string` | | `""` | Display name shown in the Gitea UI. |
| `description` | `string` | | `""` | Organisation description. |
| `website` | `string` | | `""` | Organisation website URL. |
| `location` | `string` | | `""` | Organisation location. |
| `visibility` | `string` | | `"public"` | One of `public`, `limited`, `private`. |
| `repoAdminChangeTeamAccess` | `boolean` | | `false` | Allow repository admins (non-org-admins) to add and remove teams from repositories. |
| `credentialsSecretRef.name` | `string` | yes | | Secret holding the Gitea admin token. |
| `credentialsSecretRef.namespace` | `string` | yes | | Namespace of the Secret. |

### Example

```yaml
apiVersion: platform.wxops.cloud/v1alpha1
kind: XGiteaOrg
metadata:
  name: rocket-team-org
spec:
  parameters:
    giteaUrl: https://gitea.example.com
    orgName: rocket-team
    fullName: Rocket Team
    description: Rocket Team - W'xOps tenant org
    visibility: private
    credentialsSecretRef:
      name: gitea-admin-credentials
      namespace: crossplane-system
```


## XGiteaTeam

Manages a team inside a Gitea organisation, including managed membership reconciliation.

| | |
|---|---|
| **Kind** | `XGiteaTeam` |
| **Plural** | `xgiteateams` |

### `spec.parameters`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `giteaUrl` | `string` | yes | | Base URL of the Gitea instance. |
| `insecure` | `boolean` | | `false` | Skip TLS verification. |
| `orgName` | `string` | yes | | Organisation this team belongs to. |
| `teamName` | `string` | yes | | Team name within the organisation. |
| `description` | `string` | | `""` | Team description. |
| `permission` | `string` | | `"read"` | Base permission for all team members: `none`, `read`, `write`, `admin`, `owner`. |
| `units` | `string` | | `"repo.code,repo.issues,repo.pulls"` | Comma-separated repository feature units. Valid values: `repo.code`, `repo.issues`, `repo.ext_issues`, `repo.wiki`, `repo.pulls`, `repo.releases`, `repo.projects`, `repo.ext_wiki`. Do not include `repo.actions` or `repo.packages` here — use `enableActions`/`enablePackages` instead. |
| `enableActions` | `boolean` | | `false` | Grant access to the Actions (CI/CD) unit. Applied via direct Gitea API because the Terraform provider does not support this unit. |
| `actionsReadOnly` | `boolean` | | `false` | Cap `repo.actions` to `read` permission, regardless of the base `permission`. Only effective when `enableActions: true`. |
| `enablePackages` | `boolean` | | `false` | Grant access to the Packages (container/artifact registry) unit. Applied via direct Gitea API. |
| `packagesReadOnly` | `boolean` | | `false` | Cap `repo.packages` to `read` permission. Only effective when `enablePackages: true`. |
| `includeAllRepositories` | `boolean` | | `false` | Automatically grant access to all org repositories. |
| `canCreateRepos` | `boolean` | | `false` | Allow team members to create repositories in the org. |
| `members` | `string` | | `""` | Comma-separated Gitea usernames. Membership is **reconciled on every sync** — removing a name removes the user from the team. Works for both managed (`XGiteaUser`) and pre-existing users. |
| `credentialsSecretRef.name` | `string` | yes | | Secret holding the Gitea admin token. |
| `credentialsSecretRef.namespace` | `string` | yes | | Namespace of the Secret. |

### Example

```yaml
apiVersion: platform.wxops.cloud/v1alpha1
kind: XGiteaTeam
metadata:
  name: rocket-team-developers
spec:
  parameters:
    giteaUrl: https://gitea.example.com
    orgName: rocket-team
    teamName: developers
    permission: write
    enableActions: true
    enablePackages: true
    packagesReadOnly: true
    members: "alice,bob,carol"
    credentialsSecretRef:
      name: gitea-admin-credentials
      namespace: crossplane-system
```


## XGiteaUser

Manages a single Gitea user account lifecycle (create / update / delete).

| | |
|---|---|
| **Kind** | `XGiteaUser` |
| **Plural** | `xgiteausers` |

The initial password is auto-generated and emailed to the user via Gitea SMTP — no
password field is needed in the credentials Secret. `mustChangePassword` defaults
to `true` so users set their own password on first login.

### `spec.parameters`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `giteaUrl` | `string` | yes | | Base URL of the Gitea instance. |
| `insecure` | `boolean` | | `false` | Skip TLS verification. |
| `username` | `string` | yes | | Login username for the Gitea account. |
| `email` | `string` | yes | | Email address. Gitea sends the welcome notification here. |
| `fullName` | `string` | | `""` | Display name shown in the Gitea UI. |
| `admin` | `boolean` | | `false` | Grant site administrator privileges. |
| `mustChangePassword` | `boolean` | | `true` | Require a new password on first login. Recommended when auto-generated passwords are used. |
| `visibility` | `string` | | `"private"` | One of `public`, `limited`, `private`. A private user won't appear in org member lists. |
| `passwordLength` | `integer` (16–128) | | `24` | Length of the auto-generated initial password. |
| `passwordSpecial` | `boolean` | | `true` | Include special characters in the auto-generated password. |
| `allowCreateOrganization` | `boolean` | | `false` | Allow the user to create organisations. |
| `credentialsSecretRef.name` | `string` | yes | | Secret holding the Gitea admin token. |
| `credentialsSecretRef.namespace` | `string` | yes | | Namespace of the Secret. |

### Example

```yaml
apiVersion: platform.wxops.cloud/v1alpha1
kind: XGiteaUser
metadata:
  name: alice
spec:
  parameters:
    giteaUrl: https://gitea.example.com
    username: alice
    email: alice@example.com
    fullName: Alice Smith
    visibility: limited
    mustChangePassword: true
    credentialsSecretRef:
      name: gitea-admin-credentials
      namespace: crossplane-system
```


## XGiteaRepository

Manages a Gitea repository owned by an organisation.

| | |
|---|---|
| **Kind** | `XGiteaRepository` |
| **Plural** | `xgitearepos` |

### `spec.parameters`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `giteaUrl` | `string` | yes | | Base URL of the Gitea instance. |
| `insecure` | `boolean` | | `false` | Skip TLS verification. |
| `orgName` | `string` | yes | | Organisation that owns the repository. |
| `repoName` | `string` | yes | | Repository name. **Immutable after creation.** |
| `description` | `string` | | `""` | Repository description. |
| `private` | `boolean` | | `false` | Make the repository private. |
| `autoInit` | `boolean` | | `true` | Initialize with a README commit. |
| `defaultBranch` | `string` | | `"main"` | Default branch name. |
| `hasIssues` | `boolean` | | `true` | Enable the issue tracker. |
| `hasWiki` | `boolean` | | `false` | Enable the wiki. |
| `hasProjects` | `boolean` | | `false` | Enable projects. |
| `hasPullRequests` | `boolean` | | `true` | Enable pull requests. |
| `credentialsSecretRef.name` | `string` | yes | | Secret holding the Gitea admin token. |
| `credentialsSecretRef.namespace` | `string` | yes | | Namespace of the Secret. |

### Example

```yaml
apiVersion: platform.wxops.cloud/v1alpha1
kind: XGiteaRepository
metadata:
  name: rocket-team-payment-api
spec:
  parameters:
    giteaUrl: https://gitea.example.com
    orgName: rocket-team
    repoName: payment-api
    description: Payment API service for rocket-team
    private: true
    autoInit: true
    defaultBranch: main
    hasIssues: true
    hasPullRequests: true
    credentialsSecretRef:
      name: gitea-admin-credentials
      namespace: crossplane-system
```


## Provisioning order

The portal scaffold flow creates these resources in dependency order:

```
XGiteaOrg → XGiteaTeam → XGiteaUser → add to XGiteaTeam.members
                      → XGiteaRepository
```

All four XRs reference the same `credentialsSecretRef` Secret. The Secret must
exist in the target namespace before any XR reconciles.

## See also

- [Crossplane APIs](./crossplane-apis) — package catalog and OCI installation
- [Golden-Path Scaffolding](../scaffolding/golden-path) — how the portal uses these XRs during scaffold
