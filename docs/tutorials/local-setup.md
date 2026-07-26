# Local setup (tutorial)

Get the Phase A monorepo running on your machine.

## Prerequisites

- Node.js 20+
- pnpm 9 (`npx pnpm@9.15.0` works if pnpm is not installed globally)
- Docker (for Postgres) **or** a local PostgreSQL 16+ database

## 1. Install

```bash
npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @stock-management/domain build
npx pnpm@9.15.0 --filter @stock-management/application build
npx pnpm@9.15.0 --filter @stock-management/shared build
```

## 2. Database

```bash
cp .env.example .env
docker compose up -d
npx pnpm@9.15.0 --filter @stock-management/api db:migrate
```

`DATABASE_URL` defaults to `postgresql://postgres:postgres@localhost:5432/stock_management`.

## 3. Run

```bash
# terminal 1
npx pnpm@9.15.0 --filter @stock-management/api dev

# terminal 2
npx pnpm@9.15.0 --filter @stock-management/web dev
```

- API: http://localhost:3001/health → `{ "ok": true }`
- Web: http://localhost:5173

## 4. First use

1. In the web sidebar, enter an org name and click **Create org**
2. Create branches, locations, products, suppliers

API calls require headers `X-Org-Id` and `X-User-Id` (except `POST /api/v1/orgs` and `GET /health`).

## Coding standards

Full Clean Architecture: `packages/domain` → `packages/application` → API adapters; web is page → hook → API client. See [architecture/coding-standards.md](../architecture/coding-standards.md).
