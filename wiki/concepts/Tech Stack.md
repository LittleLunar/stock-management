---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-27
source_count: 4
---

# Tech Stack

Locked stack for [[Stock Management System]].

| Layer | Choice |
|-------|--------|
| API | Fastify + TypeScript |
| DB | PostgreSQL + Drizzle |
| Web | Vite + React + TypeScript |
| Routing / data | TanStack Router + TanStack Query |
| Forms | react-hook-form + Zod resolvers |
| UI | Tailwind; Sonner toasts |
| i18n | i18next + react-i18next (`en` / `th`); flat dotted keys; locale in `localStorage` |
| Logging | Fastify/Pino (pretty in dev); `x-request-id` correlation |
| Validation | Zod (HTTP DTOs + env + shared error envelope) |
| Tests | Vitest |
| Format / lint | Prettier + ESLint (CA import boundaries) |
| CI | GitHub Actions (`typecheck`, `lint`, `test`) |
| Jobs | Postgres outbox first |
| Layout | `apps/api`, `apps/web`, `packages/domain`, `packages/application`, `packages/shared` |

## Architecture style

All application code follows [[Clean Architecture]]. SOLID applies within that structure ([[SOLID and Design Patterns]]). See `docs/architecture/coding-standards.md`.

## DX foundation (pre–Phase B)

- Shared `ErrorEnvelopeSchema` in `packages/shared` — API errors always include `requestId`
- Zod-validated env for API (`PORT`, `DATABASE_URL`, `LOG_LEVEL`, `NODE_ENV`) and web (`VITE_API_URL`)
- Web uses shared DTOs + typed `ApiError`; no Sentry/OpenAPI yet
- Web i18n: catalogs under `apps/web/src/i18n/locales/{en,th}/`; shell language switcher; API errors mapped by `code` on the client

Spec: `docs/superpowers/specs/2026-07-26-dx-foundation-design.md`
Web i18n: `docs/superpowers/specs/2026-07-27-web-i18n-design.md`

## Explicitly rejected

- Next.js (auth-gated app; no SEO need)
- HTMX as primary UI (POS/scanner UX ceiling)
- Mongo as system of record
- Microservices day one
- Legacy API `modules/` service/repository layout as the target shape
- Biome as ESLint replacement (CA `no-restricted-imports` stays on ESLint)

## Sources

- [[source-product-vision-2026-07-25]]
- Planning decision 2026-07-26 (Full Clean Architecture packages)
- Planning decision 2026-07-26 (DX foundation tooling)
- Planning decision 2026-07-27 (web EN/TH i18n)
