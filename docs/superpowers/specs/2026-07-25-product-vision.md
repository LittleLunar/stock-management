# Product Vision Spec — Stock Management

**Date:** 2026-07-25  
**Status:** Accepted  
**Wiki source:** `wiki/sources/source-product-vision-2026-07-25.md`

## Problem

Need a scalable inventory system that starts as solo-shop internal stock control and can grow to multi-branch retail with costing, accounting, and POS integration—without rewriting the core.

## Goals

1. Solo shop now; multi-branch later (same model)
2. Internal inventory first; POS-pluggable via JSON APIs
3. Lot/expiry **and** serial tracking
4. Many locations
5. Full costing + accounting

## Non-goals (v1)

- Built-in POS UI (Phase F)
- Next.js / public SEO site
- Microservices
- Advanced WMS (waves, robotics)

## Architecture principles

- Document-driven inventory (immutable movements)
- Org → Branch → Location hierarchy
- FIFO cost layers
- Modular monolith: Fastify API + Vite React SPA
- Outbox for journals/webhooks
- Idempotent external refs for POS

## Phases

A Platform → B Inventory loop → C Costing → D Accounting → E Multi-branch → F POS

See `docs/FEATURES.md`.

## Stack

Fastify + Drizzle + Postgres + Vite/React + TanStack Router/Query + Tailwind

## Success (Phase A)

- Monorepo runs API + web
- Can CRUD org/branch/location/product/supplier with auth stub or real sessions
- Migrations applied for Phase A tables
