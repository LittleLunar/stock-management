---
tags:
  - flow
created: 2026-07-25
updated: 2026-07-25
---

# Purchase to Stock

Happy path for inbound inventory ([[Phase B]]).

```
Purchase Order (submitted)
        ↓
Goods Receipt (draft → capture qty, location, lot/serial, cost)
        ↓
Post receipt
        ↓
Stock Movements (receipt) + balance ↑
        ↓
([[Phase C]]) Cost layers created
        ↓
([[Phase D]]) Journal: Dr Inventory / Cr GRNI
```

Related: [[Document-Driven Inventory]] · [[Document Posting]]

## Phase B1 API

Purchase orders use `/api/v1/purchase-orders`. Drafts can be created, listed,
retrieved, and updated, then moved through explicit `submit`, `cancel`, and
`close` actions.

Goods receipts use `/api/v1/goods-receipts`. Drafts can be created, listed,
retrieved, and updated. Posting creates receipt movements, increases balances,
updates received PO quantities/status, and enqueues outbox events atomically.
Voiding creates reversing movements and decreases balances; posted ledger rows
remain immutable. Post requests may provide `external_system` and `external_id`
in the body, or `x-external-system` and `x-external-id` headers, for idempotent
replay.
