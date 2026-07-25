---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-25
source_count: 1
---

# Inventory Accounting

Inventory events post double-entry journals (usually via outbox after stock post).

## Typical postings

| Event | Debit | Credit |
|-------|-------|--------|
| Goods receipt | Inventory | GRNI |
| Supplier invoice match | GRNI | AP |
| Stock issue / sale | COGS | Inventory |
| Loss adjustment | Expense | Inventory |

Also: chart of accounts, periods, AP 3-way match (PO ↔ receipt ↔ invoice). Phase: [[Phase D]]

## Sources

- [[source-product-vision-2026-07-25]]
