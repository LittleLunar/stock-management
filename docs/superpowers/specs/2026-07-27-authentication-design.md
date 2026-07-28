# Authentication Design

**Date:** 2026-07-27  
**Status:** Approved (brainstorming)  
**Approach:** Custom JWT in Clean Architecture (Approach A)  
**Plan:** `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`  
**Wiki:** [[Authentication]], [[Tech Stack]], [[Clean Architecture]], [[Getting Started]]

## Summary

Replace the Phase A–E header auth stub (`X-Org-Id` + `X-User-Id`) with email/password authentication: Argon2 password hashes, short-lived access JWTs (Bearer), and HTTP-only rotating refresh cookies. Self-signup creates an organization plus HQ `org_admin` membership; teammates join later via invites. Org/branch context remains header-selected from membership after the user is identified. OAuth is deferred.

## Goals

1. Real signup/login with email verification and forgot/reset password
2. Access JWT Bearer + rotating HTTP-only refresh cookie
3. Drop trusting `X-User-Id` on protected routes (`AUTH_STUB` optional for automated tests only)
4. Keep `X-Org-Id` / optional `X-Branch-Id` for tenant context from membership
5. Web unauthorized redirect to `/login?next=`
6. Shared `Mailer` port (dev transport + SMTP) reusable by notifications

## Non-goals

- OAuth / social providers (deferred; leave a credential port seam)
- Multi-org switcher UX beyond listing memberships on `/me` (v1 = org from signup)
- Magic-link / OTP as primary login
- SSO / SAML
- Changing membership RBAC matrices from Phase E

## Locked decisions

| Topic | Choice |
|-------|--------|
| Sequence | Auth first → notifications |
| Credentials | Email + password now; OAuth later |
| Signup | Self-signup → new org + user + HQ `org_admin`; invites for teammates |
| Tokens | Short-lived access JWT (Bearer) + HTTP-only refresh cookie (rotate on refresh) |
| Extras | Email verification, forgot/reset password, unauthorized redirect |
| Org context | JWT identifies user; `X-Org-Id` / `X-Branch-Id` still select tenant from membership |
| Architecture | Full Clean Architecture; no fat Fastify auth handlers |
| Stub | Remove trusting `X-User-Id`; optional `AUTH_STUB=true` for tests only |

## Architecture & flow

```mermaid
sequenceDiagram
  participant Web
  participant API
  participant DB
  participant Mail

  Web->>API: POST /api/v1/auth/signup
  API->>DB: user + org + org_admin membership
  API->>Mail: verification email
  API-->>Web: 201 (unverified; no full session)

  Web->>API: POST /api/v1/auth/login
  API->>DB: verify password + emailVerified
  API-->>Web: access JWT + Set-Cookie refresh

  Web->>API: API calls Authorization Bearer + X-Org-Id
  API->>DB: load membership into ctx

  Web->>API: POST /api/v1/auth/refresh Cookie
  API->>DB: rotate refresh token
  API-->>Web: new access JWT + new refresh cookie

  Note over Web: 401 after failed refresh → redirect /login?next=
```

### Core rules

- Signup creates **org + user + HQ `org_admin` membership** (empty `membership_branches` = all branches); password hashed with Argon2 in infrastructure
- Email must be verified before full login; otherwise login returns `EMAIL_NOT_VERIFIED`
- Access JWT claims: `sub` (userId), `email` — **not** org/role (those come from membership + headers)
- Refresh: opaque token, **hashed** in DB, **rotated** on each refresh; logout revokes the token family
- Forgot password → emailed one-time token; reset updates hash and revokes all refresh families
- Web: store access token; on 401 try refresh once; on failure clear state → **redirect to `/login?next=`**

### Clean Architecture shape

