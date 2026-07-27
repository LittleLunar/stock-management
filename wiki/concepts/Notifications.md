---
tags:
  - concept
created: 2026-07-27
updated: 2026-07-27
source_count: 1
---

# Notifications

In-app + email notifications for [[Stock Management System]], delivered outbox-first through a **decorator** channel chain. Depends on real users from [[Authentication]].

## Status

**Implemented** (2026-07-27) on `feature/auth-and-notifications`: outbox dispatch, decorator channels, REST + WebSocket, signed actions, preferences UI (`/notification-preferences` from account menu).

## Locked model

| Topic | Choice |
|-------|--------|
| Channels v1 | In-app + email |
| Pattern | Decorator channels + Strategy event policies |
| Transport | Postgres outbox (`notification.dispatch`) |
| Realtime | Fastify WebSocket + poll fallback |
| Server actions | Approval approve/reject; invite accept/decline (signed tokens) |
| Preferences | Per-user per-event channel toggles (defaults from policy) |

## Pipeline

Domain/use case → outbox intent → worker → **EventPolicy** (recipients, template, defaults, actions) → decorator chain `InApp` → `Email` → future Push/SMS.

## v1 events

Auth/membership: welcome, email verified, password changed, invite received/accepted/declined.  
Ops: document posted/voided, stock low, approval assigned.

## UX

Shell notification bell (badge + popover); account **Notification preferences** page; `/notification-action` for email CTAs; WebSocket with 30s poll fallback.

## Parked follow-ups

- `approval.assigned` recipient resolution uses coarse role heuristics until approval policies carry eligible roles/users
- Invite accept via signed action token still requires name + password (create-user path)
- Email-only invites (no `userId`) keep opaque invite URLs
- Earlier task minors: inactive login gate, refresh rotate transaction, unique→Conflict mapping, drop sync invite Mailer when email channel fully covers invites

## Related

[[Authentication]] · [[Tech Stack]] · [[Clean Architecture]] · [[Feature Phases]]

## Specs

- Design: `docs/superpowers/specs/2026-07-27-notifications-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`
- Auth: `docs/superpowers/specs/2026-07-27-authentication-design.md`

## Sources

- Planning decision 2026-07-27 (auth + notifications brainstorming; WS + server actions)
- Implementation finalize Task 8 (2026-07-27)
