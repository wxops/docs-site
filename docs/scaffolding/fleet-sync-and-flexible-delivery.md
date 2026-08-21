---
sidebar_position: 5
title: "Direction: Fleet Sync & Flexible Delivery"
description: Where golden-path scaffolding is headed next — bringing template improvements to services already created, and letting teams choose their own delivery topology.
---

# Direction: Fleet Sync & Flexible Delivery

> **Status: Planned.** Nothing on this page exists yet. It describes where scaffolding is
> headed, so you know what to expect — not what you can do today. For how scaffolding and
> git flow actually work right now, see [Golden-Path Scaffolding](./golden-path) and
> [Git Flow](./git-flow).

## The gap today

Scaffolding is one-time. When the wizard creates your service, it copies the golden-path
template as it exists *that day* — and from that moment, your repository is fully
independent. There is no link back to the template it came from.

That's fine until the template improves. A base-image security patch, a CI pipeline fix, a
new platform tool integration — none of it reaches a service that was already scaffolded.
Every existing service is frozen at whatever the template looked like on its creation date,
no matter how much the golden path improves afterward.

## Where this is headed

**Template improvements should be able to reach services that already exist — safely.**

The plan is a platform-managed pull request, not a silent push. When something in the
template changes that's meant to be shared platform-wide (a CI pipeline fix, a base-image
bump, a new required security scan), your service would receive a PR proposing that exact
change — reviewed and merged by your team like any other PR, running your normal CI before
it lands. Nothing gets overwritten without your team seeing the diff first.

Not everything in a scaffolded repo is a candidate for this. Your application code, your
own ADRs, your dependency choices — anything your team decided — stays yours, untouched,
forever. Only the platform-owned and governance-owned parts of a service (the CI pipeline,
tunnel configs, doc-validation rules) are ever candidates for a sync PR.

**Teams should be able to choose their own delivery topology.**

Right now every scaffolded service gets the same three-environment flow:
`develop → staging → main`. That's the right default, but not every service needs it — a
small internal tool, or a team without a formal staging gate, may want a shorter path
straight to production. The direction is to let you pick that shape at scaffold time,
without losing what the golden path actually guarantees: security scanning, changelog
generation, and documentation checks stay identical no matter which delivery path you
choose. Only how many promotion hops you go through changes — never the platform's
guardrails.

## Why this matters

As the number of services scaffolded from the golden path grows, "scaffold once, then
you're on your own" becomes a real gap: a security fix made in the template today has no way
to reach a service created six months ago. Closing that gap — without ever taking control
away from the team that owns a service — is what this direction is about.

## An earlier idea that didn't hold up

An earlier design explored representing each template as a Kubernetes custom resource — a
`Template` CRD reconciled by an operator, with the scaffold flow modeled as a pipeline of
`actions`. You may still see that shape referenced in older notes, including the example in
[Golden-Path Scaffolding](./golden-path#scaffold-templates). **It was experimental and does
not reflect how scaffolding actually works today.** Scaffolding is handled directly by the
portal backend against the real `wxops-templates` repository — no CRD, no operator, no
`actions` pipeline. Nothing about the direction on this page depends on that idea; it's noted
here only so the two don't get conflated while both are still just plans. The corrected,
technical version of this note lives alongside the rest of the engineering-level idea, in
`docs/roadmap/fleet-sync-and-golden-path-evolution.md` in the `wxops-portal-v2` repository.

There's no committed timeline yet. This page will be replaced with real documentation once
the mechanism exists.
