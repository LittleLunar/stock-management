---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-26
source_count: 2
---

# Tech Stack

Locked stack for [[Stock Management System]].

| Layer | Choice |
|-------|--------|
| API | Fastify + TypeScript |
| DB | PostgreSQL + Drizzle |
| Web | Vite + React + TypeScript |
| Routing / data | TanStack Router + TanStack Query |
| UI | Tailwind |
| Jobs | Postgres outbox first |
| Layout | `apps/api`, `apps/web`, `packages/domain`, `packages/application`, `packages/shared` |

## Architecture style

All application code follows [[Clean Architecture]]. SOLID applies within that structure ([[SOLID and Design Patterns]]). See `docs/architecture/coding-standards.md`.

## Explicitly rejected

- Next.js (auth-gated app; no SEO need)
- HTMX as primary UI (POS/scanner UX ceiling)
- Mongo as system of record
- Microservices day one
- Legacy API `modules/` service/repository layout as the target shape

## Sources

- [[source-product-vision-2026-07-25]]
- Planning decision 2026-07-26 (Full Clean Architecture packages)
