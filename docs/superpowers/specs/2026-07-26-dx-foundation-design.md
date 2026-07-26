# DX Foundation Tooling — Design

**Date:** 2026-07-26  
**Status:** Approved (brainstorming)  
**Approach:** Shared contracts package (Approach A)

## Goals

Pre–Phase B productivity foundation across API and web:

1. Observability core — structured Pino, request IDs, Zod-validated env
2. Robust in-app error handling — shared error envelope end-to-end
3. Frontend ergonomics — shared DTOs, typed `ApiError`, RHF+Zod forms, toasts, error boundary
4. DX baseline — Vitest, Prettier (+ existing ESLint), GitHub Actions CI

## Non-goals

- Sentry / OpenTelemetry / APM
- OpenAPI / Swagger / codegen
- Playwright E2E
- Replacing ESLint with Biome
- Full shadcn/Radix UI kit

## Decisions

| Topic | Choice |
|-------|--------|
| Error monitoring | In-app only; plug Sentry later |
| Formatter | Keep ESLint CA rules + Prettier |
| Contracts home | `packages/shared` |

## Error envelope

All API error responses:

```ts
{
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  }
}
```

- Zod schema: `ErrorEnvelopeSchema` in `packages/shared`
- Domain / `AppError` / `ZodError` map to HTTP status + envelope
- Never leak stack traces to clients; log full error server-side with `requestId`

## API

- Zod env at boot: `PORT`, `DATABASE_URL`, `LOG_LEVEL`, `NODE_ENV` — fail fast
- Explicit Pino config; `pino-pretty` transport in development only
- Request ID plugin: honor `x-request-id` or generate UUID; echo on response; bind to request log
- CORS allow header includes `X-Request-Id`

## Web

- Depend on `@stock-management/shared` for create DTOs and entity response types
- Parse errors with envelope schema → typed `ApiError`
- Generate/send `x-request-id` on each request
- `react-hook-form` + `@hookform/resolvers/zod` for master forms
- Sonner toasts; React error boundary; TanStack Query global `onError`
- Zod-validated `VITE_API_URL`

## DX

- Vitest in packages (shared first; domain/application smoke as useful)
- Prettier + `eslint-config-prettier`
- CI: `pnpm typecheck`, `lint`, `test` on push/PR

## Sources

- Planning conversation 2026-07-26
- Existing error handler: `apps/api/src/interfaces/plugins/error-handler.ts`
