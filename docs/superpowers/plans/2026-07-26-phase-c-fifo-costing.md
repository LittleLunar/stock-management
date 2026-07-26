# Phase C — FIFO Costing (Master Plan)

> **For agentic workers:** Do **not** start coding until the user explicitly starts a slice. Execute **C1 → C2 → C3** using `superpowers:subagent-driven-development` or `superpowers:executing-plans` against each deep slice plan. All deep plans are written; implement in order.

**Goal:** Complete Phase C costing across three vertical slices, each producing working, testable software.

**Architecture:** Full Clean Architecture. Location-scoped FIFO cost layers in the same Unit of Work as qty movements/balances. Spec: [`docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`](../specs/2026-07-26-phase-c-costing-design.md).

**Tech Stack:** Fastify, Drizzle, PostgreSQL, Zod, Vitest, Vite/React, TanStack Query.

**Status:** Planning complete (2026-07-26). Deep C1, C2, and C3 plans ready. Implementation not started.

## Global Constraints

- Full Clean Architecture — no `apps/api/src/modules/`
- Org-scoped queries always
- Document-driven qty only; immutable movements; void via reverse
- Same TX: doc + movements + balances + **cost layers/consumptions** (+ value adjustments in C3) + outbox (+ idempotency)
- FIFO only; `products.costing_method = avg` rejects cost-affecting posts
- Layer grain: `org + product + location + optional lot`
- Auth stub: `X-Org-Id` + `X-User-Id`
- Coding standards: `docs/architecture/coding-standards.md`
- Features checklist: `docs/FEATURES.md` § Phase C
- Money/qty: Phase B `Number()` + string pattern

---

## Slice index

| Order | Slice | Deliverable | Plan | Implement after |
|-------|-------|-------------|------|-----------------|
| 1 | **C1** | Schema `cost_layers` / `cost_consumptions`; domain FIFO + Strategy; GR post/void creates/closes layers; stamp receipt movement costs; product cost-layer inquiry | [phase-c1-cost-layers-receipt.md](./2026-07-26-phase-c1-cost-layers-receipt.md) | Explicit start |
| 2 | **C2** | Consume/create on issue, transfer (via transit), adjust, count, returns; stamp outbound costs; `unitCost` on inbound-create lines | [phase-c2-fifo-consumption.md](./2026-07-26-phase-c2-fifo-consumption.md) | C1 shipped |
| 3 | **C3** | Landed cost; revaluation; valuation (current + as-of); COGS; cost summary cache; thin web; outbox cost fields | [phase-c3-landed-reval-reports.md](./2026-07-26-phase-c3-landed-reval-reports.md) | C2 shipped |

```mermaid
flowchart LR
  C1[C1 GR layers] --> C2[C2 all docs consume]
  C2 --> C3[C3 landed reval reports]
  C3 --> D[Phase D journals]
```

---

## FEATURES.md coverage map

| Feature area | Slice |
|--------------|-------|
| FIFO cost layers (create on receipt) | C1 |
| FIFO cost layers (consume on outbound) | C2 |
| Cost on movements (inbound) | C1 |
| Cost on movements (outbound) | C2 |
| Product cost inquiry (open layers) | C1 |
| Landed cost | C3 |
| Valuation report (branch / location / lot / as-of) | C3 |
| COGS report | C3 |
| Revaluation / write-down | C3 |
| Cost summary cache | C3 |

---

## Locked decisions (summary)

Full table: design spec. Highlights:

| Topic | Choice |
|-------|--------|
| Layer grain | Location-scoped (+ optional lot) |
| Transfers | Ship/receive move layers through transit; preserve `unit_cost` + `received_at`; not COGS |
| GR `unitCost` | Required (line → PO line → else error) |
| +adjust / +count / customer return | Require line `unitCost` → create layers |
| Outbound | FIFO consume; supplier return prefers GR-line layers |
| As-of valuation | Reconstruct via layers + consumptions + `cost_layer_value_adjustments` + `original_unit_cost` |
| Phase D | Enrich outbox only; no journals in C |

---

## Out of scope (whole Phase C)

**Deferred to later phases**
- GL / AP / 3-way match → Phase D
- Webhook HTTP → Phase E

**Not on A–F roadmap**
- Moving-average costing (keep `avg` as reject-on-post)
- Per-serial cost ledger
- Reservation layer pinning
- Decimal library migration

---

## Suggested TASKS.md board

```
Active:
- [ ] Phase C1 — cost layers on goods receipt (plan ready) — implement first
- [ ] Phase C2 — FIFO consumption (plan ready) — after C1
- [ ] Phase C3 — landed, reval, reports, web (plan ready) — after C2

Someday:
- [ ] Phase D accounting — after Phase C implementation
```

---

## Related artifacts

| Artifact | Path |
|----------|------|
| Design spec | [`docs/superpowers/specs/2026-07-26-phase-c-costing-design.md`](../specs/2026-07-26-phase-c-costing-design.md) |
| Deep C1 | [`2026-07-26-phase-c1-cost-layers-receipt.md`](./2026-07-26-phase-c1-cost-layers-receipt.md) |
| Deep C2 | [`2026-07-26-phase-c2-fifo-consumption.md`](./2026-07-26-phase-c2-fifo-consumption.md) |
| Deep C3 | [`2026-07-26-phase-c3-landed-reval-reports.md`](./2026-07-26-phase-c3-landed-reval-reports.md) |
| Wiki | [[Phase C]] · [[FIFO Costing]] · [[Feature Phases]] |
| Features | `docs/FEATURES.md` § Phase C |

---

## Definition of done (whole Phase C)

- All three deep plans implemented and checkboxes complete
- `pnpm typecheck` + costing/inventory tests green
- Wiki [[Phase C]] marked complete; Phase D unblocked
- All `docs/FEATURES.md` Phase C rows satisfied (including as-of valuation)
