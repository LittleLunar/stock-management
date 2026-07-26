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
                  ├── Cost layers / consumptions ([[Phase C]] — C1 on GR; C2 all docs)
                  └── Outbox → Journal ([[Phase D]])
```

> [!note]
> **C1 shipped:** GR post creates layers and stamps movement costs; void closes
> fully open layers (`LayerInUseError` if partially consumed). Inquiry:
> `GET /api/v1/stock/cost-layers`. C2 plan covers consume/create on remaining
> docs: `docs/superpowers/plans/2026-07-26-phase-c2-fifo-consumption.md`.
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
