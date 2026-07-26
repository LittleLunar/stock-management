---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-26
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

[[Phase E]] (plans ready) enforces **membership branch scoping** and optional **`X-Branch-Id`** active-branch context: empty `membership_branches` = HQ (all branches); branch users are limited to granted branches. See design `docs/superpowers/specs/2026-07-26-phase-e-multi-branch-design.md`.

See entities: [[Organization]], [[Branch]], [[Location]]

## Sources

- [[source-product-vision-2026-07-25]]
