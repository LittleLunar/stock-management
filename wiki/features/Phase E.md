---
tags:
  - feature
  - phase-e
created: 2026-07-25
updated: 2026-07-26
---

# Phase E

Multi-branch retail hardening.

## Status

**Plans ready (2026-07-26).** E1–E3 deep plans written; implementation not started. Slice order: **E1 → E2 → E3**.

| Slice | Focus | Status / Plan |
|-------|--------|----------------|
| E1 | Membership→context ACL, branch-filtered lists, web branch switcher, HQ vs branch reports, outbox `branchId` attribution | **Plan ready** — `docs/superpowers/plans/2026-07-26-phase-e1-branch-hardening.md` |
| E2 | Cross-branch replenishment transfers, reservation locking/expiry, approval policies for PO + adjustments | **Plan ready** — `docs/superpowers/plans/2026-07-26-phase-e2-ops-approvals.md` |
| E3 | Webhook subscriptions + HMAC delivery via outbox, FEFO/quarantine hard rules, barcode lookup + scan UX | **Plan ready** — `docs/superpowers/plans/2026-07-26-phase-e3-webhooks-fefo-barcode.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-e-multi-branch.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-e-multi-branch-design.md`

## Locked decisions (summary)

| Topic | Choice |
|-------|--------|
| Slice order | **E1** ACL/UX/attribution → **E2** replenishment/reservations/approvals → **E3** webhooks/FEFO/barcode |
| HQ access | Membership with **no** `membership_branches` rows = all branches (HQ) |
| Active branch | Optional `X-Branch-Id`. Branch users: grant list (or first grant). HQ: omit = consolidated; set = act as that branch |
| Inter-branch move | **No new document type** — extend stock-transfer with `purpose: standard \| replenishment` |
| Approvals | PO `submitted` → approved before GR; adjustments approved before post; policy defaults on |
| Webhooks | Outbox poller: **journal then webhook**; HMAC-SHA256 signature |
| FEFO / quarantine | Prefer earliest expiry; hard-block expired/quarantine lots (except release paths) |
| Auth | Keep stub `X-Org-Id` + `X-User-Id`; resolve membership from DB |
| Architecture | Full [[Clean Architecture]] for all slices |

## Features

- Branch-scoped UX vs HQ consolidated views — **E1 planned**
- Membership ACL + `X-Branch-Id` request context — **E1 planned**
- Outbox `branchId` attribution for journals — **E1 planned**
- Inter-branch replenishment workflows — **E2 planned**
- Reservation discipline / oversell prevention — **E2 planned**
- Approval policies (PO + adjustments) — **E2 planned**
- Webhooks for external systems — **E3 planned**
- Quarantine / FEFO hard rules — **E3 planned**
- Barcode scanning UX polish — **E3 planned**

## Related

[[Org Branch Location]] · [[POS Integration Boundary]] · [[Feature Phases]] · [[Phase D]] · [[Clean Architecture]]
