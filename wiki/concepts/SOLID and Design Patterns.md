---
tags:
  - concept
created: 2026-07-26
updated: 2026-07-26
source_count: 1
---

# SOLID and Design Patterns

Mandatory coding standard for [[Stock Management System]] across [[Feature Phases]] **A–F**.

> [!important]
> Every new module in `apps/` and `packages/shared` follows SOLID and the layered patterns below. Fat route handlers and Drizzle in HTTP handlers are rejected.

## SOLID

| Principle | Application |
|-----------|-------------|
| **S** | Route = HTTP; service = use cases; repository = Drizzle; Zod = I/O |
| **O** | New domains via new plugins/use cases |
| **L** | Ports replaceable with test doubles |
| **I** | Small focused ports per aggregate |
| **D** | Depend on ports; wire adapters at composition root |

## Module shape

```
apps/api/src/modules/<domain>/
  <domain>.routes.ts
  <domain>.service.ts
  <domain>.repository.ts
```

Web: page → TanStack Query hook → API client.

## Patterns

- **All phases:** Module/Plugin, Repository, Service, DTO/Zod, composition root, thin UI
- **B+:** Unit of Work on document post; Outbox; Idempotency
- **C / E / F:** Strategy/Policy for costing, approvals, channels

## Docs

- `docs/architecture/coding-standards.md`
- `.cursor/rules/stack-conventions.mdc`

## Related

[[Tech Stack]] · [[Feature Phases]] · [[Document-Driven Inventory]]

## Sources

- Planning decision 2026-07-26 (SOLID for all phases)
