---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-26
source_count: 1
---

# POS Integration Boundary

Inventory is the **platform**. POS (built-in or external, e.g. ipos) is a **consumer**.

## Required API surface (from Phase B)

Shipped in [[Phase B]] B3:

- `GET /availability` — branch-scoped on-hand − reserved
- `POST /reservations` + release + commit — location-scoped reserve; commit posts stock issue
- Documents accept `external_system` + `external_id`
- Outbox events: `stock.changed`, `document.posted` (poller marks processed)

**Webhook HTTP delivery** (subscriptions + HMAC-signed POSTs from the outbox) is planned in [[Phase E]] **E3** — plans ready (`docs/superpowers/plans/2026-07-26-phase-e3-webhooks-fefo-barcode.md`); not implemented yet.

Internal Vite app and future POS use the same posting services.

Phase: [[Phase F]] (UI); stubs complete in [[Phase B]]; webhook delivery [[Phase E]] E3


## Sources

- [[source-product-vision-2026-07-25]]
