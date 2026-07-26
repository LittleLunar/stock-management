---
tags:
  - wiki/log
created: 2026-07-25
updated: 2026-07-26
---

# Wiki Log

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
