---
tags:
  - feature
  - phase-e
created: 2026-07-25
updated: 2026-07-27
---

# Phase E

Multi-branch retail hardening.

## Status

**E1 + E2 shipped (2026-07-27).** E3 plan ready; implement next. Slice order: **E1 → E2 → E3**.

| Slice | Focus | Status / Plan |
|-------|--------|----------------|
| E1 | Membership→context ACL, branch-filtered lists, web branch switcher, HQ vs branch reports, outbox `branchId` attribution, transfer branch columns | **Complete** — `docs/superpowers/plans/2026-07-26-phase-e1-branch-hardening.md` |
| E2 | Cross-branch replenishment transfers, reservation locking/expiry, approval policies for PO + adjustments | **Complete** — `docs/superpowers/plans/2026-07-26-phase-e2-ops-approvals.md` |
| E3 | Webhook subscriptions + HMAC delivery via outbox, FEFO/quarantine hard rules, barcode lookup + scan UX | **Plan ready** — `docs/superpowers/plans/2026-07-26-phase-e3-webhooks-fefo-barcode.md` |

Master: `docs/superpowers/plans/2026-07-26-phase-e-multi-branch.md`  
Design: `docs/superpowers/specs/2026-07-26-phase-e-multi-branch-design.md`

## E2 shipped notes (2026-07-27)

- **Transfer purpose** — `StockTransfer.purpose` (`standard` \| `replenishment`); replenishment requires distinct `from_branch_id` / `to_branch_id`. Migration `0010_phase_e2_ops_approvals.sql`.
- **Replenish UX** — transfer API accepts `purpose`; web replenish wizard creates HQ→branch (or cross-branch) transfers with `purpose: replenishment`.
- **Reservation discipline** — create path locks balance (`FOR UPDATE` / locking fake); concurrent oversell test green; expire poller hard-releases open rows past `expiresAt` and recomputes `qtyReserved` (null `expiresAt` left alone).
- **Approval policies** — `approval_policies` table; `ensureDefaults` seeds `purchase_order` + `stock_adjustment` with `required=true`; `GET/PUT /api/v1/approval-policies`.
- **PO gate** — `submitted` → `approved` via `POST .../approve`; GR post blocked when policy on and PO not approved.
- **Adjustment gate** — `draft` → `pending_approval` (submit) → `approved` → `posted` when required; post from draft allowed when policy off.
- **Approvers** — `document.approve` for `org_admin` / `branch_manager` + branch access.
- **Out of scope (deferred to E3)** — webhooks, FEFO/quarantine hard rules, barcode scan UX.

## E1 shipped notes (2026-07-27)

- **Context ACL** — `Membership.branchIds` (empty = HQ); `assertBranchAccess` / `resolveActiveBranch` / `canPerform` in domain; HTTP `RequestContext` loads role + branch grants from DB and optional `X-Branch-Id`. No membership → 401; bad branch / role denial → 403.
- **List filters** — document lists use server `BranchListFilter`; client cannot widen scope.
- **Write gates** — create/post gated by role matrix + branch assert when scoped.
- **Transfer columns** — migration `0009_phase_e1_branch_hardening.sql` adds `stock_transfers.from_branch_id` / `to_branch_id` (set from locations).
- **Outbox / journals** — `document.posted` / `document.voided` payloads include `branchId` when resolvable; journal mapper carries `branch_id`.
- **Web** — shell branch switcher persists `activeBranchId`, sends `X-Branch-Id`; reports default to active branch; empty = HQ “All branches” consolidated.

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

- Branch-scoped UX vs HQ consolidated views — **E1 complete**
- Membership ACL + `X-Branch-Id` request context — **E1 complete**
- Outbox `branchId` attribution for journals — **E1 complete**
- Transfer `from_branch_id` / `to_branch_id` denormalized — **E1 complete**
- Inter-branch replenishment workflows — **E2 complete**
- Reservation discipline / oversell prevention — **E2 complete**
- Approval policies (PO + adjustments) — **E2 complete**
- Webhooks for external systems — **E3 planned**
- Quarantine / FEFO hard rules — **E3 planned**
- Barcode scanning UX polish — **E3 planned**

## Related

[[Org Branch Location]] · [[POS Integration Boundary]] · [[Feature Phases]] · [[Phase D]] · [[Clean Architecture]]
