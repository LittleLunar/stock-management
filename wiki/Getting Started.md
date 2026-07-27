---
tags:
  - wiki/onboarding
created: 2026-07-25
updated: 2026-07-27
---

# Getting Started

## For humans

1. Read repository [README](../README.md) and [docs/FEATURES.md](../docs/FEATURES.md)
2. Skim [[overview]], [[Feature Phases]], and [[Clean Architecture]]
3. Check [TASKS.md](../TASKS.md) for active work
4. CA migration plan: `docs/superpowers/plans/2026-07-26-clean-architecture-migration.md`
5. Phase A plan (historical): `docs/superpowers/plans/2026-07-25-phase-a-platform-skeleton.md`
6. DX foundation (logging, errors, Vitest, Prettier, CI): `docs/superpowers/plans/2026-07-26-dx-foundation-tooling.md`
7. Web i18n (EN/TH): `docs/superpowers/specs/2026-07-27-web-i18n-design.md` — language switcher in the shell footer; catalogs in `apps/web/src/i18n/`

## Local scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev:api` / `pnpm dev:web` | Run apps |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Quality gates |
| `pnpm format` | Prettier write |
| `pnpm db:clear` | Truncate all app rows (`scripts/clear-data.sql`); keeps schema + drizzle migrations |

Env template: `.env.example` (`DATABASE_URL`, `PORT`, `LOG_LEVEL`, `NODE_ENV`, `VITE_API_URL`).

## Local bootstrap (auth stub)

Phase E1 loads membership from the DB for every API call (`X-Org-Id` + `X-User-Id`). Creating an org in the web shell (`POST /api/v1/orgs`) also creates:

- stub user `00000000-0000-0000-0000-000000000001` (`admin@local`)
- active HQ `org_admin` membership (no `membership_branches` rows = all branches)

If you see `401 UNAUTHORIZED` / `No active membership` with a stale `localStorage` org:

1. Run `pnpm db:clear`
2. Clear browser `localStorage` keys `orgId`, `userId`, `activeBranchId` on the web origin
3. Create the org again from the shell form

Do **not** put truncate/seed into drizzle migrations — only generate migrations when the TypeScript schema changes (`pnpm --filter @stock-management/api db:generate` then `db:migrate`).

## For agents

1. Read root `AGENTS.md` and [[index]]
2. Follow `.cursor/rules/` (wiki-contract, skills-router, stack-conventions, clean-architecture, skill-superpowers-first)
3. All `apps/` / `packages/` code: [[Clean Architecture]] — domain → application → adapters; web thin only
4. Use hot memory `CLAUDE.md`; deep memory under `memory/`
5. Before coding a feature: read the matching `wiki/features/` page + related concepts
6. After coding: update wiki pages, [[index]], [[log]], and `TASKS.md`

## Global skills

Skills live at `~/.agents/skills/`. This repo routes via `.cursor/rules/skills-router.mdc`.
