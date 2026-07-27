# Auth + Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the header auth stub with a full email/password JWT flow, then ship an extensible notification system (in-app + email, decorator channels, WebSocket, signed server actions).

**Architecture:** Custom CA auth (Argon2 + access JWT Bearer + HTTP-only rotating refresh cookie). Notifications enqueue via Postgres outbox; a worker resolves event policies and delivers through a decorator chain (`InApp` → `Email` → future channels). Realtime fan-out over Fastify WebSocket; email/bell CTAs for approvals and invites execute via signed action tokens.

**Tech Stack:** Fastify, Drizzle/Postgres, Argon2, JWT, `@fastify/cookie` + `@fastify/websocket`, existing outbox poller, Vite/React + TanStack Router/Query, shared Mailer port (dev transport + SMTP).

## Global Constraints

- Full Clean Architecture for all layers; no auth/notification business rules in fat Fastify handlers
- Keep org scoping: JWT identifies user; `X-Org-Id` / `X-Branch-Id` still select tenant context from membership
- Remove trusting `X-User-Id` on protected routes (optional `AUTH_STUB` only for automated tests if needed)
- Outbox-first for notification dispatch; auth verify/reset mails may use sync Mailer for UX
- OAuth deferred; password auth only in this plan
- Push/SMS and digest emails out of scope
- Membership invites do not exist yet — Task 5 builds them
- Commit after each task with a focused message; do not push unless asked

## Locked decisions

| Topic | Decision |
|-------|----------|
| Sequence | Auth first → notifications |
| Signup | Self-signup creates org + `org_admin`; invites for teammates |
| Tokens | Access JWT (Bearer) + refresh HTTP-only cookie (rotate) |
| Auth extras | Email verification, forgot/reset password, unauthorized redirect |
| Notifications | In-app + email; decorator channels/events |
| Events v1 | welcome, email_verified, password_changed, invite_*, document posted/voided, stock.low, approval.assigned |
| Realtime | WebSocket |
| Server actions | Approvals approve/reject + invites accept/decline |

---

## Task 1: Design specs and wiki

**Files:**
- Create: `docs/superpowers/specs/2026-07-27-authentication-design.md`
- Create: `docs/superpowers/specs/2026-07-27-notifications-design.md`
- Update: `wiki/Getting Started.md`, `wiki/concepts/Tech Stack.md`, relevant Phase pages
- Create: `wiki/concepts/Authentication.md`, `wiki/concepts/Notifications.md` (or similar)
- Update: `wiki/index.md`, `wiki/log.md`
- Read first: `wiki/index.md`, `wiki/AGENTS.md`, `.cursor/rules/wiki-contract.mdc`

**Steps:**
- [ ] Write authentication design spec covering architecture, API table, schema, token model, web UX, error codes — matching locked decisions
- [ ] Write notifications design spec covering decorator channel chain, event policies, outbox, WebSocket, signed actions, preferences, channel defaults table
- [ ] Self-review specs for placeholders/contradictions
- [ ] Update wiki pages and index/log per wiki contract (read index first)
- [ ] Commit: `docs: auth and notifications design specs`

**Done when:** Both specs exist, wiki updated, commit created.

---

## Task 2: Auth schema, domain, application use cases

**Files:**
- Schema under `apps/api/src/infrastructure/db/schema/`
- Domain auth errors/types in `packages/domain`
- Ports + use cases in `packages/application`
- Infra adapters (Argon2, JWT, Drizzle stores, Mailer) in `apps/api/src/infrastructure`
- Follow existing CA patterns from users/orgs

**Steps:**
- [ ] Extend `users` with `password_hash`, `email_verified_at`
- [ ] Add `auth_refresh_tokens`, `auth_email_tokens` tables + migration
- [ ] Domain errors: InvalidCredentials, EmailNotVerified, TokenExpired, etc.
- [ ] Ports: PasswordHasher, AccessTokenSigner, RefreshTokenStore, EmailTokenStore, Mailer
- [ ] Use cases: Signup, Login, Logout, Refresh, VerifyEmail, ResendVerification, ForgotPassword, ResetPassword, GetMe
- [ ] Unit tests for use cases (TDD preferred)
- [ ] Commit: `feat(auth): schema and application use cases`

