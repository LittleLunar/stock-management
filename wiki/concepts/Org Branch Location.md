---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-27
source_count: 1
---

# Org Branch Location

Multi-branch scale without schema rewrite:

```
Organization (tenant)
  └── Branch (site)
        └── Location (bin / warehouse / transit / quarantine)
```

Solo shop = 1 org, 1 branch, N locations. Multi-branch = more branches; memberships scope users to branches.

[[Phase E]] **E1 + E2 shipped (2026-07-27):** membership branch scoping, optional **`X-Branch-Id`**, and ops/approvals for multi-branch flows.

- Empty `membership_branches` = HQ (all branches); branch users limited to granted branches.
- Document lists filtered by server scope; create/post gated by role + branch assert.
- Stock transfers store `from_branch_id` / `to_branch_id` (from locations); **`purpose: replenishment`** requires distinct branches.
- Outbox `document.posted` / `document.voided` payloads include `branchId` when resolvable; journals carry `branch_id`.
- Web shell branch switcher sends `X-Branch-Id`; reports default to active branch; HQ “All branches” = consolidated.
- E2: reservation balance lock + expire poller; org approval policies gate PO GR and adjustment post (`org_admin` / `branch_manager`).

Design: `docs/superpowers/specs/2026-07-26-phase-e-multi-branch-design.md`. Plans: E1 / E2 under `docs/superpowers/plans/2026-07-26-phase-e*.md`.

See entities: [[Organization]], [[Branch]], [[Location]]

## Sources

- [[source-product-vision-2026-07-25]]
