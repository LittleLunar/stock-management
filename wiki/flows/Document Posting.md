---
tags:
  - flow
created: 2026-07-25
updated: 2026-07-25
---

# Document Posting

Shared lifecycle for inventory documents.

```
draft ──post──► posted ──void──► void
                  │
                  ├── Stock Movements (immutable)
                  ├── Cost layers / consumptions ([[Phase C]])
                  └── Outbox → Journal ([[Phase D]])
```

Transfer special case: `draft` → `in_transit` → `received`.

Rules: posted docs are immutable; voids reverse; `external_system` + `external_id` for idempotency.

Related: [[Document-Driven Inventory]] · [[Stock Movement]]
