---
tags:
  - concept
created: 2026-07-26
updated: 2026-07-26
source_count: 2
---

# SOLID and Design Patterns

SOLID and design patterns applied **within** [[Clean Architecture]] for [[Stock Management System]] across [[Feature Phases]] **A–F**.

> [!important]
> Canonical layout is [[Clean Architecture]] (`packages/domain`, `packages/application`, API adapters). This page does not authorize the legacy `modules/*/service|repository|routes` shape.

## SOLID

| Principle | Application |
|-----------|-------------|
| **S** | One reason to change per layer artifact |
| **O** | New capabilities via new use cases / adapters |
| **L** | Ports replaceable with test doubles |
| **I** | Small focused ports per aggregate |
| **D** | Depend on ports; wire adapters at composition root |

## Patterns

- **All phases:** Ports, use cases, composition root, thin UI, Zod at HTTP boundary
- **B+:** Unit of Work on document post; Outbox; Idempotency
- **C / E / F:** Strategy/Policy for costing, approvals, channels

## Docs

- `docs/architecture/coding-standards.md`
- `.cursor/rules/clean-architecture.mdc`
- `.cursor/rules/stack-conventions.mdc`

## Related

[[Clean Architecture]] · [[Tech Stack]] · [[Feature Phases]]

## Sources

- Planning decision 2026-07-26 (SOLID for all phases)
- Planning decision 2026-07-26 (Full Clean Architecture supersedes layered modules as primary standard)
