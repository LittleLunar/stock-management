# Clean Architecture Design

**Date:** 2026-07-26  
**Status:** Approved  
**Scope:** Monorepo-wide Full Clean Architecture before Phase B

## Problem

Phase A used a layered `routes → service → repository` shape inside `apps/api/src/modules/`. That is not Full Clean Architecture: no pure domain package, no application ports, concrete repositories injected by type, and docs still taught the interim shape as the standard.

## Decisions

| Decision | Choice |
|----------|--------|
| Style | Full Clean Architecture |
| Migration | Big-bang Phase A before Phase B |
| Packaging | Packages-first: `packages/domain`, `packages/application` |
| Deploy | Web and API separately deployable |
| Microservices | Modular monolith now; packages allow later extract |
| Web | Presentation only; may import `packages/shared` only |

## Layers

1. **Domain** (`packages/domain`) — entities, value objects, domain errors; zero framework imports
2. **Application** (`packages/application`) — use cases + ports; depends on domain only
3. **Shared** (`packages/shared`) — Zod transport DTOs/API contracts; not the domain model
4. **Infrastructure** (`apps/api/src/infrastructure`) — Drizzle, DB, adapters implementing ports
5. **Interfaces** (`apps/api/src/interfaces/http`) — Fastify routes; parse Zod; call use cases
6. **Composition root** (`apps/api/src/main`) — wire adapters → use cases → routes
7. **Web** (`apps/web`) — page → hook → API client

## Dependency rule

Dependencies point inward only. Outer layers may depend on inner; never the reverse.

```
web ──HTTP──► interfaces ──► application ──► domain
                    ▲              ▲
                    │              │
              shared (DTO)   infrastructure (implements ports)
```

## Web / API split

- `apps/web` must not import `@stock-management/domain` or `@stock-management/application`
- Shared Zod schemas are the HTTP contract
- Domain write logic never ships in the SPA bundle

## Enforcement

- ESLint `no-restricted-imports` per package
- Docs, wiki, Cursor rules describe Full CA only
- Phase B blocked until typecheck + lint boundaries green

## Out of scope

- Phase B inventory documents
- Microservice split
- Auth beyond header stub
- Breaking REST URL changes
