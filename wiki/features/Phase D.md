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

**Phase D complete (2026-07-26).** D1–D3 shipped. Phase E unblocked.

| Slice | Focus | Status / Plan |
|-------|--------|----------------|
| D1 | CoA, account mapping, periods, outbox→journals, journal browser, void/reverse | **Complete** — `docs/superpowers/plans/2026-07-26-phase-d1-gl-journals.md` |
| D2 | Supplier invoices, 3-way match (PO↔receipt↔invoice), match journals (GRNI→AP), AP aging | **Complete** — `docs/superpowers/plans/2026-07-26-phase-d2-ap-three-way.md` |
| D3 | Trial balance, P&L, balance sheet, period-close checklist, thin web | **Complete** — `docs/superpowers/plans/2026-07-26-phase-d3-reports-close-web.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`

## Features

- Chart of accounts + event→account mapping — **D1 shipped**
- Accounting periods (open/close) — **D1 shipped**
- Auto journals from inventory posts (outbox→journals) — **D1 shipped**
- Supplier invoices + 3-way match — **D2 shipped**
- AP aging — **D2 shipped**
- Trial balance; P&L; balance sheet — **D3 shipped**
- Period close checklist — **D3 shipped**
- Thin web for journals / AP / reports — **D3 shipped**

## Related

[[Inventory Accounting]] · [[Feature Phases]] · [[Phase C]] · [[Document Posting]] · [[Phase E]]
