# Tech stack (explanation)

Locked choices for this repo. Wiki: [[Tech Stack]]. Rules: `.cursor/rules/stack-conventions.mdc`, `.cursor/rules/clean-architecture.mdc`.

| Layer | Choice | Notes |
|-------|--------|-------|
| API | Fastify + TypeScript | Modular monolith |
| ORM | Drizzle | SQL-friendly for FIFO locks |
| DB | PostgreSQL 16+ | Partials, JSONB outbox |
| Web | Vite + React + TypeScript | Auth-gated SPA |
| Routing | TanStack Router | Type-safe |
| Server state | TanStack Query | Lists, mutations, posting |
| UI | Tailwind | + shadcn/Radix as needed |
| Validation | Zod | Shared in `packages/shared` (HTTP contracts) |
| Jobs | Postgres outbox | BullMQ later if needed |

## Rejected

Next.js, HTMX-as-primary-UI, Mongo-as-SOR, day-one microservices, legacy `modules/` service layout as target architecture.

## Coding standards

All phases: [coding-standards.md](./coding-standards.md) (Full Clean Architecture).

## Target layout

```
apps/api/                 # HTTP + infrastructure + composition root
apps/web/                 # Thin SPA
packages/domain/          # Pure domain
packages/application/     # Use cases + ports
packages/shared/          # Zod DTOs
docs/
wiki/
```
