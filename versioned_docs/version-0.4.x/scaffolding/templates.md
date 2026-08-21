---
sidebar_position: 2
title: Service Templates
description: The golden-path template catalog — Go, Node.js, and Python starters, how the portal consumes them, and what every template generates.
---

# Service Templates

`wxops-templates` is the **seed repository** the scaffold wizard reads from. Each
template directory is a complete, production-ready microservice starter. The portal
reads `template.yaml` to render the wizard card; on scaffold, it copies the remaining
files into a fresh Gitea repo and substitutes template variables throughout.

## Template Catalog

| Template | Language | Framework | Dockerfile base | Default port |
|---|---|---|---|---|
| `golang-service` | Go 1.26 | stdlib `net/http` | `distroless/static-debian12:nonroot` | 8080 |
| `nodejs-service` | Node.js 24 | Express + TypeScript | `alpine` (appuser 1001) | 8080 |
| `python-service` | Python 3.14 | FastAPI + uvicorn | `alpine` (appuser 1001) | 8080 |

All three templates expose the same four HTTP endpoints, ship the same CI pipeline
structure, and are functionally equivalent from the platform's perspective.

## `template.yaml` Format

`template.yaml` lives at the root of each template directory. It is portal metadata
only — it is **not** copied into the scaffolded project.

```yaml
name: golang-service                 # stable identifier; portal falls back to dir name
title: Go Microservice               # card heading in the wizard picker
description: >                        # shown on the wizard card
  Production-ready Go service with structured logging,
  health checks, and Prometheus metrics.
tags:
  - backend
  - go
  - microservice

runtime:
  language: go                       # go | python | node
  version:
    default: "1.26"
    options:
      - "1.26"
      - "1.25"
      - "1.24"
      - "1.23"
  # packageManager: only for python and node

defaults:                            # pre-fills wizard form fields
  port: 8080
  replicas: 1
  cpuRequest: 100m
  memoryRequest: 128Mi
  cpuLimit: 200m
  memoryLimit: 256Mi
  healthPath: /healthz
  metricsPath: /metrics

recommends:                          # shown as badges on the card; never auto-enabled
  vault: true
  database: false
  api: false
  apiType: openapi
  ingress: true
```

## Template Variable Substitution

The portal substitutes these variables throughout all copied files:

| Variable | Description | Example |
|---|---|---|
| `{{ .ProjectName }}` | New service name | `payment-api` |
| `{{ .ProjectOwner }}` | Gitea org/user | `rocket-team` |
| `{{ .TenantNamespace }}` | Kubernetes namespace | `tenant-rocket-team` |
| `{{ .RuntimeVersion }}` | Language version chosen in wizard | `1.26`, `3.14`, `26` |
| `{{ .PackageManager }}` | Package manager (Node/Python only) | `npm`, `poetry`, `uv` |

Variables appear in Dockerfiles (`ARG GO_VERSION={{ .RuntimeVersion }}`), Makefiles,
source code service name strings, `cliff.toml` URLs, tunnel configs, and release-notes
templates.

## What Every Template Generates

### Endpoint Contract

All templates must expose these four endpoints — the platform depends on them:

| Endpoint | Response | Used by |
|---|---|---|
| `GET /healthz` | `{"status":"ok"}` | Kubernetes liveness probe |
| `GET /readyz` | `{"status":"ok"}` | Kubernetes readiness probe |
| `GET /metrics` | Prometheus text format | kube-prometheus-stack scrape |
| `GET /` | `{"service":"<name>","status":"running"}` | Smoke tests |

### Graceful Shutdown

- **Go**: `http.Server.Shutdown()` with 15-second context timeout on SIGTERM/SIGINT
- **Node.js**: `server.close()` with 15-second forced exit
- **Python**: uvicorn handles natively

### Multi-Stage Dockerfile

Two-stage build: `builder` stage compiles/installs → `production` stage runs as
non-root. `ARG RUNTIME_VERSION={{ .RuntimeVersion }}` makes the version
configurable at build time.

### Pre-commit Hooks