**Done when:** Tests pass for auth use cases; schema migrated/exportable.

---

## Task 3: Auth HTTP routes and context plugin

**Files:**
- `apps/api/src/interfaces/http/auth.routes.ts` (new)
- `apps/api/src/interfaces/plugins/context.ts` (rewrite)
- Composition root `apps/api/src/main`
- CORS + `@fastify/cookie`

**Steps:**
- [ ] Public `/api/v1/auth/*` routes per design
- [ ] `GET /api/v1/auth/me`
- [ ] Context: Bearer → userId; require `X-Org-Id`; drop `X-User-Id` (AUTH_STUB for tests if needed)
- [ ] Refresh cookie httpOnly; CORS credentials
- [ ] API route tests with cookie + Bearer
- [ ] Commit: `feat(auth): HTTP routes and JWT context plugin`

**Done when:** Auth routes + protected route with JWT work in tests.

---

## Task 4: Auth web pages and unauthorized redirect

**Files:**
- Auth pages under `apps/web/src/pages/` or `apps/web/src/auth/`
- `apps/web/src/api/client.ts`
- `apps/web/src/layout/AccountMenu.tsx`, App routing
- i18n EN/TH

**Steps:**
- [ ] Routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- [ ] Auth client: access token memory/sessionStorage; credentials include; single-flight refresh; redirect `/login?next=`
- [ ] AccountMenu logout; remove stub X-Org-Id/X-User-Id bootstrap UI
- [ ] EN/TH strings
- [ ] Commit: `feat(web): auth pages and session redirect`

**Done when:** Manual/smoke path works; typecheck passes for web auth.

---

## Task 5: Membership invites

**Files:**
- Schema `membership_invites`
- Application use cases CreateInvite, AcceptInvite, DeclineInvite
- HTTP routes
- Optional minimal web accept page

**Steps:**
- [ ] Table: orgId, email, role, branchIds, tokenHash, invitedBy, expiresAt, acceptedAt/declinedAt
- [ ] Use cases + tests
- [ ] Admin create invite API; accept/decline via token
- [ ] Hooks ready to enqueue notification intents (or enqueue stubs)
- [ ] Commit: `feat(membership): invite create accept decline`

**Done when:** Invite lifecycle tested end-to-end at API level.

---

## Task 6: Notification core (tables, policies, decorators, in-app + email)

**Files:**
- Domain notification + preferences
- `NotificationChannel` + InApp/Email decorators
- Event policy registry
- Outbox worker extension
- REST list/read/dismiss/preferences

**Steps:**
- [ ] Tables `notifications`, `notification_preferences`
- [ ] Decorator chain composition in main
- [ ] Policies for v1 events; wire enqueue from auth/docs/approval/invite
- [ ] Worker processes `notification.dispatch`
- [ ] REST endpoints
- [ ] Unit tests for decorators and policies
- [ ] Commit: `feat(notifications): decorator channels and outbox dispatch`

**Done when:** Creating an event produces in-app row (+ email via Mailer in tests).

---

## Task 7: WebSocket and signed notification actions

**Files:**
- WS plugin route `/api/v1/notifications/ws`
- `ExecuteNotificationAction` use case
- `NotificationBell.tsx` upgrade
- Wire approve/reject + invite accept/decline

**Steps:**
- [ ] JWT-authenticated WebSocket; push created/read/unread-count
- [ ] Signed action token execute endpoint
- [ ] Bell: badge, list, actions, WS + poll fallback
- [ ] Tests for action execute + token expiry
- [ ] Commit: `feat(notifications): websocket and signed actions`

**Done when:** Bell updates live; email action token executes approval/invite.

---

## Task 8: Preferences UI, i18n, verify, FEATURES/wiki finalize

**Steps:**
- [ ] Preferences get/put UI (account submenu or page)
- [ ] Remaining EN/TH i18n
- [ ] Typecheck + focused/full tests
- [ ] Update `docs/FEATURES.md` and wiki finalize
- [ ] Commit: `chore: notifications preferences and docs finalize`

**Done when:** Verification green; docs/wiki current.

---

## Out of scope

- OAuth providers
- Push/SMS, email digests
- Multi-org switcher beyond `/me` memberships list
- Replacing external webhooks pipeline