| Layer | Responsibility |
|-------|----------------|
| Domain | Credential/session invariants + errors (`InvalidCredentials`, `EmailNotVerified`, `TokenExpired`, …) |
| Application | Use cases + ports: `PasswordHasher`, `AccessTokenSigner`, `RefreshTokenStore`, `EmailTokenStore`, `Mailer` |
| Infrastructure | Argon2, JWT, Drizzle stores, SMTP/dev mailer |
| HTTP | Thin `/api/v1/auth/*` routes; context plugin: Bearer → userId, then membership via `X-Org-Id` |
| Web | Auth pages + client session; page → hook → API client only |

Composition root wires ports in `apps/api/src/main`. Shared Zod DTOs live in `packages/shared`.

## API surface

All under `/api/v1/auth/…`. Public except `GET /me` (Bearer required). Paths below are relative to that prefix.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/signup` | `email`, `password`, `name`, `orgName` → create org+user+membership; send verification |
| POST | `/login` | `email`, `password` → access JWT + refresh cookie (requires verified email) |
| POST | `/logout` | Revoke refresh family; clear cookie |
| POST | `/refresh` | Cookie → new access JWT + rotated refresh cookie |
| POST | `/verify-email` | Token from email link |
| POST | `/resend-verification` | `email` → new verification mail (rate-limited) |
| POST | `/forgot-password` | `email` → reset mail (**always 204**; no user enumeration) |
| POST | `/reset-password` | `token` + `newPassword` → update hash; revoke sessions |
| GET | `/me` | Bearer → current user + memberships (orgs/roles/branch grants) |

Protected business routes: **Bearer required**; keep `X-Org-Id` (+ optional `X-Branch-Id`); **do not trust** `X-User-Id`.

CORS: allow credentials; expose/allow `Authorization`, `X-Org-Id`, `X-Branch-Id`, `X-Request-Id`; cookie `SameSite=Lax` (or `None`+`Secure` if cross-site in prod).

## Schema (additive)

### `users` extensions

| Column | Notes |
|--------|--------|
| `password_hash` | Argon2 hash; required after auth migration |
| `email_verified_at` | `timestamptz` nullable; set on verify |

**Email uniqueness:** login is by email alone → enforce a **global unique index on `users.email`**. Existing `(org_id, email)` uniqueness remains compatible for v1 (one org per signup/invite user). Multi-org accounts are a later concern.

### `auth_refresh_tokens`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `user_id` | FK → users |
| `token_hash` | Hash of opaque refresh token |
| `family_id` | UUID; revoke whole family on logout / reuse detection |
| `expires_at` | Absolute expiry |
| `revoked_at` | Nullable |
| `created_at` | Timestamp |

### `auth_email_tokens`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `user_id` | FK → users |
| `purpose` | `verify_email` \| `reset_password` |
| `token_hash` | Hash of one-time token |
| `expires_at` | Absolute expiry |
| `used_at` | Nullable; single-use |

### Membership invites (Task 5; auth-adjacent)

`membership_invites`: `orgId`, `email`, `role`, `branchIds`, `tokenHash`, `invitedBy`, `expiresAt`, `acceptedAt` / `declinedAt`. Accept creates user (if needed) + membership; does not replace self-signup for new orgs.

## Token model

| Token | Transport | Lifetime (default) | Notes |
|-------|-----------|--------------------|--------|
| Access JWT | `Authorization: Bearer` | **15 minutes** | Claims: `sub`, `email`, `iat`, `exp`. Signed with `JWT_ACCESS_SECRET` |
| Refresh | HTTP-only cookie `refresh_token` | **14 days** | Opaque; hashed at rest; rotate on every `/refresh`; Path scoped to `/api/v1/auth` |
| Email verify | Link query `token` | **24 hours** | Single-use; purpose `verify_email` |
| Password reset | Link query `token` | **1 hour** | Single-use; purpose `reset_password`; revoke all refresh families on success |

**Refresh rotation:** issue new opaque token + new cookie; mark previous revoked. Detect reuse of a revoked family member → revoke entire family (theft mitigation).

**Signup response:** `201` with user/org ids; **no** full access session until email verified (client shows “check your email”). Optional: return nothing sensitive beyond ids.

## Web UX

### Public routes (no AppSidebar)

| Route | Purpose |
|-------|---------|
| `/login` | Email + password |
| `/signup` | Name, email, password, org name |
| `/forgot-password` | Request reset email |
| `/reset-password?token=` | Set new password |
| `/verify-email?token=` | Confirm email; then → `/login` with success toast |

After login → `next` query path (same-origin only) or `/`.

### Auth client

- Access token in **memory** (module state); optional **`sessionStorage`** so a tab reload can refresh without putting a long-lived token in `localStorage`
- API client: `Authorization: Bearer`, `credentials: 'include'` for refresh/logout
- **Single-flight refresh:** concurrent 401s share one `POST /auth/refresh`
- On refresh failure: clear token + org context → redirect `/login?next=…`
- Authed routes: if no access token, try refresh once; else redirect to login
- `AccountMenu`: user from `/me`; **Logout** → `POST /auth/logout`
- Remove org bootstrap “paste X-Org-Id / X-User-Id” UI; org from membership (`/me`; v1 single org from signup)
- Keep `X-Org-Id` / `X-Branch-Id` from membership + branch switcher after login

### i18n

EN/TH strings for all auth pages and auth error codes (existing i18n catalogs).

## Error codes

Map to shared `ErrorEnvelope` (`code`, `message`, `requestId`). Client localizes by `code`.

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Zod body/query failure |
| `INVALID_CREDENTIALS` | 401 | Bad email/password (same message either way) |
| `EMAIL_NOT_VERIFIED` | 403 | Login with unverified email |
| `UNAUTHORIZED` | 401 | Missing/invalid access JWT; no membership for org |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `TOKEN_EXPIRED` | 401 | Access, refresh, or email token past expiry |
| `TOKEN_INVALID` | 401 | Malformed, reused, or unknown token |
| `CONFLICT` | 409 | Signup email already registered |
| `RATE_LIMITED` | 429 | Resend verification / forgot-password abuse |
| `NOT_FOUND` | 404 | Rare; prefer generic responses for auth email flows |

`forgot-password` and (where safe) resend paths must not reveal whether the email exists.

## Env

| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` | Sign/verify access JWTs |
| `JWT_ACCESS_TTL_SECONDS` | Optional override (default 900) |
| `REFRESH_COOKIE_NAME` | Optional (default `refresh_token`) |
| `REFRESH_TTL_SECONDS` | Optional (default 14 days) |
| `AUTH_STUB` | When `true`, allow test header stub (automated tests only) |
| `SMTP_*` / mailer env | Shared with notifications; unset → console/file transport |
| `WEB_ORIGIN` | CORS origin for credentialed requests |
| `APP_PUBLIC_URL` | Base URL for email links |

## Testing

- Unit: signup/login/verify/reset use cases; refresh rotation + family revoke; email-not-verified gate
- HTTP: cookie + Bearer round-trip; protected route rejects missing Bearer; `AUTH_STUB` gated
- Web: redirect to `/login?next=`; single-flight refresh; logout clears session

## Migration from stub

1. Ship schema + use cases + routes
2. Rewrite context plugin: Bearer → userId; require `X-Org-Id`; drop `X-User-Id` unless `AUTH_STUB`
3. Replace web localStorage `userId` bootstrap with `/me` + tokens
4. Update `Getting Started` / local bootstrap docs (`pnpm db:clear` still valid; signup replaces stub org form)

## Out of scope follow-ups

- OAuth providers as additional credential port
- Multi-org account linking / switcher UI
- Device session list / “log out everywhere” UI (API revoke-all may land with reset)
- Passkeys / WebAuthn

## Sources

- Planning conversation 2026-07-27 (auth + notifications brainstorming)
- Plan: `docs/superpowers/plans/2026-07-27-auth-and-notifications.md`
- Existing context plugin: `apps/api/src/interfaces/plugins/context.ts`
- Phase E membership ACL: `docs/superpowers/specs/2026-07-26-phase-e-multi-branch-design.md`
