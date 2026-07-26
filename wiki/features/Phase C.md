---
tags:
  - feature
  - phase-c
created: 2026-07-25
updated: 2026-07-26
---

# Phase C

Costing — every stock change valued.

## Status

**C1 + C2 shipped (2026-07-26).** All inventory document posts/voids
create or consume location-scoped cost layers in the same UoW and stamp
movement costs. Implement **C3** next. Phase D unblocks when C3 completes.

| Slice | Focus | Status / Plan |
|-------|--------|----------------|
| C1 | Cost layers on GR post/void; movement costs; cost-layer inquiry | **Complete** — `docs/superpowers/plans/2026-07-26-phase-c1-cost-layers-receipt.md` |
| C2 | FIFO consume/create on issue, transfer, adjust, count, returns | **Complete** — `docs/superpowers/plans/2026-07-26-phase-c2-fifo-consumption.md` |
| C3 | Landed cost, revaluation, valuation (as-of), COGS, cache, thin web | **Plan ready** — `docs/superpowers/plans/2026-07-26-phase-c3-landed-reval-reports.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-c-fifo-costing.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`

## Features

- FIFO cost layers + consumptions (location-scoped) — **C1 + C2 shipped**
- Cost on movements (unit/total) — **C1 + C2 shipped**
- Landed cost allocation (C3)
- Inventory valuation report incl. as-of (C3)
- Product cost inquiry (C1) — shipped
- COGS by period (C3)
- Revaluation / write-down (C3)
- Cost summary cache (C3)

## Architecture

Follows [[Clean Architecture]]. Same UoW as qty posting adds layers/consumptions.
Shared applicator: `packages/application/src/costing/apply-document-costing.ts`.
Strategy: FIFO only in C (`avg` rejects). See [[FIFO Costing]].

## Related

[[FIFO Costing]] · [[Feature Phases]] · [[Phase B]] · [[Document Posting]]
