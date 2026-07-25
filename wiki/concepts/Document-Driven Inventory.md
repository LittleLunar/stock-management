---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-25
source_count: 1
---

# Document-Driven Inventory

Quantity never changes by editing a product or balance row in the UI. Only a **posted document** creates [[Stock Movement]] rows and updates balances.

## Document states

`draft` → `posted` → `void` (void creates reversing movements; never delete history)

## Why

- Auditability for warehouse and finance
- Safe concurrency (row locks on balances)
- Same path for internal UI and future POS

Related: [[Document Posting]], [[FIFO Costing]]

## Sources

- [[source-product-vision-2026-07-25]]
