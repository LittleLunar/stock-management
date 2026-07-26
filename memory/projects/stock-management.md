# stock-management

**Status:** Phase A — Full Clean Architecture in place; polish remaining  
**Stack:** Fastify + Drizzle + Postgres + Vite/React + TanStack + Tailwind  
**Coding:** Full Clean Architecture — `packages/domain` + `packages/application` + API adapters (all phases A–F)

## What It Is

Scalable stock management: multi-location inventory with lot/serial tracking, FIFO costing, and full accounting. Starts as solo-shop internal inventory; designed for multi-branch retail and POS plug-in later.

## Key Decisions
- Document-driven stock (immutable movements)
- FIFO cost layers primary
- JSON API first-class for future POS
- No Next.js / no HTMX-as-primary-UI
- Full Clean Architecture mandatory for all phases (packages-first)
- Modular monolith now; packages enable later service extract
- Phases A→F (see [[Feature Phases]] in wiki)

## Key People
- Owner: Lunar (repo owner)

## Related
- ipos — POS that may consume APIs later