Every template ships a `.pre-commit-config.yaml` that runs on `git commit` and
enforces consistent quality gates before code ever leaves the developer's machine.
Install once per machine with `pip install pre-commit && pre-commit install`.

#### Common hooks (all three templates)

| Hook | What it checks | Fail condition |
|---|---|---|
| `trailing-whitespace` | Trailing spaces on any line | Any found (`.md` files excluded) |
| `end-of-file-fixer` | Files end with a newline | Missing newline |
| `check-yaml` | YAML syntax | Parse error |
| `check-json` | JSON syntax | Parse error |
| `detect-private-key` | Private key material in any file | Pattern match |
| `check-added-large-files` | File sizes | >500 KB |
| `gitleaks` (v8.22.1) | Secret patterns in diffs | Any detected secret |
| `hadolint-docker` (v2.13.1) | Dockerfile best practices | Lint error |
| `conventional-pre-commit` | Commit message format | Does not match Conventional Commits |
| `check-docs` (local script) | `docs/` structure completeness | Missing required sections |

#### Language-specific linter hooks

| Template | Hook(s) | What they fix/flag |
|---|---|---|
| `golang-service` | `go-fmt`, `go-vet`, `go-mod-tidy` | Formatting, static analysis, module graph |
| `nodejs-service` | `eslint` (v9) | TypeScript/JS lint errors and rule violations |
| `python-service` | `ruff --fix`, `ruff-format` | PEP 8, import sort, auto-fixable issues |

#### Conventional commit enforcement

`conventional-pre-commit` runs at the `commit-msg` stage (not the pre-commit stage),
so it only validates the message, never the diff. The allowed types mirror the
`commit_parsers` in `cliff.toml` — adding a type to one requires updating the other:

| Commit type | Changelog group |
|---|---|
| `feat` | Features |
| `fix` | Bug Fixes |
| `perf` | Performance |
| `refactor` | Refactor |
| `docs` | Documentation |
| `test` | Testing |
| `chore(ci)` | CI/CD |
| `chore(deps)` | Dependencies |
| `chore(release): …` | skipped (release machinery) |
| `chore` | Chores |
| `revert` | Reverts |
| `feat(…)!` / `fix(…)!` | Breaking Changes |

#### Doc check hook

`scripts/check-docs.sh` runs only when files under `docs/` change. It validates
the required structure: `GOVERNANCE.md`, at least one ADR under `adrs/`, and at
least one runbook under `runbooks/`. Bypass with `SKIP_DOC_CHECK=1 git commit`
or include `[skip-docs]` in the commit message.

### Changelog & Release

Every template ships `cliff.toml` and three Makefile targets that tie local
development to the CI release pipeline.

#### How git-cliff works

`git-cliff` reads the full `git log`, groups commits by type using `cliff.toml`
`commit_parsers`, and renders `CHANGELOG.md` from a Tera template. Two important
behaviors:

- **RC tags are skipped.** `skip_tags = ".*-rc.*"` means staging RC tags
  (`v1.2.0-rc1`) never appear in the changelog — only stable `vX.Y.Z` tags produce
  a new section.
- **Breaking changes are protected.** `protect_breaking_commits = true` prevents a
  squash or rebase from hiding a commit marked with `!` (e.g. `feat(api)!: …`).

Commit links and diff URLs in the changelog body point to the scaffolded project's
Gitea repo — the `{{ .ProjectOwner }}` and `{{ .ProjectName }}` template variables
are substituted at scaffold time so all links are correct from day one.

#### Makefile targets

| Target | What it does |
|---|---|
| `make changelog` | Regenerate `CHANGELOG.md` from full git history via `git-cliff -o CHANGELOG.md` |
| `make changelog-preview` | Print the *unreleased* section to stdout without writing any file |
| `make release` | Auto-bump version via `git-cliff --bumped-version`, tag HEAD as `vX.Y.Z`, push the tag; blocks `-rc` tags |
| `make release VERSION=v1.2.0` | Same as above but with a manual version override |

The `make release` target refuses to create an `-rc` tag — RC versions are
assigned automatically by CI on every merge to `staging`. You only run
`make release` to cut a production tag on `main`.

