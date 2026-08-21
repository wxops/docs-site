---
sidebar_position: 3
title: Troubleshooting
description: Common W'xOps Portal issues and how to fix them — login, catalog, cluster views, Darlane, and the CLI.
---

# Troubleshooting

Symptom → likely cause → fix. If your issue isn't here, check the portal logs
(`kubectl logs deploy/wxops-portal -n <ns>`) and the relevant reference page linked
in each section.

## Login & authentication

### 502 Bad Gateway on `/auth/callback`

**Cause:** nginx's default proxy buffer (4 KB) is too small for the encrypted Pinniped
session cookie, which bundles `id_token` + `access_token` + `refresh_token` (~3–4 KB).
nginx rejects the upstream response with `upstream sent too big header`.

**Fix:** raise the buffer on the `/auth/` location block:

```nginx
location /auth/ {
    proxy_buffer_size   32k;
    proxy_buffers       4 32k;
    # ... existing proxy_pass ...
}
```

### Login redirects in a loop, or `x509: certificate signed by unknown authority`

**Cause:** the OIDC issuer (Pinniped Supervisor) is served by an internal/private CA the
portal doesn't trust, or the issuer URL is wrong.

**Fix:** point the portal at the CA and verify the issuer:

- Set `OIDC_CA_BUNDLE` (PEM inline) or `OIDC_CA_BUNDLE_FILE` (path) on the portal.
- Confirm `OIDC_ISSUER_URL` exactly matches the Supervisor's `FederationDomain` issuer
  (trailing slash and scheme included).
- Check clock skew between the portal and the IdP — token validation is time-sensitive.

### Session cookie not set / dropped over HTTPS behind an ingress

**Cause:** the portal sees the internal `http` scheme and doesn't set the cookie's
`Secure` flag correctly, so the browser drops it.

**Fix:** ensure the ingress forwards `X-Forwarded-Proto: https` and that nginx passes it
upstream unchanged (don't overwrite it with the internal scheme). The backend derives
`Secure` from that header.

## Catalog

### Catalog is empty or shows stale data

**Cause:** the catalog is read from Gitea with a **5-minute in-memory cache**. A recent
commit may not be visible yet, or the source path is misconfigured.

**Fix:**

- For instant refresh after a `gitops-infra` push, wire a Gitea push webhook to
  `POST /api/v1/webhooks/catalog/refresh` (auth: `Authorization: Bearer <WEBHOOK_TOKEN>`).
- For local testing without Gitea, set `CATALOG_LOCAL_DIR` to a directory of entity YAML
  (the repo ships an example catalog) — note `GITEA_CATALOG_PATH` is ignored when this is set.
- Otherwise wait out the 5-minute TTL. See [Service Catalog](/docs/catalog/service-catalog).

### BFF routes return 404 (`/api/...` calls fail in the browser)

**Cause:** nginx is sending `/api/*` to the Go backend, which only serves `/api/v1/*`.
The BFF route handlers live in Next.js.

**Fix:** nginx needs **two** location blocks, longest-prefix ordered — `/api/v1/` → Go,
`/api/` → Next.js. A single `location /api/ → Go` block silently 404s every BFF call.

## Cluster views

### Cluster tab is empty, or returns 403

**Cause:** cluster reads use the **logged-in user's** Pinniped credentials, scoped by
their Kubernetes RBAC. Namespaces are derived from Gitea OIDC group membership
(`org:team` → `tenant-{org}`), never a cluster-wide namespace list.

**Fix:**

- Confirm the user is in the expected Gitea team and that a matching
  `ClusterRoleBinding` exists on the spoke (subject = the full `org:team` string).
- A tenant user seeing 403 outside their namespaces is **expected** — that's RBAC working.
- Verify the spoke's `JWTAuthenticator` trusts the Supervisor and the correct `audience`.

### `ImagePullBackOff` on the portal or platform pods

**Cause:** the pod can't pull from a private registry.

**Fix:** ensure the image pull secret (e.g. `regcred`) exists in the target namespace and
is referenced by the ServiceAccount or pod spec.

## Darlane

### `wxops darlane exec` / `sync` fails — no shell or `tar` in the pod

**Cause:** distroless or scratch images have no shell and no `tar`, so exec and the
tar-pipe file sync can't run.

**Fix:** use an ephemeral debug container instead:

```bash
kubectl debug -it <pod-name> -n <namespace> --image=busybox --target=<container>
```

`wxops darlane sync` detects the missing `tar` on startup and prints the exact
`kubectl debug` command for you. See [Darlane](/docs/darlane/overview).

### Darlane pod keeps scaling back to 0 replicas

**Cause:** the Darlane Deployment is Crossplane-managed. `kubectl scale` is overwritten on
the next reconcile; the XR is the source of truth. TTL policies also scale idle twins down.

**Fix:** patch the **XR**, not the Deployment:

```bash
kubectl patch xtenantapp <name> --type=merge \
  -p '{"spec":{"parameters":{"darlane":{"replicas":1}}}}'
```

## `wxops` CLI

### `unauthorized` on every command

**Cause:** the CLI reuses the `wxops_session` cookie, which expires with the portal
session. There is no auto-refresh.

**Fix:** re-authenticate: `wxops login --portal https://<portal-host>`. In CI, set a fresh
`WXOPS_TOKEN` (it takes precedence over the credentials file). See [CLI](/docs/cli/overview).

### `portal did not return a version` on `wxops update`

**Cause:** the portal instance hasn't configured CLI downloads, or you're on a build that
predates the `/api/v1/cli/version` endpoint.

**Fix:** confirm the portal serves `GET /api/v1/cli/version`; if downloads aren't wired on
that instance, install the binary manually.

## Scaffold & promotion

### Vault write refused, or "remote resource does not exist"

**Cause:** by design, the portal only writes a secret **after** confirming the remote Gitea
repo and gitops config exist — it never creates a secret for a resource that isn't there.

**Fix:** ensure the scaffold's Gitea repo and `gitops-infra` entries were created (and the
PR merged where required) before expecting the Vault path to be populated. The portal
creates/updates Vault secrets only — it never reads or deletes them.

---

Still stuck? Open the portal logs and the specific reference page:

- [Architecture](/docs/concepts/architecture)
- [Deployment](/docs/getting-started/deployment)
- [Environment Variables](/docs/getting-started/environment-variables)
- [Permissions](/docs/security/permissions).
