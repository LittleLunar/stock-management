---
tags:
  - feature
  - phase-a
created: 2026-07-25
updated: 2026-07-26
---

# Phase A

Platform skeleton — multi-branch foundation, no stock yet.

## Status

In progress (2026-07-26): monorepo + schema + layered APIs + masters UI. Migration apply pending local Postgres.

## Features

- Org settings (currency, timezone, fiscal year)
- Branches CRUD
- Locations CRUD (per branch; types)
- Users & roles (branch-scoped memberships)
- Products (SKU, UOM, barcodes, lot/serial/expiry flags)
- Categories, suppliers (and customer stub)
- App shell (auth stub headers, layout)

## Architecture

Follows [[SOLID and Design Patterns]]: `routes → service → repository` under `apps/api/src/modules/`.

## Plan

`docs/superpowers/plans/2026-07-25-phase-a-platform-skeleton.md`

## Related

[[Org Branch Location]] · [[Tech Stack]] · [[Feature Phases]]