#### CI release job

When a `v*` tag (not `-rc`) is pushed, CI runs a dedicated `release` job **after**
`build-and-push` succeeds:

```
1. Checkout with full git history (fetch-depth: 0)
2. Install git-cliff
3. Regenerate CHANGELOG.md → commit back to main as
   "chore(release): update changelog for vX.Y.Z [skip ci]"
4. Build release body from release-notes/vX.Y.Z.md (if it exists) or
   release-notes/template.md, with {{CLIFF_NOTES}} replaced by git-cliff output
5. Create a Gitea release via softprops/action-gh-release
```

The `[skip ci]` suffix on the changelog commit prevents a recursive pipeline trigger.

#### Optional hand-written release notes

If `release-notes/vX.Y.Z.md` exists when the tag is pushed, CI uses it as the
release body template and splices in the auto-generated git-cliff output at the
`{{CLIFF_NOTES}}` placeholder. If neither file exists, git-cliff output is used
directly. This lets platform teams write highlights above the raw commit list.

### Documentation Structure

```
docs/
├── GOVERNANCE.md           # RFC → ADR decision flow, bypass rules
├── adrs/
│   └── adr-001-initial-architecture.md
└── runbooks/
    └── runbook-deployment.md
```

Doc validation runs as a pre-commit hook. Bypass with `SKIP_DOC_CHECK=1` or
`[skip-docs]` in the commit message.

### Developer Tunnel Configs

Both mirrord and Telepresence configs ship in every template:

```
.mirrord/mirrord.json        # mirrord exec target: deployment/{{ .ProjectName }}-darlane
.telepresence/config.yml     # intercept: {{ .ProjectName }} in {{ .TenantNamespace }}
```

See [Debug with Darlane](../darlane/debug) for when to use each.

## CI Pipeline

The pipeline in `.gitea/workflows/ci.yaml` has three jobs:

| Job | Runs when | What it does |
|---|---|---|
| `test` | Push to `develop`/`staging`, all PRs | Language-specific unit tests |
| `security` | Every push | Trivy filesystem + image scan (warnings only, never blocks) |
| `build-and-push` | All pushes except PRs | Builds and tags image (see table below) |

### Image Tag Strategy

| Git ref | Tag produced | How |
|---|---|---|
| Push to `develop` | `dev-{YYYY-MM-DD_HH-MM-SS}-{sha7}` | Build + push |
| Merge to `staging` | `vX.Y.Z-rcN` | `crane cp dev-tag → rc-tag` (no rebuild) |
| Merge to `staging` (hotfix) | continues RC series | Rebuild if source changed |
| `v*` tag on `main` | `vX.Y.Z` | `crane cp rc-tag → stable-tag` (no rebuild) |

The `crane cp` approach (copy-then-retag) guarantees the RC and production images
are **byte-for-byte identical** — no rebuild, no drift. See [Git Flow](./git-flow)
for the full branch model.

## Adding a New Template

Checklist for a new template directory in `wxops-templates`:

- [ ] `template.yaml` with all required fields (name, title, description, tags, runtime, defaults, recommends)
- [ ] Four required HTTP endpoints (healthz, readyz, metrics, /)
- [ ] Graceful shutdown on SIGTERM/SIGINT with ≤15s timeout
- [ ] Multi-stage Dockerfile with non-root user, ARG for runtime version
- [ ] `.gitea/workflows/ci.yaml` matching the three-job structure
- [ ] Makefile with all required targets (`dev`, `build`, `test`, `lint`, `docker-build`, `docker-run`, `release`, `changelog`, etc.)
- [ ] `docs/` structure (GOVERNANCE.md, adrs/adr-001-*.md, runbooks/runbook-deployment.md)
- [ ] `.mirrord/mirrord.json` + `.telepresence/config.yml` with template variables
- [ ] Pre-commit hooks config (`.pre-commit-config.yaml`)
- [ ] `cliff.toml` with `{{ .ProjectOwner }}` / `{{ .ProjectName }}` Gitea URLs
