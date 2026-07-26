---
tags:
  - flow
created: 2026-07-25
updated: 2026-07-26
---

# Document Posting

Shared lifecycle for inventory documents.

## Standard post/void (B1 + B2)

Goods receipt, stock issue, stock adjustment, and stock count:

```
draft ──post──► posted ──void──► void
                  │
                  ├── Stock Movements (immutable)
                  ├── Balance updates (same Unit of Work)
                  ├── Outbox enqueue ([[Phase B]])
                  ├── Cost layers / consumptions ([[Phase C]] — complete)
                  └── Outbox → Journal ([[Phase D]])
```

> [!note]
> **Phase C complete:** Every inventory post/void updates cost layers and stamps
> movement costs in the same UoW. Landed cost and revaluation adjust open-layer
> `unit_cost` via `cost_layer_value_adjustments` (no qty). Reports:
> `GET /api/v1/cost-reports/valuation`, `GET /api/v1/cost-reports/cogs`.
> Outbox payloads may include `inventoryValueDelta` / `cogsTotal` /
> `landedAmount` / `revaluationValueDelta` for Phase D journals (not posted in C).
> Design: `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`.

## Transfer ship/receive (B2)

Stock transfer uses ship and receive instead of a single post:

```
draft ──ship──► in_transit ──receive──► received
  │                  │
  └── void           └── void (never after received)
```

Ship moves qty from `fromLocation` → `transitLocation`; receive moves
`transitLocation` → `toLocation`. Transit location must have `type=transit`.

## Rules

- Posted docs are immutable; voids create reversing movements
- Negative on-hand rejected on outbound posts (issue, transfer ship, adjustment decrease, count variance down)
- `external_system` + `external_id` for replay-safe idempotency on post (and ship/receive where applicable)
- Lot/serial/expiry flags enforced per product on all document lines

Related: [[Document-Driven Inventory]] · [[Stock Movement]] · [[Phase B]] · [[Purchase to Stock]]
