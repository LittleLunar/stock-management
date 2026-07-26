# Clean Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Phase A to Full Clean Architecture (packages-first) and rewrite all docs/rules/wiki so every phase develops under CA.

**Architecture:** `packages/domain` + `packages/application`; API = infrastructure + HTTP + composition root; web = thin client.

**Tech Stack:** Fastify, TypeScript, Drizzle, PostgreSQL, Vite, React, TanStack, Tailwind, Zod, ESLint

## Global Constraints

- Domain: no Zod/Drizzle/Fastify/React/shared
- Application: domain only (no Drizzle/Fastify/React)
- Web: no domain/application imports
- Keep `/api/v1` contracts stable
- Docs first, then packages, then API rewire

---

### Task 1: Spec + docs/rules/wiki

- [x] Design spec at `docs/superpowers/specs/2026-07-26-clean-architecture-design.md`
- [x] Rewrite coding-standards, stack-conventions, clean-architecture rule, wiki, AGENTS, CLAUDE, TASKS, memory, README

### Task 2: Scaffold packages

- [x] `packages/domain`, `packages/application` with tsconfig and exports
- [x] Wire workspace deps into `apps/api`

### Task 3: Boundaries

- [x] ESLint configs with `no-restricted-imports`

### Task 4: Migrate domain + application + API adapters

- [x] Move entities/errors, ports, use cases
- [x] Drizzle under infrastructure; HTTP under interfaces; composition root
- [x] Delete old `modules/` layout

### Task 5: Web guardrails + verify

- [x] Web ESLint ban domain/application
- [x] `pnpm typecheck` green; Phase B gated
