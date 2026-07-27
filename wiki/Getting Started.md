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
8. Auth + notifications (shipped): [[Authentication]], [[Notifications]] — specs under `docs/superpowers/specs/2026-07-27-authentication-design.md` and `…-notifications-design.md`; plan `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`; inventory in `docs/FEATURES.md`

## Local scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev:api` / `pnpm dev:web` | Run apps |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Quality gates |
| `pnpm format` | Prettier write |
| `pnpm db:clear` | Truncate all app rows (`scripts/clear-data.sql`); keeps schema + drizzle migrations |

Env template: `.env.example` (`DATABASE_URL`, `PORT`, `LOG_LEVEL`, `NODE_ENV`, `VITE_API_URL`, plus `JWT_ACCESS_SECRET`, refresh/action token secrets, SMTP, etc.).

## Local bootstrap (JWT auth)

> [!note]
> Identity is a **Bearer JWT**. Tenant context: `X-Org-Id` (+ optional `X-Branch-Id`) checked against membership. Prefer `/signup` or invite accept over legacy stub users.

1. Configure env from `.env.example` (JWT + mailer secrets)
2. Migrate DB, then `pnpm dev:api` / `pnpm dev:web`
3. Open `/signup` to create org + admin, verify email (or use mailer/dev links), then `/login`
4. Notification preferences: account menu → Notification preferences

If you see `401 UNAUTHORIZED` / stale session:

1. Run `pnpm db:clear` if needed
2. Clear browser storage for the web origin (tokens + org keys)
3. Sign up / log in again

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
