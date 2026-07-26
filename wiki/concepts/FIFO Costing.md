---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-26
source_count: 2
---

# FIFO Costing

Primary costing method: **cost layers** created on inbound posts; outbound
consumes oldest `received_at` first at the **same location** (optional lot).

## Grain

`org + product + location + optional lot`. Transfers move layers through the
transit location (**C2 shipped**), preserving `unit_cost` and `received_at`.

## Outcomes

- Every [[Stock Movement]] gets unit/total cost (**shipped**)
- Inventory valuation = Σ(layer `qty_remaining` × `unit_cost`); as-of via reconstruction (**shipped**)
- COGS for issues / supplier returns / negative adjust & count (**shipped**; excludes transfers)
- Landed cost and revaluation adjust open layer value via `cost_layer_value_adjustments` (**shipped**)
- `product_cost_summaries` cache refreshed on layer changes (**shipped**)

## Phase

[[Phase C]] — **complete** (C1–C3, 2026-07-26). Next: [[Phase D]] accounting.

Design: `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`

## Sources

- [[source-product-vision-2026-07-25]]
- `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`
