# Stock Management

Multi-branch inventory platform with lot/serial tracking, FIFO costing, and accounting.  
Starts as internal inventory for a solo shop; designed to scale to retail branches and POS.

## Stack

| Layer | Choice |
|-------|--------|
| API | Fastify + TypeScript |
| DB | PostgreSQL + Drizzle |
| Web | Vite + React + TypeScript |
| Routing / data | TanStack Router + TanStack Query |
| UI | Tailwind CSS |
| Jobs | Postgres outbox (BullMQ later if needed) |

## Repo layout (target)

```
apps/api/          # Fastify API
apps/web/          # Vite React SPA
packages/shared/   # Zod schemas, shared types
docs/              # Specs, plans, Diátaxis docs
wiki/              # LLM / Obsidian knowledge wiki
```

## Knowledge

| Path | Purpose |
|------|---------|
| [AGENTS.md](./AGENTS.md) | Agent + wiki operating schema |
| [wiki/](./wiki/) | Compounding product/domain wiki |
| [docs/FEATURES.md](./docs/FEATURES.md) | All phases feature list |
| [docs/](./docs/) | Specs and implementation plans |
| [TASKS.md](./TASKS.md) | Active task board |
| [CLAUDE.md](./CLAUDE.md) | Hot project memory |

## Current status

**Phase A in progress.** Monorepo scaffolded (`apps/api`, `apps/web`, `packages/shared`). SOLID standards documented. Masters API + UI landed; apply DB migration when Postgres is available.

Local setup: [docs/tutorials/local-setup.md](./docs/tutorials/local-setup.md)

## Phases (short)

| Phase | Focus |
|-------|--------|
| A | Org, branches, locations, products, users |
| B | Inventory loop (PO, receipt, issue, transfer, lot/serial) |
| C | FIFO costing + valuation |
| D | GL, AP, 3-way match |
| E | Multi-branch + webhooks |
| F | POS / external channels |

Details: [docs/FEATURES.md](./docs/FEATURES.md) · [[Feature Phases]] in wiki.
