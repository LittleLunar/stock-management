---
tags:
  - wiki/overview
created: 2026-07-25
updated: 2026-07-25
---

# Overview

[[Stock Management System]] is a **document-driven inventory platform** with multi-location stock, lot/serial tracking, FIFO costing, and accounting. It starts as internal inventory for a solo shop and is designed to grow into multi-branch retail with POS (built-in or external) consuming the same JSON APIs.

## Architecture shape

```
POS / E-com / Internal UI (Vite React)
              ↓
     Inventory Core (Fastify)  ← truth of qty
              ↓
        Costing (FIFO layers)
              ↓
     Accounting / GL (journals, AP)
```

## Hierarchy

[[Organization]] → [[Branch]] → [[Location]] — see [[Org Branch Location]].

## Non-negotiables

- [[Document-Driven Inventory]] — no direct qty edits
- [[FIFO Costing]] as primary valuation
- [[POS Integration Boundary]] — reservations + idempotent external refs from Phase B
- Stack locked in [[Tech Stack]]

## Roadmap

See [[Feature Phases]] and phase pages [[Phase A]] … [[Phase F]]. Full checklist: `docs/FEATURES.md`.

## Status

Knowledge layer and plans exist. Application monorepo not scaffolded yet — next work is [[Phase A]].
