# Phase C Design — FIFO Costing

**Date:** 2026-07-26  
**Status:** Sequenced planning complete — deep C1, C2, and C3 plans ready. Implement C1 → C2 → C3.  
**Features:** `docs/FEATURES.md` § Phase C  
**Wiki:** [[Phase C]], [[FIFO Costing]], [[Document Posting]]

## Summary

Phase C puts **money on stock**: location-scoped FIFO cost layers created on inbound posts, consumed on outbound posts, stamped onto movements, plus landed cost, revaluation, valuation (current + as-of), COGS, and a cost summary cache. Journals stay Phase D; Phase C only enriches outbox payloads for later GL.

## Slices

| Slice | Focus | Plan |
|-------|--------|------|
| **C1** | Schema + domain FIFO + Strategy; GR post/void creates/reverses layers; stamp receipt movement costs; product cost inquiry | `docs/superpowers/plans/2026-07-26-phase-c1-cost-layers-receipt.md` |
| **C2** | Consume/create on issue, transfer, adjust, count, returns; stamp outbound costs | `docs/superpowers/plans/2026-07-26-phase-c2-fifo-consumption.md` |
| **C3** | Landed cost, revaluation, valuation (incl. as-of), COGS, cost summary cache, thin web, outbox cost fields | `docs/superpowers/plans/2026-07-26-phase-c3-landed-reval-reports.md` |

Master index: `docs/superpowers/plans/2026-07-26-phase-c-fifo-costing.md`

## Locked decisions (all slices)

| Topic | Choice |
|-------|--------|
| Architecture | Full Clean Architecture; same UoW TX as qty: doc + movements + balances + **layers/consumptions** + outbox (+ idempotency) |
| Costing method | **FIFO only** in C. `products.costing_method = avg` → reject cost-affecting posts (`UnsupportedCostingMethodError`). Strategy port exists; only `FifoCostingStrategy` registered |
| Layer grain | `org_id + product_id + location_id + lot_id?` (lot when product tracks lots; else null) |
| Layer identity | One layer per inbound create movement (GR line, positive adjust, etc.); `received_at` = post time, or **preserved** across transfer hops |
| GR `unitCost` | **Required** to post. Resolve: line `unitCost` → else PO line `unitCost` when PO-linked → else `MissingUnitCostError` |
| Movement cost | `stock_movements.unit_cost` + `total_cost` (nullable for pre-cutover rows). Receipt = layer unit cost; outbound = FIFO blended/weighted from consumptions |
| Consumptions | Immutable `cost_consumptions` rows. Void **restores** `qty_remaining` and inserts reversing consumption rows (negative qty or explicit `is_reversal`) for audit |
| Void GR (C1) | If any layer from this GR has `qty_remaining < qty_original`, reject void. Else close layers (`qty_remaining = 0`), stamp void movements with reversing costs |
| Insufficient layers | `InsufficientCostError` — invariant violation if qty and layers diverge |
| Positive inbound (C2) | Adjust+, count+, customer return: require line `unitCost` → create layers |
| Negative outbound (C2) | Issue, adjust−, count−, supplier return: FIFO consume at location (+ lot) |
| Supplier return + GR line | Prefer layers originated by that GR line; else FIFO |
| Transfers (C2) | Ship: consume at from → create layers at **transit** (same `unit_cost`, preserve `received_at`). Receive: consume transit → create at to (same). Transfer is **not** COGS |
| Reservations | Do **not** pin layers |
| Serials | No per-serial cost ledger |
| Landed cost (C3) | Document allocating freight/duty to open layers (`qty_remaining > 0` only); writes `cost_layer_value_adjustments` |
| Revaluation (C3) | Document changing `unit_cost` on open layers; no qty movement; writes `cost_layer_value_adjustments` |
| Valuation | Current: `Σ qty_remaining × unit_cost`. As-of (C3): reconstruct from layers + consumptions + value adjustments |
| COGS (C3) | Sum outbound movement `total_cost` for issue / supplier return / negative adjust / negative count variance — **not** transfers |
| Cost summary cache (C3) | `product_cost_summaries` upserted in same TX as layer changes |
| Backfill | Cutover: costing from C1 forward. Optional dev script for posted GRs with `unitCost` and no layers |
| Money math | Keep Phase B `Number()` + string qty/cost pattern |
| Phase D prep | Outbox payloads may include `totalInventoryValueDelta` / `cogsTotal` (C3); **no journals** |
| Lock order | Balance locks first, then open layers `ORDER BY received_at, id` `FOR UPDATE` |
| UI | Thin web for cost screens in **C3**; C1 is API + inquiry endpoint (web optional minimal) |
| Auth | `X-Org-Id` / `X-User-Id` stub |

## Shared posting model (with costing)

```
draft ──post──► posted ──void──► void
                  │
                  ├── stock_movements (immutable; unit_cost / total_cost)
                  ├── stock_balances (± qty)
                  ├── cost_layers / cost_consumptions
                  └── outbox_events
```

## Schema (C1 core)

### `cost_layers`

| Column | Notes |
|--------|--------|
| `id` | uuid PK |
| `org_id` | tenant |
| `product_id`, `location_id` | required |
| `lot_id` | null if not lot-tracked |
| `source_document_type`, `source_document_id`, `source_document_line_id` | provenance |
| `source_movement_id` | movement that created the layer |
| `received_at` | FIFO order key |
| `unit_cost` | numeric(18,4) |
| `qty_original`, `qty_remaining` | numeric(18,4) |

Index: `(org_id, product_id, location_id, lot_id, received_at)` where `qty_remaining > 0`.

### `cost_consumptions`

| Column | Notes |
|--------|--------|
| `id`, `org_id` | |
| `cost_layer_id`, `movement_id` | |
| `qty`, `unit_cost`, `total_cost` | |
| `is_reversal` | boolean, default false (void audit) |
| `created_at` | |

### `stock_movements` additions

- `unit_cost` numeric(18,4) null  
- `total_cost` numeric(18,4) null  

### C3 additions (not in C1 migration)

- `landed_cost_documents` / lines  
- `cost_revaluations` / lines  
- `cost_layer_value_adjustments`  
- `product_cost_summaries`  

## Domain / application shape

- **Domain:** `CostLayer`, `CostConsumption`; pure `resolveReceiptUnitCost`, `assertFifoCostingMethod`, `planFifoConsume`, `planLayerCreate`, void-layer helpers in `fifo-costing.ts`
- **Application:** `CostingPort` on `UowContext`; `FifoCostingStrategy` (Strategy); extend `PostGoodsReceipt` / `VoidGoodsReceipt` in C1; other docs in C2
- **Infrastructure:** Drizzle `costing.repository.ts`; wire in `DrizzleUnitOfWork`
- **HTTP:** `GET /api/v1/stock/cost-layers` (C1); reports/landed/reval in C3

## Dependency order

```
C1 (layers on GR + inquiry) → C2 (all docs consume/create) → C3 (landed, reval, reports, web)
                                      ↓
                                 Phase D (journals from enriched outbox)
```

## Non-goals (Phase C)

- GL journals, AP, 3-way match (D)
- Webhook HTTP (E)
- Moving-average costing implementation
- Per-serial cost ledger
- Reservation layer pinning
- Decimal.js / money library migration

## Review gate

Wrong CA layer = slice not done. Spec: `docs/superpowers/specs/2026-07-26-clean-architecture-design.md`.
