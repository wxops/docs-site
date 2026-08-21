---
sidebar_position: 2
title: Debug & File Sync
description: How to debug with Darlane — file sync, exec, port-forward, and Mirrord for inner-loop development.
---

# Debug & File Sync

Once Darlane is enabled on a Component, you have two inner-loop tools available:
**`wxops darlane sync`** streams your local changes into the running pod, and
**Mirrord** runs your local process with the pod's cluster identity. They are
complementary — not redundant.


## Choosing the Right Tool

| Situation | Tool |
|---|---|
| Step-debug a live request with a debugger attached | [Mirrord](#mirrord) |
| Pod needs sidecars (Vault agent, Envoy, custom CNI) to function | [Mirrord](#mirrord) |
| Reproducing a bug that only manifests in the cluster environment | [Mirrord](#mirrord) |
| Framework requires running inside the cluster OS/arch (GPU, native libs) | [`darlane sync`](#file-sync) |
| Continuous hot-reload during development | [`darlane sync`](#file-sync) |
| Team shares a dev cluster — you don't want to intercept other traffic | [`darlane sync`](#file-sync) |

Both tools can be combined: `darlane sync` for continuous file sync + Mirrord to
intercept a specific request when the bug is hard to reproduce.


## File Sync

`wxops darlane sync` watches a local directory with `fsnotify`, debounces changes,
and streams them into the Darlane pod using `kubectl exec … tar xf -`.
No daemon, no sidecar, no special cluster setup required.

### Prerequisites

The Darlane pod must be configured with `fileSync` enabled:

```yaml
# Promotion panel → Enable Darlane → File Sync toggle
darlane:
  enabled: true
  replicas: 1           # pod must be running
  fileSync:
    enabled: true
    mountPath: /app     # writable emptyDir mounted here by the composition
    initFromImage: true # seed volume from the pod's image before sync starts
  command:
  - uvicorn
  - main:app
  - --reload
  - --host
  - "0.0.0.0"
  - --port
  - "8080"
```

`initFromImage: true` copies the image filesystem into the writable volume via an
init container before your first sync. Without it, the volume starts empty and the
first `darlane sync` run populates it from your local tree.

### Basic usage

```bash
# Sync current directory into /app
wxops darlane sync payment-api

# Explicit local and remote paths
wxops darlane sync payment-api --local ./src --remote /app/src

# Skip initial full sync (pod volume already has current content)
wxops darlane sync payment-api --no-initial-sync
```

### Sync flags

| Flag | Default | Description |
|---|---|---|
| `--local` | `.` | Local directory to watch |
| `--remote` | `/app` | Target path inside the pod |
| `--env`, `-e` | `dev` | Environment: `dev`, `staging`, `production` |
| `--namespace`, `-n` | _(derived)_ | Override K8s namespace (default: `tenant-{org}`) |
| `--deployment` | _(derived)_ | Override deployment name (default: `{app}-darlane`) |
| `--debounce` | `100` | Milliseconds to wait after last event before syncing |
| `--exclude` | — | Glob pattern to skip (repeatable) |
| `--no-initial-sync` | `false` | Skip initial full sync on startup |

### Built-in excludes

`.git`, `node_modules`, `__pycache__`, `.next`, and `vendor` are always excluded
regardless of `--exclude` flags.

### What the output looks like

```
watching  ./src  →  tenant-wxops/payment-api-darlane:/app
→  initial sync: 42 file(s)
↑  synced  2 file(s): handlers/payment.go, handlers/util.go
✗  deleted 1 file(s): handlers/old_handler.go
⚠  pod not ready, retrying (1/3)…
↑  synced  1 file(s): handlers/payment.go
^C
↑  synced  1 file(s): main.go
stopped.
```

### Delete propagation

Files and directories deleted locally are removed from the pod on the next flush.
Deletes are applied before syncs within each flush batch so that a delete-then-recreate
arrives in the correct order.

### Burst protection

If a continuous burst of events (e.g. `go build` emitting hundreds of files) keeps
resetting the debounce timer, a flush is forced at the **2-second mark** regardless.
This prevents a long build from blocking syncs indefinitely.

### Pod restart resilience

Each sync and delete retries up to 3 times with a 2-second delay between attempts.
Pods restart during active development — the sync survives a pod restart without
losing a batch.

### Graceful shutdown

`Ctrl-C` (or `SIGTERM`) flushes any pending changes before exiting.


## Mirrord

Mirrord runs your **local process** as if it were the Darlane pod — it tunnels
the pod's network, environment variables, secrets, and service mesh context to
your local machine. Your code runs locally; the cluster provides the identity.

### Prerequisites

The Darlane pod must be running (`replicas: 1`). File sync is **not required** for
Mirrord — the pod is used as an identity and network template, not for code execution.

```yaml
darlane:
  enabled: true
  replicas: 1   # must be running — Mirrord needs a live target
  ttl: 4h
  # fileSync not needed
```

### Install Mirrord

```bash
# macOS
brew install metalbear-co/mirrord/mirrord

# Linux
curl -fsSL https://raw.githubusercontent.com/metalbear-co/mirrord/main/scripts/install.sh | bash

# VS Code extension
code --install-extension metalbear.mirrord
```

### Run your local process with cluster context

```bash
mirrord exec \
  --target deployment/payment-api-darlane \
  --target-namespace tenant-wxops \
  -- uvicorn main:app --reload
```

Your local `uvicorn` process now:
- Receives traffic mirrored from the Darlane pod
- Reads the same environment variables and Vault secrets as the pod
- Resolves service DNS (e.g. `http://postgres-rw:5432`) via the pod's network

### mirrord.toml config

```toml
[target]
namespace   = "tenant-wxops"
path        = "deployment/payment-api-darlane"

[feature.network.incoming]
mode = "mirror"      # mirror: copy traffic; steal: intercept it exclusively

[feature.env]
override = { LOG_LEVEL = "debug", FEATURE_NEW_RANKING = "true" }
```

Point `path` at the Darlane deployment (`{app}-darlane`), never the main deployment.
This ensures production traffic is never intercepted.

### Mirror vs Steal mode

| Mode | Effect | When to use |
|---|---|---|
| `mirror` | Traffic is copied to both the pod and your local process | Default — safe in shared dev clusters |
| `steal` | Traffic is redirected exclusively to your local process | When you need to own the response; disrupts other developers on the same service |

Use `mirror` in shared dev clusters. `steal` is appropriate only in isolated
personal environments or when combined with [header routing](./ab-testing#header-routing)
so only your targeted requests are stolen.


## Direct Pod Access

### Exec

```bash
# Open a shell in the Darlane pod
kubectl -n tenant-{org} exec -it deployment/{appName}-darlane -- bash

# Or via the CLI shortcut
wxops darlane exec payment-api
```

### Port-forward

Port-forward bypasses the ingress and always hits the Darlane pod directly.
Useful for testing endpoints that aren't exposed via ingress, or when you want
to avoid any traffic routing.

```bash
kubectl -n tenant-{org} port-forward deployment/{appName}-darlane 8080:8080
```

### Header routing (through real ingress)

Target the Darlane pod through the production ingress without port-forward:

```bash
curl -H "X-Target-Env: darlane" https://payment-api.dev.wxops.cloud/health
```

This reaches the Darlane pod even with `trafficWeight: 0` — real users are unaffected.
See [Header Routing](./ab-testing#header-routing) for configuration details.


## TTL and Scaling

The `ttl` field is a hint to the composition about how long the pod should stay alive.
Until the composition implements automated scale-down, scale manually:

```bash
# Scale up to start a session
# → change replicas via the portal Promotion panel

# The pod scales to 0 automatically after TTL (when composition supports it)
# Until then, scale down via the portal when done
```

`replicas: 0` (the default) means the Deployment exists but no pods are running.
This preserves the debug configuration (command, file sync, env overrides) without
consuming cluster resources. Scale to 1 only when actively working.

:::info[Use the portal to change replicas, TTL, and configuration]
ArgoCD continuously syncs the dev overlay. Any manual `kubectl scale` will be
reverted on the next sync cycle. The only durable way to change replica count
or config is through the portal, which commits the patch to `gitops-infra`.
:::
