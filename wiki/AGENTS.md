---
tags:
  - wiki/agent
created: 2026-07-25
updated: 2026-07-27
---

# Wiki Operating Schema

> [!important]
> **Before every ingest, query, lint, or update, read [[index]] and the relevant linked pages first. After every operation, update every affected page, then refresh [[index]] and [[log]].**

Root agent entry: also see repository `AGENTS.md`.

## Scope

This vault documents the stock-management product: domain, architecture, phases, and patterns. Application code lives under `apps/` and `packages/` (Full [[Clean Architecture]]).

## Canonical Pages

- Product: [[Stock Management System]], [[overview]]
- Stack: [[Tech Stack]]
- Architecture: [[Clean Architecture]], [[SOLID and Design Patterns]]
- Domain: [[Domain Model]], [[Document-Driven Inventory]]
- Costing / accounting: [[FIFO Costing]], [[Inventory Accounting]]
- Structure: [[Org Branch Location]]
- Integrations: [[POS Integration Boundary]]
- Access: [[Authentication]], [[Notifications]]
- Roadmap: [[Feature Phases]] (under `features/`)

## Workflows

### Ingest

1. Read [[index]] and relevant pages
2. Create/update `sources/`
3. Update entities/concepts/features
4. Refresh [[overview]], [[index]], [[log]]

### Query

1. Read [[index]] first
2. Cite with `[[wikilinks]]`
3. File lasting answers under `analyses/` or `comparisons/`
4. Append [[log]]

### Lint

1. Orphans, stale claims, missing pages
2. Fix approved issues
3. Append [[log]]
