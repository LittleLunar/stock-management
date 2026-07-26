# Phase B Design — Internal Inventory Loop

**Date:** 2026-07-26  
**Status:** Approved for planning (implementation gated until Phase A polish / explicit start)  
**Features:** `docs/FEATURES.md` § Phase B  
**Wiki:** [[Phase B]], [[Document-Driven Inventory]], [[Document Posting]], [[Purchase to Stock]]

## Summary

Phase B delivers the full **quantity** cycle: document-driven stock, lots/serials, PO → receipt, outbound docs, returns structure, and POS-ready availability/reservation stubs. Cost **fields** may appear on receipt lines; **FIFO cost layers remain Phase C**.

## Slices

| Slice | Focus | Plan |
|-------|--------|------|
| **B1** | Ledger + UoW post/void + PO → GR + stock inquiry + thin web | `docs/superpowers/plans/2026-07-26-phase-b1-po-goods-receipt.md` |
| **B2** | Issue, transfer (in-transit), adjustment, stock count | `docs/superpowers/plans/2026-07-26-phase-b2-outbound-documents.md` |
| **B3** | Supplier/customer returns, reservations + availability, outbox consumer | `docs/superpowers/plans/2026-07-26-phase-b3-returns-reservations-outbox.md` |

Master index: `docs/superpowers/plans/2026-07-26-phase-b-inventory-loop.md`

## Locked decisions (all slices)

| Topic | Choice |
|-------|--------|
| Architecture | Full Clean Architecture (`packages/domain`, `packages/application`, API adapters, thin web) |
| Document storage | **Typed tables** per document type (not polymorphic header) |
| Qty truth | Posted documents → immutable `stock_movements` → `stock_balances` |
| Void | Reversing movements only; never UPDATE/DELETE ledger rows |
| Posting TX | Unit of Work: doc status + movements + balances + outbox (+ idempotency) in one TX |
| Idempotency | Optional `external_system` + `external_id` on post |
| Outbox (B1) | Enqueue `document.posted` / `stock.changed` only; no worker until B3 |
| Costing | Store `unitCost` on GR (and later outbound) lines; **no** FIFO layers in B |
| Partial PO receive | Allowed; cumulative received ≤ ordered; over-receive rejected |
| Ad-hoc GR | Allowed without PO |
| Negative stock | Reject |
| UI | API + thin web each slice (page → hook → client) |
| Auth | Existing `X-Org-Id` / `X-User-Id` stub |

## Locked decisions (B2)

| Topic | Choice |
|-------|--------|
| Transfer shape | Header `fromLocationId`, `toLocationId`, `transitLocationId` (`type=transit`); lines product/lot/serial/qty |
| Transfer flow | `draft` → ship (`in_transit`, from→transit) → receive (transit→to); atomic ship-all / receive-all |
| Transfer void | Only `draft` or `in_transit`; never after `received` |
| Issue | `issueType`: `consume` \| `sample` \| `write_off` \| `other` + optional `reasonNote` |
| Adjustment | `reasonCode` + `reasonNote`; signed line qty; no approval gate |
| Count | Snapshot `expectedQty` on draft; variance = counted − expected at post; expected visible |

## Locked decisions (B3)

| Topic | Choice |
|-------|--------|
| Reservation commit | Same UoW: release reserved + create/post `stock_issue` (`issueType: other` until Phase F `sale`) |
| Reservation expiry | Optional `expiresAt`; soft-ignore expired opens in availability; no auto-release job |
| Availability | By `productId` + `branchId` (sum locations) |
| Reserve grain | `locationId` + product (+ lot when tracked) |
| Customer return | Always restock to `locationId` |
| Supplier return | Simple outbound; `supplierId` required; optional GR links; no RMA |
| Outbox poller | In-process if `OUTBOX_POLLER_ENABLED=true`; mark processed; no webhooks |
| Serials | Supplier return → status `returned`; customer return → `in_stock` |

## Shared posting model

```
draft ──post──► posted ──void──► void
                  │
                  ├── stock_movements (immutable)
                  ├── stock_balances (± qty)
                  └── outbox_events
```

Transfer special case (B2): `draft` → `in_transit` → `received` (or void while in transit with rules).

## Dependency order

```
B1 (foundation) → B2 (outbound docs reuse UoW/stock) → B3 (reservations + returns + outbox poller)
                                                              ↓
                                                         Phase C (FIFO on same movements)
```

## Non-goals (Phase B)

- FIFO layers, landed cost, valuation reports (C)
- GL journals, AP, 3-way match (D)
- Webhooks to external systems, FEFO hard-block, barcode scanning UX (E)
- Built-in or external POS UI (F) — B3 only stubs APIs POS will call

## Review gate

Wrong CA layer = slice not done. Spec for CA: `docs/superpowers/specs/2026-07-26-clean-architecture-design.md`.
