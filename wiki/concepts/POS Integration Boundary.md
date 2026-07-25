---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-25
source_count: 1
---

# POS Integration Boundary

Inventory is the **platform**. POS (built-in or external, e.g. ipos) is a **consumer**.

## Required API surface (from Phase B)

- `GET /availability`
- `POST /reservations` + release + commit
- Documents accept `external_system` + `external_id`
- Outbox/webhooks: stock changed, document posted

Internal Vite app and future POS use the same posting services.

Phase: [[Phase F]] (UI); stubs in [[Phase B]]

## Sources

- [[source-product-vision-2026-07-25]]
