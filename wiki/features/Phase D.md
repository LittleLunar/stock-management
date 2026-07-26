---
tags:
  - feature
  - phase-d
created: 2026-07-25
updated: 2026-07-26
---

# Phase D

Accounting — books tied to inventory.

## Status

**Planning complete (2026-07-26).** Design + master + deep D1–D3 plans ready. Implementation not started — implement **D1 → D2 → D3** when started.

| Slice | Focus | Status / Plan |
|-------|--------|----------------|
| D1 | CoA, account mapping, periods, outbox→journals, journal browser, void/reverse | Plan ready — `docs/superpowers/plans/2026-07-26-phase-d1-gl-journals.md` |
| D2 | Supplier invoices, 3-way match (PO↔receipt↔invoice), AP aging | Plan ready — `docs/superpowers/plans/2026-07-26-phase-d2-ap-three-way.md` |
| D3 | Trial balance, P&L, balance sheet, period-close checklist, thin web | Plan ready — `docs/superpowers/plans/2026-07-26-phase-d3-reports-close-web.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`

## Features

- Chart of accounts + event→account mapping — D1
- Accounting periods (open/close) — D1
- Auto journals from inventory posts (outbox→journals) — D1
- Supplier invoices + 3-way match — D2
- AP aging — D2
- Trial balance; P&L; balance sheet — D3
- Period close checklist — D3
- Thin web for journals / AP / reports — D3

## Related

[[Inventory Accounting]] · [[Feature Phases]] · [[Phase C]] · [[Document Posting]]
