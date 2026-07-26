---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-26
source_count: 3
---

# Inventory Accounting

Inventory events post double-entry journals (usually via outbox after stock post).

> [!note]
> [[Phase C]] enriches outbox payloads with cost money fields
> (`inventoryValueDelta`, `cogsTotal`, `landedAmount`, `revaluationValueDelta`).
> [[Phase D]] **complete**: outbox poller creates balanced journals; AP 3-way match
> posts GRNI→AP journals sync; TB/P&L/BS + close checklist + thin web shipped.

## Typical postings

| Event | Debit | Credit |
|-------|-------|--------|
| Goods receipt | Inventory | GRNI |
| Supplier invoice match | GRNI | AP |
| Stock issue / sale | COGS | Inventory |
| Loss adjustment | Expense | Inventory |

Also: chart of accounts, periods, AP 3-way match (PO ↔ receipt ↔ invoice). **No supplier payments in Phase D.** Phase: [[Phase D]] (**complete** 2026-07-26)

Design: `docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md` · Master: `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`

## Sources

- [[source-product-vision-2026-07-25]]
- Phase D accounting design + master + D1–D3 plans (`docs/superpowers/`, 2026-07-26)
- Phase D1–D3 implementation (2026-07-26)
