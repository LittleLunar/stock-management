---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-25
source_count: 1
---

# Domain Model

Core model for [[Stock Management System]].

## Hierarchy

[[Organization]] → [[Branch]] → [[Location]]

## Catalog

[[Product]] (lot/serial/expiry flags), categories, barcodes, suppliers, customers

## Stock truth

- `stock_balances` (product + location + lot)
- [[Stock Movement]] ledger (immutable)
- lots, serials, reservations

## Documents

PO, goods receipt, issue, transfer, adjustment, count, returns — draft → posted → void

## Costing & accounting

Cost layers / consumptions → journals; AP invoices + 3-way match

Details: `docs/architecture/domain-model.md`

## Sources

- [[source-product-vision-2026-07-25]]
