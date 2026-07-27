---
tags:
  - concept
created: 2026-07-27
updated: 2026-07-27
source_count: 1
---

# Notifications

In-app + email notifications for [[Stock Management System]], delivered outbox-first through a **decorator** channel chain. Depends on real users from [[Authentication]].

## Locked model

| Topic | Choice |
|-------|--------|
| Channels v1 | In-app + email |
| Pattern | Decorator channels + Strategy event policies |
| Transport | Postgres outbox (`notification.dispatch`) |
| Realtime | Fastify WebSocket |
| Server actions | Approval approve/reject; invite accept/decline (signed tokens) |

## Pipeline

Domain/use case → outbox intent → worker → **EventPolicy** (recipients, template, defaults, actions) → decorator chain `InApp` → `Email` → future Push/SMS.

## v1 events

Auth/membership: welcome, email verified, password changed, invite received/accepted/declined.  
Ops: document posted/voided, stock low, approval assigned.

## UX

Shell notification bell (badge + popover); preferences for channel toggles; WebSocket with poll fallback.

## Related

[[Authentication]] · [[Tech Stack]] · [[Clean Architecture]] · [[Feature Phases]]

## Specs

- Design: `docs/superpowers/specs/2026-07-27-notifications-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`
- Auth: `docs/superpowers/specs/2026-07-27-authentication-design.md`

## Sources

- Planning decision 2026-07-27 (auth + notifications brainstorming; WS + server actions)
