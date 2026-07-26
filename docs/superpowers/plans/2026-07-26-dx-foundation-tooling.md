# DX Foundation Tooling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shared error/env contracts, API logging + request IDs, typed web client with forms/toasts/error boundary, Vitest, Prettier, CI.

**Architecture:** Contracts in `packages/shared`; API adapters emit envelope; web consumes shared DTOs and shows toast/boundary UX.

**Tech Stack:** Fastify/Pino, Zod, Vitest, Prettier, react-hook-form, sonner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-26-dx-foundation-design.md`

---

### Task 1: Shared error envelope + entity DTOs + Vitest

**Files:**
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/entities.ts` (response DTOs)
- Create: `packages/shared/src/errors.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json` (vitest script + dep)

### Task 2: API env, request ID, Pino, error handler

**Files:**
- Create: `apps/api/src/infrastructure/config/env.ts`
- Create: `apps/api/src/interfaces/plugins/request-id.ts`
- Modify: `apps/api/src/interfaces/plugins/error-handler.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/package.json` (pino, pino-pretty if needed)

### Task 3: Web client + env + ApiError

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/errors.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/package.json` (shared already; ensure dependency)

### Task 4: Web UX — toasts, boundary, forms

**Files:**
- Create: `apps/web/src/components/ErrorBoundary.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/hooks/masters.ts` (use shared Create* types)
- Modify: `apps/web/package.json` (rhf, resolvers, sonner)

### Task 5: Vitest monorepo + Prettier + CI

**Files:**
- Modify: root `package.json`
- Create: `.prettierrc`, `.prettierignore`
- Modify: `eslint.config.js` (prettier)
- Create: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Vitest configs as needed per package

### Task 6: Wiki

**Files:**
- Modify: `wiki/concepts/Tech Stack.md`, `wiki/Getting Started.md`, `wiki/index.md`, `wiki/log.md`
