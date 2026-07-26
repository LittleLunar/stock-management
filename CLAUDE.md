# Memory

## Me
Building **stock-management** — multi-branch inventory + costing + accounting platform (solo shop → retail).

## Terms
| Term | Meaning |
|------|---------|
| **Phase A** | Platform skeleton (org, branch, location, products, users) |
| **Phase B** | Internal inventory loop (qty, lot/serial, documents) |
| **Phase C** | FIFO costing + valuation |
| **Phase D** | GL, AP, 3-way match, periods |
| **Phase E** | Multi-branch hardening + webhooks |
| **Phase F** | POS / external channels |
| **Document-driven** | Qty only changes via posted documents → movements |
| **GRNI** | Goods Received Not Invoiced (clearing liability) |
| **Outbox** | DB table for reliable async events (journals, webhooks) |
→ Full glossary: memory/glossary.md

## Projects
| Name | What |
|------|------|
| **stock-management** | This repo — inventory platform |
| **ipos** | Related Jaidee POS (future plug-in consumer, separate repo) |
→ Details: memory/projects/

## Preferences
- Stack: Fastify + Drizzle + Postgres + Vite/React + TanStack Router/Query + Tailwind
- No Next.js; SEO not required for app (auth-gated)
- HTMX rejected as primary UI; JSON API required for future POS
- FIFO cost layers as primary costing
- Modular monolith; no microservices day one
- **Full Clean Architecture for all phases (A–F):** `packages/domain` + `packages/application`; API infrastructure/HTTP adapters; thin web (page → hook → API client)
- Wiki at `wiki/`; plans at `docs/superpowers/plans/`
- Follow global skills under `~/.agents/skills/`

## Key paths
| Path | What |
|------|------|
| `wiki/` | LLM wiki |
| `docs/` | Specs, features, plans |
| `docs/architecture/coding-standards.md` | Clean Architecture standards |
| `packages/domain` | Pure domain |
| `packages/application` | Use cases + ports |
| `TASKS.md` | Task board |
| `.cursor/rules/` | Project AI rules (incl. `clean-architecture.mdc`) |
| `apps/api`, `apps/web` | Monorepo apps |
