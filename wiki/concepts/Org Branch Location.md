---
tags:
  - concept
created: 2026-07-25
updated: 2026-07-25
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

See entities: [[Organization]], [[Branch]], [[Location]]

## Sources

- [[source-product-vision-2026-07-25]]
