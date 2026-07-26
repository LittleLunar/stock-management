# Coding standards (explanation)

Project-wide rules for application code in Phases **A–F**. Cursor rule: `.cursor/rules/stack-conventions.mdc`. Wiki: [[SOLID and Design Patterns]].

## SOLID

| Principle | Application |
|-----------|-------------|
| **S** Single Responsibility | Route = HTTP only; service = use-case rules; repository = Drizzle; Zod = I/O validation |
| **O** Open/Closed | New domains = new Fastify plugins / use cases; avoid catch-all services |
| **L** Liskov Substitution | Ports safely replaceable (test doubles, adapters) |
| **I** Interface Segregation | Small focused ports per aggregate/use case |
| **D** Dependency Inversion | Depend on ports; wire concrete Drizzle/outbox at composition root |

## Layered module shape (API)

```
apps/api/src/modules/<domain>/
  <domain>.routes.ts       # HTTP only
  <domain>.service.ts      # use cases — no request/reply types
  <domain>.repository.ts   # Drizzle — org scoping here
```

## Web

- Route/page components render UI only
- Data via TanStack Query hooks
- HTTP only inside an API client module

## Patterns by phase

| Pattern | Phases |
|---------|--------|
| Module, Repository, Service, DTO/Zod, composition root, thin UI | A–F |
| Unit of Work (document post transaction) | B+ |
| Outbox for journals/webhooks | B+ / D / E / F |
| Strategy (costing, approvals, channels) | C / E / F |
| Idempotency (`external_system` + `external_id`) | B / F |

## Rejected

- Fat route handlers with SQL
- God services spanning unrelated domains
- Direct quantity edits on product rows
- Cross-module imports of repository internals

## Related

- [tech-stack.md](./tech-stack.md)
- [domain-model.md](./domain-model.md)
- [FEATURES.md](../FEATURES.md)
