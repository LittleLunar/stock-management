# Phase D — Accounting (Master Plan)

> **For agentic workers:** Do **not** start coding until the user explicitly starts a slice. Execute **D1 → D2 → D3** using `superpowers:subagent-driven-development` or `superpowers:executing-plans` against each deep slice plan. Master indexes D1–D3; deep plans are ready — implement only after the user starts a slice.

**Goal:** Complete Phase D accounting across three vertical slices, each producing working, testable software: GL/journals from outbox, AP with exact 3-way match and aging, then reports/close checklist/thin web.

**Architecture:** Full Clean Architecture. Inventory post/void UoW unchanged except optional void outbox cost enrichment. Journals created **asynchronously** by extending the outbox poller. AP invoice post runs in its own UoW. Spec: [`docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`](../specs/2026-07-26-phase-d-accounting-design.md).

**Tech Stack:** Fastify, Drizzle, PostgreSQL, Zod, Vitest, Vite/React, TanStack Query.

**Status:** Planning complete (2026-07-26). Deep D1–D3 plans ready. Implementation not started.

## Global Constraints

- Full Clean Architecture — no `apps/api/src/modules/`
- Org-scoped queries always
- Document-driven qty only; immutable movements; void via reverse
- Journals **async via outbox** — not inside inventory post TX; inventory UoW unchanged except optional void cost enrichment
- **Hard period close**: reject new journals dated in closed period; reopen is explicit admin action
- Money/qty: Phase B/C `Number()` + string pattern; org currency only
- Auth stub: `X-Org-Id` + `X-User-Id`
- Coding standards: `docs/architecture/coding-standards.md`
- Features checklist: `docs/FEATURES.md` § Phase D

---

## Slice index

| Order | Slice | Deliverable | Plan | Implement after |
|-------|-------|-------------|------|-----------------|
| 1 | **D1** | CoA, account mapping, monthly periods, outbox→journals, journal browser API, void/reverse journals | [phase-d1-gl-journals.md](./2026-07-26-phase-d1-gl-journals.md) | Explicit start |
| 2 | **D2** | Supplier invoices, 3-way match (PO↔receipt↔invoice), match journals (GRNI→AP), AP aging | [phase-d2-ap-three-way.md](./2026-07-26-phase-d2-ap-three-way.md) | D1 shipped |
| 3 | **D3** | Trial balance, P&L, balance sheet (optional branch), period-close checklist, thin web | [phase-d3-reports-close-web.md](./2026-07-26-phase-d3-reports-close-web.md) | D2 shipped |

```mermaid
flowchart LR
  C3[C3 outbox cost fields] --> D1[D1 GL journals]
  D1 --> D2[D2 AP three-way]
  D2 --> D3[D3 reports close web]
  D3 --> E[Phase E webhooks]
```

---

## FEATURES.md coverage map

| Feature area | Slice |
|--------------|-------|
| Chart of accounts | D1 |
| Account mapping (events → GL) | D1 |
| Accounting periods open/close | D1 (open/close API); D3 (close checklist) |
| Auto journals from inventory posts | D1 |
| Journal browser (doc → journal → lines) | D1 |
| Void / reverse journals with source void | D1 |
| Supplier invoices (bills) | D2 |
| 3-way match PO ↔ receipt ↔ invoice | D2 |
| AP aging | D2 |
| Trial balance / P&L / balance sheet | D3 |
| Period close checklist | D3 |
| Thin accounting web | D3 |

---

## Locked decisions (summary)

Full table: design spec. Highlights:

| Topic | Choice |
|-------|--------|
| Slice order | **1A**: D1 GL → D2 AP/3-way/aging → D3 reports/close/web |
| AP scope | **2A**: bills + 3-way match + AP aging; **no payments / bank / remittance** |
| Journal timing | Async via outbox poller — not inside inventory post TX |
| Journal immutability | Never UPDATE/DELETE lines; void → reversing journal linked to source |
| Idempotency | One journal per `(orgId, sourceOutboxEventId)` unique |
| Period grain | Monthly from `organizations.fiscal_year_start_month` |
| Period close | Hard close; reopen is explicit admin action |
| Close checklist | Soft warnings only — does not auto-close |
| 3-way match | Exact qty and unit-cost match (no % tolerance); inventory bills require PO **and** GR line links |
| Invoice lifecycle | `draft` → `posted` → `voided`; no `paid` state |
| AP aging | Buckets 0–30 / 31–60 / 61–90 / 90+; open = entire posted balance (no payments) |
| Manual journals | No manual journals in D (read-only browser only) |
| Transfer ship/receive | No GL in D when no money fields |

---

## Out of scope (whole Phase D)

**Deferred to later phases**
- Webhook HTTP delivery → Phase E

**Not on A–F roadmap (until later)**
- AP payments, remittance, bank reconciliation
- Multi-currency / FX
- Tax/VAT engines
- Manual journal create UI/API
- Match % tolerances
- Non-inventory / expense-only AP without PO
- Moving-average costing / per-serial cost
- Decimal library migration

---

## Suggested TASKS.md board

```
Active:
- [ ] Phase D1 — GL / CoA / periods / auto journals (plan ready) — implement first
- [ ] Phase D2 — AP / 3-way / aging (plan ready) — after D1
- [ ] Phase D3 — reports / close checklist / web (plan ready) — after D2

Someday:
- [ ] Phase E — multi-branch hardening / webhooks
```

---

## Related artifacts

| Artifact | Path |
|----------|------|
| Design spec | [`docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`](../specs/2026-07-26-phase-d-accounting-design.md) |
| Deep D1 | [`2026-07-26-phase-d1-gl-journals.md`](./2026-07-26-phase-d1-gl-journals.md) |
| Deep D2 | [`2026-07-26-phase-d2-ap-three-way.md`](./2026-07-26-phase-d2-ap-three-way.md) |
| Deep D3 | [`2026-07-26-phase-d3-reports-close-web.md`](./2026-07-26-phase-d3-reports-close-web.md) |
| Wiki | [[Phase D]] · [[Inventory Accounting]] · [[Feature Phases]] |
| Features | `docs/FEATURES.md` § Phase D |

---

## Definition of done (whole Phase D)

- All three deep plans implemented and checkboxes complete
- All `docs/FEATURES.md` Phase D rows implemented and tested
- Outbox-driven journals for inventory money events + invoice match; voids reverse
- Hard period close enforced; checklist warns (does not auto-close)
- Thin web for core accountant flows
- `pnpm typecheck` + accounting/AP tests green
- Wiki [[Phase D]] marked complete; Phase E unblocked
