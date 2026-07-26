---
tags:
  - concept
created: 2026-07-26
updated: 2026-07-26
source_count: 1
---

# Clean Architecture

Mandatory architecture for [[Stock Management System]] across [[Feature Phases]] **A–F**.

> [!important]
> Full Clean Architecture is required. Do not add code in the legacy `apps/api/src/modules/` routes/service/repository shape. See `docs/architecture/coding-standards.md` and `.cursor/rules/clean-architecture.mdc`.

## Packages and layers

| Layer | Location |
|-------|----------|
| Domain | `packages/domain` |
| Application (use cases + ports) | `packages/application` |
| Shared Zod DTOs | `packages/shared` |
| Infrastructure | `apps/api/src/infrastructure` |
| HTTP adapters | `apps/api/src/interfaces/http` |
| Composition root | `apps/api/src/main` |
| Web (presentation) | `apps/web` |

## Dependency rule

Dependencies point inward. Domain has no framework imports. Application depends on domain only. Infrastructure implements ports. Web talks HTTP and may import `packages/shared` only — never domain or application.

## Web / API deploy

Web and API deploy separately. Web is a thin SPA; all write rules live in application/domain behind the API.

## SOLID

SOLID principles apply **inside** this structure. See [[SOLID and Design Patterns]].

## Docs

- Spec: `docs/superpowers/specs/2026-07-26-clean-architecture-design.md`
- Plan: `docs/superpowers/plans/2026-07-26-clean-architecture-migration.md`
- Standards: `docs/architecture/coding-standards.md`

## Related

[[Tech Stack]] · [[Feature Phases]] · [[SOLID and Design Patterns]] · [[Document-Driven Inventory]]

## Sources

- Planning decision 2026-07-26 (Full CA, packages-first, migrate before Phase B)
