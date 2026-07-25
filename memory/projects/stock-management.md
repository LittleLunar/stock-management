# stock-management

**Status:** Greenfield — docs/wiki/rules scaffolded; code not started  
**Stack:** Fastify + Drizzle + Postgres + Vite/React + TanStack + Tailwind

## What It Is

Scalable stock management: multi-location inventory with lot/serial tracking, FIFO costing, and full accounting. Starts as solo-shop internal inventory; designed for multi-branch retail and POS plug-in later.

## Key Decisions
- Document-driven stock (immutable movements)
- FIFO cost layers primary
- JSON API first-class for future POS
- No Next.js / no HTMX-as-primary-UI
- Phases A→F (see [[Feature Phases]] in wiki)

## Key People
- Owner: Lunar (repo owner)

## Related
- ipos — POS that may consume APIs later
