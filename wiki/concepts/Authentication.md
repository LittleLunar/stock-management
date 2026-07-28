---
tags:
  - concept
created: 2026-07-27
updated: 2026-07-27
source_count: 1
---

# Authentication

Email/password auth for [[Stock Management System]], replacing the Phase A–E header stub (`X-Org-Id` + `X-User-Id`).

> [!important]
> Access identity comes from a **JWT Bearer** token. Tenant context still uses **`X-Org-Id`** / optional **`X-Branch-Id`** resolved against [[Org Branch Location]] membership. Do not trust client-supplied `X-User-Id` in production.

## Status

**Implemented** (2026-07-27) on `feature/auth-and-notifications`. Header stub no longer used for identity.

## Locked model

| Topic | Choice |
|-------|--------|
| Credentials | Email + password (OAuth deferred) |
| Signup | Creates org + user + HQ `org_admin`; teammates via invite |
| Tokens | Short-lived access JWT + HTTP-only **rotating** refresh cookie |
| Extras | Email verification, forgot/reset password, redirect `/login?next=` |
| Architecture | Full [[Clean Architecture]] use cases + ports |

## Flow (summary)

1. `POST /api/v1/auth/signup` → org + user + membership; verification email
2. Verify email → login issues access JWT + refresh cookie
3. API calls: `Authorization: Bearer` + `X-Org-Id` (+ optional `X-Branch-Id`)
4. Refresh rotates cookie; failed refresh → web redirects to login
5. Invites: create → email/link → accept (name+password) / decline

## CA placement

- Domain errors / invariants: `packages/domain`
- Use cases + ports (`PasswordHasher`, token stores, `Mailer`): `packages/application`
- Argon2 / JWT / Drizzle / mailer adapters: `apps/api` infrastructure
- Thin routes + context plugin: `apps/api` HTTP
- Web: `/login`, `/signup`, forgot/reset/verify/accept-invite pages; session client

## Related

[[Notifications]] · [[Tech Stack]] · [[Clean Architecture]] · [[Getting Started]] · [[Phase A]]

## Specs

- Design: `docs/superpowers/specs/2026-07-27-authentication-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`

## Sources

- Planning decision 2026-07-27 (auth + notifications brainstorming)
- Implementation finalize Task 8 (2026-07-27)
