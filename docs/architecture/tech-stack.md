# Tech stack (explanation)

Locked choices for this repo. Wiki: [[Tech Stack]]. Rule: `.cursor/rules/stack-conventions.mdc`.

| Layer | Choice | Notes |
|-------|--------|-------|
| API | Fastify + TypeScript | Modular monolith |
| ORM | Drizzle | SQL-friendly for FIFO locks |
| DB | PostgreSQL 16+ | Partials, JSONB outbox |
| Web | Vite + React + TypeScript | Auth-gated SPA |
| Routing | TanStack Router | Type-safe |
| Server state | TanStack Query | Lists, mutations, posting |
| UI | Tailwind | + shadcn/Radix as needed |
| Validation | Zod | Shared in `packages/shared` |
| Jobs | Postgres outbox | BullMQ later if needed |

## Rejected

Next.js, HTMX-as-primary-UI, Mongo-as-SOR, day-one microservices.

## Target layout

```
apps/api/
apps/web/
packages/shared/
docs/
wiki/
```
