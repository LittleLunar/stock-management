---
tags:
  - wiki/log
created: 2026-07-25
updated: 2026-07-26
---

# Wiki Log

## [2026-07-26] update | Phase C1 complete

Shipped C1: cost layers on GR post/void, movement unit/total cost, CostingPort
on UoW, `GET /api/v1/stock/cost-layers`. Marked C1 done in `TASKS.md`;
[[Phase C]], [[FIFO Costing]], [[Document Posting]], [[Feature Phases]],
[[index]] updated. Next: implement C2.

## [2026-07-26] update | Phase C master plan refreshed

Rewrote [[Phase C]] master plan as canonical index: all C1–C3 deep plans
linked, locked-decision summary, out-of-scope, implementation order. Planning
complete; implement C1 → C2 → C3 next.

## [2026-07-26] update | Phase C Pass 3 plan

Wrote deep C3 plan (landed cost, revaluation, as-of valuation, COGS, cost
summary cache, thin web, outbox cost fields). [[Phase C]] and [[FIFO Costing]]
updated: all C1–C3 deep plans ready. Updated [[Feature Phases]] and [[index]].

## [2026-07-26] update | Phase C Pass 2 plan

Wrote deep C2 plan (FIFO consume/create on issue, transfer, adjust, count,
returns). [[Phase C]] and [[FIFO Costing]] updated: C1+C2 plans ready; C3
still pending Pass 3. Updated [[Feature Phases]] and [[index]].

## [2026-07-26] update | Phase C Pass 1 plans

Wrote Phase C design spec, master plan, and deep C1 plan (cost layers on
goods receipt). [[Phase C]] and [[FIFO Costing]] updated: C1 plan ready;
C2/C3 deep plans deferred to later passes. Updated [[Feature Phases]] and
[[index]].

## [2026-07-26] update | Phase B complete

Marked Phase B (B1–B3 qty loop) complete in `TASKS.md` and [[Phase B]].
B3 returns, reservations, availability, and outbox poller closed the
internal inventory loop. [[Phase C]] FIFO costing is unblocked / next.
Updated [[Feature Phases]], [[POS Integration Boundary]], and [[index]].

## [2026-07-26] update | Phase B2 complete

Marked Phase B2 (issue, transfer, adjustment, count) complete in `TASKS.md`
and [[Phase B]]. B3 returns, reservations, and outbox poller is now the
active slice. Expanded [[Document Posting]] with B2 post/void and transfer
ship/receive lifecycles. Updated [[index]].

## [2026-07-26] update | Phase B2 stock-transfer HTTP

Added shared stock-transfer request schemas and the `/api/v1/stock-transfers`
create, list, get, update, ship, receive, and void endpoints. Ship and receive
move stock through an explicit transit location; ship rejects locations not
typed `transit`, and received transfers cannot be voided. Updated [[Phase B]]
and [[index]].

## [2026-07-26] update | Phase B2 stock-issue HTTP

Added shared stock-issue request schemas and the `/api/v1/stock-issues`
create, list, get, update, post, and void endpoints. Posting rejects
insufficient stock and accepts replay-safe body or header idempotency keys.
Updated [[Phase B]] and [[index]].

## [2026-07-26] update | Phase B1 complete

Marked Phase B1 (PO → goods receipt) complete in `TASKS.md` and [[Phase B]].
B2 outbound documents (issue, transfer, adjustment, count) is now the active
slice. Updated [[index]].

## [2026-07-26] update | Phase B1 thin web UI

Added thin React pages and TanStack Query hooks for purchase-order
create/list/submit, PO-backed and ad-hoc goods receipts with lot/serial/cost
capture, receipt post/void, and filtered stock balance/movement inquiry. Updated
[[Phase B]], [[Purchase to Stock]], and [[index]].

## [2026-07-26] update | Phase B1 stock-inquiry HTTP

Added shared stock query schemas and the `/api/v1/stock` balance, movement,
lot, and serial inquiry endpoints. Balance queries support product, location,
and low-stock filters; movement queries support product and location filters.
Updated [[Phase B]] and [[index]].

## [2026-07-26] update | Phase B1 goods-receipt HTTP

Added shared goods-receipt request schemas and the `/api/v1/goods-receipts`
draft, post, and void endpoints. Post accepts body or header idempotency keys;
route tests cover balance increase/reversal, replay, over-receive, and lot
tracking validation. Updated [[Phase B]], [[Purchase to Stock]], and [[index]].

## [2026-07-26] update | Phase B1 purchase-order HTTP

Added shared purchase-order request schemas and the `/api/v1/purchase-orders`
draft and lifecycle-action endpoints. Updated [[Phase B]] and [[Purchase to Stock]];
goods-receipt HTTP remains a separate follow-up.

## [2026-07-26] update | Phase B2/B3 deep plans approved

Deepened B2 (outbound docs) and B3 (returns, reservations, availability, outbox poller) to B1-level implementation plans. Spec decisions appended in `docs/superpowers/specs/2026-07-26-phase-b-design.md`. Updated [[Phase B]].

## [2026-07-26] update | Phase B plans (B1–B3)

Saved Phase B design + implementation plans before coding: master `docs/superpowers/plans/2026-07-26-phase-b-inventory-loop.md`, slices B1 PO→GR, B2 outbound docs, B3 returns/reservations/outbox. Spec: `docs/superpowers/specs/2026-07-26-phase-b-design.md`. Updated [[Phase B]], [[Feature Phases]].

## [2026-07-26] update | DX foundation tooling

Added shared error envelope + request IDs, Zod env validation, Pino config, typed web `ApiError` / RHF+Zod forms / Sonner / error boundary, Vitest, Prettier+ESLint, GitHub Actions CI. Spec: `docs/superpowers/specs/2026-07-26-dx-foundation-design.md`. Plan: `docs/superpowers/plans/2026-07-26-dx-foundation-tooling.md`. Updated [[Tech Stack]], [[Getting Started]].

## [2026-07-26] update | Full Clean Architecture migration complete

Code moved to `packages/domain` + `packages/application`; API under `infrastructure` / `interfaces/http` / `main`. ESLint import boundaries enforced. Typecheck + lint green; `/health` and org create smoke OK.

## [2026-07-26] update | Full Clean Architecture mandated

Added [[Clean Architecture]] as primary standard (packages-first: `domain` + `application`). Retargeted [[SOLID and Design Patterns]], [[Tech Stack]], [[Feature Phases]], [[Phase A]], [[Getting Started]], [[index]]. Spec: `docs/superpowers/specs/2026-07-26-clean-architecture-design.md`. Rules: `.cursor/rules/clean-architecture.mdc`.

## [2026-07-26] update | Phase A scaffold + masters in progress

Monorepo (`apps/api`, `apps/web`, `packages/shared`), Phase A Drizzle schema/migration SQL, layered master APIs, and web masters UI. Local Postgres migrate still pending. Tutorial: `docs/tutorials/local-setup.md`.

## [2026-07-26] update | SOLID coding standards (all phases)

Added [[SOLID and Design Patterns]] as project-wide rule for Phases A–F. Linked from [[Feature Phases]], [[Tech Stack]], [[index]]. Docs: `docs/architecture/coding-standards.md`. Cursor: `.cursor/rules/stack-conventions.mdc`.

## [2026-07-25] ingest | Product vision and stack decisions

Scaffolded wiki from planning conversation: full-loop inventory, multi-branch path, lot+serial, FIFO costing, accounting, POS-pluggable APIs. Locked stack Fastify + Drizzle + Postgres + Vite/React + TanStack + Tailwind. Created overview, entities, concepts, phase feature pages, flows, and source summary.
