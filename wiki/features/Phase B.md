---
tags:
  - feature
  - phase-b
created: 2026-07-25
updated: 2026-07-26
---

# Phase B

Internal inventory loop — full quantity cycle across locations.

## Status

**B1 implementation in progress (2026-07-26).** Purchase-order, goods-receipt,
and stock-inquiry application/HTTP flows are available, including transactional
receipt post/void.
Execute **B1 → B2 → B3**.

| Slice | Focus                                                                                                          | Plan                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| B1    | PO → GR, ledger, lots/serials, UoW, idempotency, outbox enqueue, stock inquiry, thin web — **deep plan ready** | `docs/superpowers/plans/2026-07-26-phase-b1-po-goods-receipt.md`            |
| B2    | Issue, transfer (explicit transit loc), adjustment, count — **deep plan approved**                             | `docs/superpowers/plans/2026-07-26-phase-b2-outbound-documents.md`          |
| B3    | Returns, reservations, availability, outbox poller — **deep plan approved**                                    | `docs/superpowers/plans/2026-07-26-phase-b3-returns-reservations-outbox.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-b-inventory-loop.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-b-design.md`

## Features

- Stock balances + movement ledger
- Lots & serials
- PO → goods receipt (lot/expiry/serial capture)
- Purchase-order REST lifecycle: create, list, get, update, submit, cancel, close
- Goods-receipt REST lifecycle: create, list, get, update, post, void
- Stock inquiry REST endpoints for balances, low-stock filtering, movements,
  lots, and serials
- Receipt post/void updates immutable movements and balances in the same Unit of Work
- Receipt post supports replay-safe external idempotency keys
- Stock issue, transfer (in-transit), adjustment, count
- Supplier / customer returns structure
- Low stock, lot/serial lookup
- Reservations + availability APIs (POS stubs)
- Idempotency + outbox events

## Architecture

Follows [[Clean Architecture]]. Typed document tables. Unit of Work on post/void. No FIFO layers ([[Phase C]]).

## Related

[[Document-Driven Inventory]] · [[Document Posting]] · [[Purchase to Stock]] · [[POS Integration Boundary]] · [[Feature Phases]]
