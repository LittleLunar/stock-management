---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-25
source_count: 1
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
| Layout | `apps/api`, `apps/web`, `packages/shared` |

## Explicitly rejected

- Next.js (auth-gated app; no SEO need)
- HTMX as primary UI (POS/scanner UX ceiling)
- Mongo as system of record
- Microservices day one

## Sources

- [[source-product-vision-2026-07-25]]
