# Phase A Platform Skeleton Implementation Plan

> [!warning]
> **Architecture superseded (2026-07-26).** Target shape is Full Clean Architecture — see `docs/superpowers/specs/2026-07-26-clean-architecture-design.md` and `docs/superpowers/plans/2026-07-26-clean-architecture-migration.md`. This plan remains historical for Phase A feature scope only. Do not recreate `apps/api/src/modules/*/routes|service|repository`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the monorepo and ship Phase A masters (org, branch, location, users/roles, products, categories, suppliers) with Postgres + Drizzle—no stock movements yet.

**Architecture (historical):** pnpm workspaces with `apps/api` (Fastify), `apps/web` (Vite React + TanStack), `packages/shared` (Zod). **Current target:** `packages/domain` + `packages/application` + API infrastructure/HTTP adapters ([[Clean Architecture]]).

**Tech Stack:** Fastify, TypeScript, Drizzle, PostgreSQL, Vite, React, TanStack Router, TanStack Query, Tailwind, Zod

## Global Constraints

- No Next.js; no HTMX primary UI; no Mongo
- Every table includes `org_id` where tenant-scoped (except `organizations`)
- Soft status on masters (`active`/`inactive`); no hard deletes of masters in API
- Follow `.cursor/rules/stack-conventions.mdc` including **SOLID & design patterns** (all phases)
- API modules: `*.routes.ts` / `*.service.ts` / `*.repository.ts` — no Drizzle in handlers
- Web: page → hook → API client
- Auth stub: headers `X-Org-Id` + `X-User-Id`
- Update `wiki/`, `TASKS.md`, and `docs/` after scaffold lands
- Coding standards: `docs/architecture/coding-standards.md`

**Spec:** `docs/superpowers/specs/2026-07-25-product-vision.md`  
**Features:** `docs/FEATURES.md` § Phase A  
**Wiki:** [[Phase A]]

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json` (workspaces), `pnpm-workspace.yaml` (or npm workspaces)
- Create: `apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json`
- Create: root `tsconfig` / `.gitignore` / `.env.example`

**Interfaces:**
- Produces: `pnpm install` works; `pnpm --filter api` and `pnpm --filter web` scripts exist

- [x] **Step 1: Initialize workspace root** with workspaces pointing at `apps/*` and `packages/*`
- [x] **Step 2: Create `apps/api`** Fastify + TypeScript entry `src/index.ts` that listens on `:3001` and returns `{ ok: true }` on `GET /health`
- [x] **Step 3: Create `apps/web`** Vite React TS; Tailwind; placeholder home page
- [x] **Step 4: Create `packages/shared`** empty package exporting a sample Zod schema `HealthResponse`
- [x] **Step 5: Add `.env.example`** with `DATABASE_URL=postgresql://...` and `PORT=3001`
- [ ] **Step 6: Commit** `chore: scaffold monorepo apps and shared package` (when user requests)

---

### Task 2: Drizzle + Phase A schema

**Files:**
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/db/schema/*.ts` (organizations, branches, locations, users, memberships, membership_branches, categories, products, product_barcodes, suppliers, supplier_products, customers)
- Create: migration SQL under `apps/api/drizzle/`

**Interfaces:**
- Produces: `pnpm --filter api db:generate` and `db:migrate` scripts

- [ ] **Step 1: Add drizzle-orm + postgres driver + drizzle-kit**
- [ ] **Step 2: Define tables** matching `docs/architecture/domain-model.md` Phase A fields (uuid PKs, unique `(org_id, code/sku)`, timestamps)
- [ ] **Step 3: Generate and apply migration** against local Postgres
- [ ] **Step 4: Commit** `feat(api): add Phase A drizzle schema and migration`

---

### Task 3: API modules for masters (layered)

**Files:**
- Create: `apps/api/src/modules/{org,branches,locations,products,categories,suppliers,users}/` each with `*.routes.ts`, `*.service.ts`, `*.repository.ts`
- Create: org/auth context plugin (`X-Org-Id`, `X-User-Id`); shared error helper
- Create: Zod request schemas in `packages/shared`

**Interfaces:**
- Produces REST under `/api/v1`:
  - `GET/PATCH /orgs/:orgId`
  - CRUD `/branches`, `/locations`, `/products`, `/categories`, `/suppliers`
  - Basic `/users` + `/memberships` (auth stub headers)

- [ ] **Step 1: Register Fastify plugins** under `/api/v1` with org context
- [ ] **Step 2: Implement branches + locations** (routes → service → repository, org scoping in repo)
- [ ] **Step 3: Implement products + barcodes + categories** (same layering)
- [ ] **Step 4: Implement suppliers (+ optional supplier_products) + org settings**
- [ ] **Step 5: Implement users/memberships**
- [ ] **Step 6: Manual smoke** via curl/httpie; commit `feat(api): Phase A master data routes`

---

### Task 4: Web app shell + masters UI

**Files:**
- Create: TanStack Router routes under `apps/web/src/routes/`
- Create: Query client provider; API client pointing at `VITE_API_URL`
- Create: pages for Branches, Locations, Products, Suppliers (list + simple form)

**Interfaces:**
- Consumes: `/api/v1` JSON from Task 3
- Produces: navigable shell with sidebar and working CRUD screens for Phase A masters

- [ ] **Step 1: Add TanStack Router + Query + Tailwind layout shell**
- [ ] **Step 2: Branches list/create**
- [ ] **Step 3: Locations list/create (filter by branch)**
- [ ] **Step 4: Products list/create (tracking checkboxes)**
- [ ] **Step 5: Suppliers list/create**
- [ ] **Step 6: Commit** `feat(web): Phase A master data screens`

---

### Task 5: Docs/wiki closeout

**Files:**
- Modify: `TASKS.md`, `wiki/features/Phase A.md`, `wiki/log.md`, `README.md`
- Create: `docs/tutorials/local-setup.md` (brief)

- [ ] **Step 1: Write local-setup tutorial** (Postgres, migrate, run api/web)
- [ ] **Step 2: Mark Phase A scaffold tasks done in TASKS.md**; add Phase B as Active when ready
- [ ] **Step 3: Append wiki log** `update | Phase A scaffold landed`
- [ ] **Step 4: Commit** `docs: Phase A closeout`

---

## Self-review

1. **Spec coverage:** Phase A feature table in `docs/FEATURES.md` maps to Tasks 2–4; customers stub can be schema-only in Task 2.
2. **Placeholders:** None intentional—implementers use concrete route list in Task 3.
3. **Type consistency:** Prefer shared Zod types named `Branch`, `Location`, `Product` in `packages/shared`.

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-25-phase-a-platform-skeleton.md`.

**1. Subagent-Driven (recommended)** — fresh subagent per task  
**2. Inline Execution** — executing-plans in this session  

Which approach?
