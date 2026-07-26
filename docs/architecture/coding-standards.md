# Coding standards — Clean Architecture

Project-wide rules for application code in Phases **A–F**. Cursor rules: `.cursor/rules/clean-architecture.mdc`, `.cursor/rules/stack-conventions.mdc`. Wiki: [[Clean Architecture]].

> [!important]
> Full Clean Architecture is mandatory. Do not create the legacy `apps/api/src/modules/<x>/{routes,service,repository}` shape.

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Domain | `packages/domain` | Entities, value objects, domain errors |
| Application | `packages/application` | Use cases + ports (interfaces) |
| Shared contracts | `packages/shared` | Zod DTOs for HTTP/API only |
| Infrastructure | `apps/api/src/infrastructure` | Drizzle, DB, adapters implementing ports |
| Interfaces | `apps/api/src/interfaces/http` | Fastify routes; parse Zod; call use cases |
| Composition root | `apps/api/src/main` | Wire adapters → use cases → routes |
| Web | `apps/web` | Page → TanStack Query hook → API client |

## Dependency rule

Dependencies point **inward** only.

- Domain depends on nothing (pure TypeScript)
- Application depends on `domain` only
- Infrastructure implements application ports; may use Drizzle + domain + shared
- HTTP adapters call use cases; may use shared Zod; must not embed business rules
- Web may import `packages/shared` only — **never** domain or application

## SOLID (within Clean Architecture)

| Principle | Application |
|-----------|-------------|
| **S** | One reason to change per layer artifact |
| **O** | New capabilities via new use cases / adapters |
| **L** | Ports safely replaceable with test doubles |
| **I** | Small focused ports (`BranchRepository`, not mega stores) |
| **D** | Use cases depend on ports; wire concrete adapters at composition root |

## Patterns by phase

| Pattern | Phases |
|---------|--------|
| CA packages, ports, use cases, composition root, thin UI | A–F |
| Unit of Work (document post transaction) | B+ |
| Outbox for journals/webhooks | B+ / D / E / F |
| Strategy (costing, approvals, channels) | C / E / F |
| Idempotency (`external_system` + `external_id`) | B / F |

## Rejected

- Fat route handlers with SQL or business rules
- Drizzle / Fastify types inside domain or application
- God use cases spanning unrelated aggregates
- Direct quantity edits on product rows
- Web importing `@stock-management/domain` or `@stock-management/application`
- New code under legacy `apps/api/src/modules/`

## Review gate

Before marking any coding task done: new code sits in the correct CA layer and dependency rule holds. Spec: `docs/superpowers/specs/2026-07-26-clean-architecture-design.md`.

## Related

- [tech-stack.md](./tech-stack.md)
- [domain-model.md](./domain-model.md)
- [FEATURES.md](../FEATURES.md)
