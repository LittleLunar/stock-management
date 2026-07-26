---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-27
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

## Webhook HTTP delivery ([[Phase E]] E3)

Shipped 2026-07-27:

- Org-admin CRUD: `GET/POST/PATCH /api/v1/webhook-subscriptions`, `GET /api/v1/webhook-deliveries`
- Outbox poller delivers after journals: HMAC-SHA256 `X-Webhook-Signature`
- Unique delivery per `(subscription_id, outbox_event_id)`; retries on failure

Internal Vite app and future POS use the same posting services.

Phase: [[Phase F]] (POS UI / channels); stubs complete in [[Phase B]]; webhook delivery complete in [[Phase E]] E3


## Sources

- [[source-product-vision-2026-07-25]]
