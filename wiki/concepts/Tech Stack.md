---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-26
source_count: 3
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

Spec: `docs/superpowers/specs/2026-07-26-dx-foundation-design.md`

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
