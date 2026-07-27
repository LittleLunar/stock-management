---
tags:
  - feature
  - phase-a
created: 2026-07-25
updated: 2026-07-27
---

# Phase A

Platform skeleton — multi-branch foundation, no stock yet.

## Status

Migrating to [[Clean Architecture]] complete (2026-07-26): packages-first (`domain` / `application`), API adapters under `infrastructure` + `interfaces/http`. Masters UI remains thin HTTP client.

**Auth:** historically a header stub (`X-Org-Id` + `X-User-Id`). Real email/password JWT auth is designed and planned — see [[Authentication]] (implementation in progress on `feature/auth-and-notifications`).

## Features

- Org settings (currency, timezone, fiscal year)
- Branches CRUD
- Locations CRUD (per branch; types)
- Users & roles (branch-scoped memberships)
- Products (SKU, UOM, barcodes, lot/serial/expiry flags)
- Categories, suppliers (and customer stub)
- App shell (layout; auth stub until JWT replaces it)

## Architecture

Follows [[Clean Architecture]]: use cases in `packages/application`, entities in `packages/domain`, Drizzle adapters in `apps/api/src/infrastructure`, HTTP in `apps/api/src/interfaces/http`.

## Plans

- CA migration: `docs/superpowers/plans/2026-07-26-clean-architecture-migration.md`
- Original scaffold (historical): `docs/superpowers/plans/2026-07-25-phase-a-platform-skeleton.md`
- Auth + notifications: `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`

## Related

[[Org Branch Location]] · [[Tech Stack]] · [[Feature Phases]] · [[Clean Architecture]] · [[Authentication]] · [[Notifications]]
