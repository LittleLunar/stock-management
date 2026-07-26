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

**B1 complete (2026-07-26).** Purchase-order, goods-receipt, and stock-inquiry
application/HTTP flows shipped, including transactional receipt post/void,
idempotency, outbox enqueue, and a thin web UI for the inbound workflow.
**B2 complete (2026-07-26).** Stock issue, transfer (explicit transit location),
adjustment, and count — REST lifecycles, transactional post/void (or
ship/receive for transfers), idempotency, outbox enqueue, and thin web UI for
all four outbound document types.
**B3 active:** returns, reservations, availability APIs, and outbox poller.

| Slice | Focus                                                                                    | Status / Plan                                                                         |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| B1    | PO → GR, ledger, lots/serials, UoW, idempotency, outbox enqueue, stock inquiry, thin web | **Complete** — `docs/superpowers/plans/2026-07-26-phase-b1-po-goods-receipt.md`       |
| B2    | Issue, transfer (explicit transit loc), adjustment, count                                | **Complete** — `docs/superpowers/plans/2026-07-26-phase-b2-outbound-documents.md`     |
| B3    | Returns, reservations, availability, outbox poller                                       | **Active** — `docs/superpowers/plans/2026-07-26-phase-b3-returns-reservations-outbox.md` |

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
- Thin web pages for PO create/list/submit, PO-backed or ad-hoc goods receipts
  with lot/serial/cost capture, receipt post/void, and stock balance/movement
  inquiry
- Receipt post/void updates immutable movements and balances in the same Unit of Work
- Receipt post supports replay-safe external idempotency keys
- Stock issue, transfer (in-transit), adjustment, count
- Stock-issue REST lifecycle: create, list, get, update, post, and void;
  posting rejects insufficient stock and supports replay-safe idempotency keys
- Stock-transfer REST lifecycle: create, list, get, update, ship, receive, and
  void; transfers move stock through an explicit transit location, reject
  non-transit locations at ship, and cannot be voided after receipt
- Stock-adjustment REST lifecycle: create, list, get, update, post, and void;
  signed line quantities (+ increase / − decrease) with header reason code;
  posting rejects negative on-hand and supports replay-safe idempotency keys
- Stock-count REST lifecycle: create, list, get, update, post, and void;
  snapshots `expectedQty` on draft line add/update; post applies variance
  (counted − expected) as adjustment movements; expected qty visible in UI
- Thin web pages for stock issues, transfers (ship/receive/void), adjustments,
  and counts — same page → hook → API client pattern as B1
- Supplier / customer returns structure
- Low stock, lot/serial lookup
- Reservations + availability APIs (POS stubs)
- Idempotency + outbox events

## Architecture

Follows [[Clean Architecture]]. Typed document tables. Unit of Work on post/void. No FIFO layers ([[Phase C]]).

## Related

[[Document-Driven Inventory]] · [[Document Posting]] · [[Purchase to Stock]] · [[POS Integration Boundary]] · [[Feature Phases]]
