---
tags:
  - feature
  - roadmap
created: 2026-07-25
updated: 2026-07-27
---

# Feature Phases

Roadmap for [[Stock Management System]]. Full checklist: `docs/FEATURES.md`.

> [!important]
> Implementation for **every** phase (A–F) must follow [[Clean Architecture]] (`docs/architecture/coding-standards.md`).

| Phase | Focus | Status | Page |
|-------|--------|--------|------|
| A | Platform skeleton | Complete (polish optional) | [[Phase A]] |
| B | Internal inventory loop | **Complete** (B1–B3, 2026-07-26) | [[Phase B]] |
| C | FIFO costing | **Complete** (C1–C3, 2026-07-26) | [[Phase C]] |
| D | Accounting / AP | **Complete** (D1–D3, 2026-07-26) | [[Phase D]] |
| E | Multi-branch hardening | **E1+E2 complete**; E3 next | [[Phase E]] |
| F | POS / channels | Someday | [[Phase F]] |

```
A  Masters + branches + locations + users
B  Qty loop: PO, receive, issue, transfer, adjust, count, lot/serial, returns, reservations ✓
C  Money on stock: FIFO, landed cost, valuation, COGS
D  Books: GL, AP, 3-way match, periods, reports
E  Multi-branch ops + webhooks + scanning (E1 ACL/UX ✓; E2 ops/approvals ✓; E3 pending)
F  POS / external channels on same APIs
```

**MVP cut:** A + B (+ light C on receipt) usable; C + D finance-grade; E + F retail scale.

**Phase B:** complete — see [[Phase B]] and `docs/superpowers/plans/2026-07-26-phase-b-inventory-loop.md`.  
**Phase C:** complete — see [[Phase C]].  
**Phase D:** complete — see [[Phase D]].  
**Phase E:** E1+E2 complete (2026-07-27) — branch ACL/UX; replenishment `purpose`, reservation lock/expire, PO + adjustment approval policies. **Next:** E3.  
Design: `docs/superpowers/specs/2026-07-26-phase-e-multi-branch-design.md` · Master: `docs/superpowers/plans/2026-07-26-phase-e-multi-branch.md` · Deep: E1 / E2 / E3 under `docs/superpowers/plans/2026-07-26-phase-e*.md`
