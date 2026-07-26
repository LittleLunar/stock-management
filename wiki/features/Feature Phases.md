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

| Phase | Focus | Page |
|-------|--------|------|
| A | Platform skeleton | [[Phase A]] |
| B | Internal inventory loop | [[Phase B]] |
| C | FIFO costing | [[Phase C]] |
| D | Accounting / AP | [[Phase D]] |
| E | Multi-branch hardening | [[Phase E]] |
| F | POS / channels | [[Phase F]] |

```
A  Masters + branches + locations + users
B  Qty loop: PO, receive, issue, transfer, adjust, count, lot/serial
C  Money on stock: FIFO, landed cost, valuation, COGS
D  Books: GL, AP, 3-way match, periods, reports
E  Multi-branch ops + webhooks + scanning
F  POS / external channels on same APIs
```

**MVP cut:** A + B (+ light C on receipt) usable; C + D finance-grade; E + F retail scale.

**Phase B plans:** sliced B1 → B2 → B3 — see [[Phase B]] and `docs/superpowers/plans/2026-07-26-phase-b-inventory-loop.md`.
