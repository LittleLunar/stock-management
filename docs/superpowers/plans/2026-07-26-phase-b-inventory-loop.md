# Phase B — Internal Inventory Loop (Master Plan)

> **For agentic workers:** Do **not** start coding until the user explicitly starts Phase B. Execute slices in order B1 → B2 → B3 using `superpowers:subagent-driven-development` or `superpowers:executing-plans` against each slice plan.

**Goal:** Complete Phase B quantity loop across three vertical slices, each producing working, testable software.

**Architecture:** Full Clean Architecture. Typed inventory documents. Unit of Work on post/void. Immutable movements. Spec: `docs/superpowers/specs/2026-07-26-phase-b-design.md`.

**Tech Stack:** Fastify, Drizzle, PostgreSQL, Zod, Vitest, Vite/React, TanStack Query.

## Global Constraints

- Full Clean Architecture — no `apps/api/src/modules/`
- Org-scoped queries always
- Document-driven qty only; immutable movements; void via reverse
- Same TX: doc + movements + balances + outbox (+ idempotency)
- No FIFO cost layers (Phase C)
- Auth stub: `X-Org-Id` + `X-User-Id`
- Coding standards: `docs/architecture/coding-standards.md`
- Features checklist: `docs/FEATURES.md` § Phase B

---

## Slice index

| Order | Slice | Deliverable | Plan |
|-------|-------|-------------|------|
| 1 | **B1** | PO → GR, ledger, lots/serials, UoW, idempotency, outbox enqueue, stock inquiry, thin web | [phase-b1-po-goods-receipt.md](./2026-07-26-phase-b1-po-goods-receipt.md) (deep plan ready) |
| 2 | **B2** | Issue, transfer (explicit transit), adjustment, stock count + web | [phase-b2-outbound-documents.md](./2026-07-26-phase-b2-outbound-documents.md) (deep plan approved) |
| 3 | **B3** | Returns, reservations, availability, outbox poller + web | [phase-b3-returns-reservations-outbox.md](./2026-07-26-phase-b3-returns-reservations-outbox.md) (deep plan approved) |

## FEATURES.md coverage map

| Feature area | Slice |
|--------------|-------|
| Stock balances | B1 |
| Movement ledger | B1 (+ types expanded B2/B3) |
| Lots / serials | B1 (outbound consume B2) |
| Purchase orders | B1 |
| Goods receipt | B1 |
| Stock issue | B2 |
| Transfers | B2 |
| Adjustments | B2 |
| Stock counts | B2 |
| Returns (supplier / customer structure) | B3 |
| Low stock | B1 (filter on balances) |
| Lot / serial lookup | B1 |
| Reservations API | B3 |
| Availability API | B3 |
| Idempotency | B1 (reuse B2/B3) |
| Outbox events | B1 enqueue; B3 consumer |
| Document rules draft/posted/void | B1 (+ transfer states B2) |

## Suggested TASKS.md board after plans land

```
Waiting On / Someday:
- [ ] Phase B1 — PO → goods receipt (plan ready)
- [ ] Phase B2 — outbound documents (plan ready)
- [ ] Phase B3 — returns, reservations, outbox consumer (plan ready)
```

Start B1 only when user says to begin Phase B (and Phase A polish is acceptable to leave/finish).

## Definition of done (whole Phase B)

- All three slice plans checked complete
- `pnpm typecheck` + inventory tests green
- Wiki [[Phase B]] marked complete for qty loop; Phase C unblocked for FIFO
- No reservations oversell path without B3 availability math
