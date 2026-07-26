---
tags:
  - wiki/index
created: 2026-07-25
updated: 2026-07-27
---

# Wiki Index

## Onboarding

- [[Getting Started]] — how to orient in this repo and wiki
- [[overview]] — high-level product synthesis

## Entities

- [[Stock Management System]] — the product
- [[Organization]] — tenant root
- [[Branch]] — retail/site unit
- [[Location]] — warehouse/bin under a branch
- [[Product]] — SKU with tracking policies
- [[Stock Movement]] — immutable ledger entry

## Concepts

- [[Tech Stack]] — Fastify, Drizzle, Postgres, Vite/React, TanStack, Tailwind, Vitest, Prettier, Pino
- [[Clean Architecture]] — mandatory Full CA for Phases A–F (`domain` / `application` packages)
- [[SOLID and Design Patterns]] — SOLID within Clean Architecture
- [[Domain Model]] — core entities and relationships
- [[Document-Driven Inventory]] — qty only via posted documents
- [[Org Branch Location]] — hierarchy for multi-branch scale
- [[FIFO Costing]] — cost layers and valuation
- [[Inventory Accounting]] — GL, GRNI, COGS, AP
- [[POS Integration Boundary]] — inventory as platform; POS as consumer

## Features (phases)

- [[Feature Phases]] — Phase A–F roadmap summary
- [[Phase A]] — platform skeleton
- [[Phase B]] — internal inventory loop (**complete** B1–B3 qty loop)
- [[Phase C]] — costing (**complete** C1–C3)
- [[Phase D]] — accounting (**complete** D1–D3)
- [[Phase E]] — multi-branch hardening (**complete** E1–E3)
- [[Phase F]] — POS and channels

## Flows

- [[Purchase to Stock]] — PO → receipt post/void → immutable movements and balance
- [[Document Posting]] — draft → post → void

## Sources

- [[source-product-vision-2026-07-25]] — conversation decisions (vision, stack, phases)

## Analyses / Comparisons

_(none yet)_
