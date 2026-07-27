# Web UI Shell Design

**Date:** 2026-07-27  
**Status:** Implemented (phase 1)

## Goal

Responsive app shell with a DIP-friendly design-system adapter layer over HeroUI + HugeIcons.

## Decisions

- Top navbar: brand, notifications (placeholder), language, account avatar
- Keep left sidebar for page navigation; mobile uses a left drawer
- Pages are **not** restyled in phase 1 — only shell + `apps/web/src/ui` adapters
- Notifications are UI-only (empty state); no backend
- Avatar/account menu is localStorage-backed stub (no logout API)

## Architecture

- `apps/web/src/ui/*` — only place that imports `@heroui/*` or `@hugeicons/*`
- `apps/web/src/layout/*` — AppShell, TopNavbar, AppSidebar, menus
- ESLint `no-restricted-imports` enforces the adapter boundary

## Stack

- `@heroui/react` + `@heroui/styles` (v3, Tailwind v4)
- `@hugeicons/react` + `@hugeicons/core-free-icons`
- Existing Vite + React 19 + TanStack Router/Query + i18next
