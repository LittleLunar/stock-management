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

**Phase C complete (2026-07-26).** C1–C3 shipped. Phase D is unblocked.

| Slice | Focus | Status / Plan |
|-------|--------|----------------|
| C1 | Cost layers on GR post/void; movement costs; cost-layer inquiry | **Complete** — `docs/superpowers/plans/2026-07-26-phase-c1-cost-layers-receipt.md` |
| C2 | FIFO consume/create on issue, transfer, adjust, count, returns | **Complete** — `docs/superpowers/plans/2026-07-26-phase-c2-fifo-consumption.md` |
| C3 | Landed cost, revaluation, valuation (as-of), COGS, cache, thin web | **Complete** — `docs/superpowers/plans/2026-07-26-phase-c3-landed-reval-reports.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-c-fifo-costing.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`

## Features

- FIFO cost layers + consumptions (location-scoped) — **shipped**
- Cost on movements (unit/total) — **shipped**
- Landed cost allocation — **shipped** (`/api/v1/landed-costs`)
- Inventory valuation report incl. as-of — **shipped** (`/api/v1/cost-reports/valuation`)
- Product cost inquiry — **shipped** (`/api/v1/stock/cost-layers`, cost summaries)
- COGS by period — **shipped** (`/api/v1/cost-reports/cogs`)
- Revaluation / write-down — **shipped** (`/api/v1/cost-revaluations`)
- Cost summary cache — **shipped** (`product_cost_summaries`)
- Outbox cost fields (`inventoryValueDelta`, `cogsTotal`, `landedAmount`, `revaluationValueDelta`) — **shipped** (no journals; Phase D)

## Architecture

Follows [[Clean Architecture]]. Same UoW as qty posting adds layers/consumptions.
Shared applicator: `packages/application/src/costing/apply-document-costing.ts`.
Strategy: FIFO only in C (`avg` rejects). See [[FIFO Costing]].

## Related

[[FIFO Costing]] · [[Feature Phases]] · [[Phase B]] · [[Phase D]] · [[Document Posting]]
