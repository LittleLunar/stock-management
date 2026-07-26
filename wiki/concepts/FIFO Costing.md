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

- Every [[Stock Movement]] gets unit/total cost (**C1 + C2 shipped**)
- Inventory valuation = Σ(layer `qty_remaining` × `unit_cost`); as-of in C3
- COGS for issues / supplier returns / negative adjust & count (C3 reports)
- Landed cost and revaluation adjust open layer value (C3)

## Phase

[[Phase C]] — **C1 + C2 complete**. Implement C3 next (deep plan ready).

Design: `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`

## Sources

- [[source-product-vision-2026-07-25]]
- `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`
