---
tags:
  - source
created: 2026-07-25
updated: 2026-07-25
---

# source-product-vision-2026-07-25

## Overview

Planning conversation (2026-07-25) that defined product scope, phases, domain model direction, DB sketch, and locked tech stack for stock-management.

## Key Points

- Full-loop inventory: buy → receive → store → issue → return/adjust → reorder → report
- Start solo shop; model multi-branch from day one ([[Org Branch Location]])
- Internal inventory first; POS-pluggable via JSON APIs ([[POS Integration Boundary]])
- Both lot/expiry and serial tracking
- Many locations; full costing + accounting
- Stack: Fastify + Drizzle + Postgres + Vite/React + TanStack + Tailwind (no Next.js; HTMX not primary)
- FIFO cost layers as primary costing
- Document-driven stock + modular monolith

## Implications

- Scaffold wiki/docs/rules before code
- Phase A plan is next executable work
- Related POS work may later integrate with `ipos` repo

## Cross-references

[[overview]] · [[Tech Stack]] · [[Feature Phases]] · [[Domain Model]]
