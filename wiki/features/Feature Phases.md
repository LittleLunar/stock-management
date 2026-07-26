---
tags:
  - feature
  - roadmap
created: 2026-07-25
updated: 2026-07-26
---

# Feature Phases

Roadmap for [[Stock Management System]]. Full checklist: `docs/FEATURES.md`.

> [!important]
> Implementation for **every** phase (A–F) must follow [[Clean Architecture]] (`docs/architecture/coding-standards.md`).

| Phase | Focus | Status | Page |
|-------|--------|--------|------|
| A | Platform skeleton | Complete (polish optional) | [[Phase A]] |
| B | Internal inventory loop | **Complete** (B1–B3, 2026-07-26) | [[Phase B]] |
| C | FIFO costing | C1+C2 complete; C3 plan ready | [[Phase C]] |
| D | Accounting / AP | Someday | [[Phase D]] |
| E | Multi-branch hardening | Someday | [[Phase E]] |
| F | POS / channels | Someday | [[Phase F]] |

```
A  Masters + branches + locations + users
B  Qty loop: PO, receive, issue, transfer, adjust, count, lot/serial, returns, reservations ✓
C  Money on stock: FIFO, landed cost, valuation, COGS
D  Books: GL, AP, 3-way match, periods, reports
E  Multi-branch ops + webhooks + scanning
F  POS / external channels on same APIs
```

**MVP cut:** A + B (+ light C on receipt) usable; C + D finance-grade; E + F retail scale.

**Phase B:** complete — see [[Phase B]] and `docs/superpowers/plans/2026-07-26-phase-b-inventory-loop.md`.  
**Next:** [[Phase C]] — implement C3 (C1+C2 complete; deep plan ready).
Design: `docs/superpowers/specs/2026-07-26-phase-c-costing-design.md` · Master: `docs/superpowers/plans/2026-07-26-phase-c-fifo-costing.md`
