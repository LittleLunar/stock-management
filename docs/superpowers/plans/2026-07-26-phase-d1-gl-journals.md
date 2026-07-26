# Phase D1 — GL / CoA / Periods / Auto Journals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first accounting slice — chart of accounts, account mappings, monthly periods, async outbox→balanced journals (including void reverses), and read-only journal browser APIs.

**Architecture:** Full Clean Architecture. Inventory post UoW stays unchanged except void outbox cost enrichment. Journals are created **asynchronously** by extending `apps/api/src/infrastructure/workers/outbox-poller.ts` with a `JournalEventMapper` + `AccountingPort` writer. HTTP stays thin (CoA / mappings / periods / journals). **No** AP/invoices, **no** TB/P&L/BS, **no** web UI (D2/D3).

**Tech Stack:** Fastify, TypeScript, Drizzle, PostgreSQL, Zod (`packages/shared`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`  
**Master:** `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`  
**Wiki:** [[Phase D]] · [[Inventory Accounting]] · [[Feature Phases]]

## Global Constraints

- Full Clean Architecture — no `apps/api/src/modules/`
- Every tenant table / query includes `org_id`
- Journals **async via outbox poller** — not inside inventory post TX
- Inventory UoW unchanged except optional void outbox cost enrichment
- Journal lines never UPDATE/DELETE; void → reversing journal with `reverses_journal_id`
- Idempotent journal create: unique `(org_id, outbox_event_id)` where `outbox_event_id IS NOT NULL`
- Hard period close: reject new journals dated in a closed period
- Money/qty: Phase B/C `Number()` + string pattern; org currency only
- Auth stub headers `X-Org-Id` + `X-User-Id`
- Coding standards: `docs/architecture/coding-standards.md`

---

## Decisions (locked for D1)

| Topic | Choice |
|-------|--------|
| Journal timing | Async outbox poller; inventory post TX does not write journals |
| CoA seed | `EnsureDefaultChartOfAccounts` seeds 7 accounts + default `AccountMapping` rows; call from seed HTTP or lazy before first journal write |
| Default accounts | Inventory (`1300` asset), GRNI (`2100` liability), AP (`2000` liability), COGS (`5000` expense), InventoryAdjExpense (`5100` expense), LandedCostClearing (`1350` asset), RevaluationReserve (`3900` equity) |
| Event → account | `AccountMapping` keyed by `orgId + journalEventType` → debit + credit account ids |
| `journalEventType` keys | See matrix below (string constants in domain) |
| Period grain | Monthly; bounds from `organizations.fiscal_year_start_month` |
| Period generate | `POST /accounting-periods/generate` creates missing months for a year range; new periods start `open` |
| Period close | Hard close; `POST .../:id/open` is explicit reopen |
| Void cost fields | Enrich `document.voided` with same Phase C field names (`inventoryValueDelta`, `cogsTotal`, `landedAmount`, `revaluationValueDelta`) carrying reverse amounts |
| Reverse journal | Swap debit/credit vs forward mapping; set `reversesJournalId` to original journal for same source doc when found |
| Skip / no-op | `stock.changed`; transfer ship/receive; any event with no money fields → mark processed, no journal |
| Idempotency | `findByOutboxEventId` before insert; DB unique enforces retries |
| Manual journals | None in D1 (read-only browser only) |
| Branch on journals | Optional `branchId` from source document when resolvable; else null |
| UI | No web screens in D1 (API only) |

### Journal event type matrix (D1)

| Trigger | `journalEventType` | Debit account | Credit account | Amount field |
|---------|--------------------|---------------|----------------|--------------|
| GR `document.posted` | `goods_receipt.posted` | Inventory | GRNI | `inventoryValueDelta` |
| Issue posted | `stock_issue.posted` | COGS | Inventory | `cogsTotal` |
| Supplier return posted | `supplier_return.posted` | COGS | Inventory | `cogsTotal` |
| −adjust / −count posted | `inventory_decrease.posted` | InventoryAdjExpense | Inventory | `cogsTotal` |
| +adjust / +count / customer return posted | `inventory_increase.posted` | Inventory | InventoryAdjExpense | `inventoryValueDelta` |
| Landed cost posted | `landed_cost.posted` | Inventory | LandedCostClearing | `landedAmount` |
| Cost revaluation posted (`revaluationValueDelta` ≥ 0) | `cost_revaluation.increase` | Inventory | RevaluationReserve | `revaluationValueDelta` |
| Cost revaluation posted (`revaluationValueDelta` < 0) | `cost_revaluation.decrease` | RevaluationReserve | Inventory | abs(`revaluationValueDelta`) |
| Any `document.voided` with money fields | same type with `.voided` suffix (e.g. `goods_receipt.voided`) | swap of forward mapping | swap of forward mapping | void payload field |

Default mappings seed both `.posted` and `.voided` variants (voided = swapped debit/credit of posted).

## Out of scope (D1)

- Supplier invoices, 3-way match, AP aging (D2)
- Trial balance / P&L / balance sheet / period-close checklist / thin web (D3)
- Manual journal create API
- Webhook HTTP delivery (E)
- Payments / bank / multi-currency / tax

## Outbox → journal flow (D1)

```mermaid
sequenceDiagram
  participant Post as InventoryPostOrVoid
  participant TX as UoW_TX
  participant OB as outbox_events
  participant Poller as OutboxPoller
  participant Map as JournalEventMapper
  participant GL as AccountingPort

  Post->>TX: movements costs balances
  TX->>OB: document.posted|voided plus cost fields
  TX-->>Post: commit
  Poller->>OB: claim pending SKIP LOCKED
  Poller->>Map: resolve event to plan or skip
  alt has money fields
    Map->>GL: ensure CoA; open period; insert journal idempotent
  else stock.changed / no money
    Map-->>Poller: skip
  end
  Poller->>OB: mark processed or failed
```

## File map

| Path | Responsibility |
|------|----------------|
| `packages/domain/src/types.ts` | `AccountType`, `PeriodStatus`, `JournalEventType` constants |
| `packages/domain/src/entities.ts` | `Account`, `AccountMapping`, `AccountingPeriod`, `JournalEntry`, `JournalLine` |
| `packages/domain/src/errors.ts` | `UnbalancedJournalError`, `PeriodClosedError`, `AccountMappingMissingError`, `AccountingPeriodMissingError` |
| `packages/domain/src/accounting.ts` | Pure helpers: balance assert, period open assert, period date bounds, default CoA definitions, money abs |
| `packages/domain/src/accounting.test.ts` | Domain unit tests |
| `packages/application/src/ports/accounting.ts` | `AccountingPort` |
| `packages/application/src/ports/unit-of-work.ts` | Add `accounting?: AccountingPort` to `UowContext` |
| `packages/application/src/accounting/journal-event-mapper.ts` | Map outbox row → journal plan or skip |
| `packages/application/src/accounting/default-chart.ts` | Codes / names / mapping seeds for ensure-defaults |
| `packages/application/src/use-cases/ensure-default-chart-of-accounts.ts` | Seed CoA + mappings |
| `packages/application/src/use-cases/accounting-periods.ts` | Generate / list / open / close |
| `packages/application/src/use-cases/accounts.ts` | List / create / patch account; list / put mappings |
| `packages/application/src/use-cases/journals.ts` | Get by id; list by source document |
| `packages/application/src/use-cases/process-outbox-for-journals.ts` | Create journal from one pending event |
| `packages/application/src/costing/outbox-cost-fields.ts` | Reuse as-is for void enrichment |
| Void use cases | Enrich `document.voided` payloads with reverse cost fields |
| `packages/shared/src/accounting.ts` | Zod DTOs |
| `apps/api/src/infrastructure/db/schema/index.ts` | Five new tables + enums |
| `apps/api/drizzle/0007_phase_d1_gl.sql` | Migration (next after `0006_…`) |
| `apps/api/src/infrastructure/persistence/accounting.repository.ts` | Drizzle `AccountingPort` |
| `apps/api/src/infrastructure/persistence/unit-of-work.ts` | Wire `accounting` |
| `apps/api/src/infrastructure/workers/outbox-poller.ts` | Call journal processor before mark processed |
| `apps/api/src/interfaces/http/accounting.routes.ts` | Accounts, mappings, periods, journals |
| `apps/api/src/main/composition-root.ts` | Wire use cases |
| `apps/api/src/index.ts` | Register routes; pass journal handler into poller |

Reuse: `costingOutboxFields`, existing outbox poller claim/mark pattern, composition root, auth stub plugins.

---

### Task 1: Domain accounting types, errors, pure helpers

**Files:**
- Modify: `packages/domain/src/types.ts`, `entities.ts`, `errors.ts`, `index.ts`
- Create: `packages/domain/src/accounting.ts`
- Test: `packages/domain/src/accounting.test.ts`

**Interfaces:**
- Produces:

```ts
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type PeriodStatus = "open" | "closed";

export const JOURNAL_EVENT_TYPES = [
  "goods_receipt.posted",
  "goods_receipt.voided",
  "stock_issue.posted",
  "stock_issue.voided",
  "supplier_return.posted",
  "supplier_return.voided",
  "inventory_decrease.posted",
  "inventory_decrease.voided",
  "inventory_increase.posted",
  "inventory_increase.voided",
  "landed_cost.posted",
  "landed_cost.voided",
  "cost_revaluation.increase",
  "cost_revaluation.increase.voided",
  "cost_revaluation.decrease",
  "cost_revaluation.decrease.voided",
] as const;
export type JournalEventType = (typeof JOURNAL_EVENT_TYPES)[number];

export type Account = {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: AccountType;
  active: boolean;
  createdAt: Date;
};

export type AccountMapping = {
  id: string;
  orgId: string;
  journalEventType: JournalEventType;
  debitAccountId: string;
  creditAccountId: string;
};

export type AccountingPeriod = {
  id: string;
  orgId: string;
  year: number;
  month: number; // 1-12 calendar month
  startsOn: string; // YYYY-MM-DD
  endsOn: string; // YYYY-MM-DD
  status: PeriodStatus;
};

export type JournalEntry = {
  id: string;
  orgId: string;
  periodId: string;
  branchId: string | null;
  sourceDocumentType: string;
  sourceDocumentId: string;
  outboxEventId: string | null;
  reversesJournalId: string | null;
  postedAt: Date;
  createdAt: Date;
};

export type JournalLine = {
  id: string;
  orgId: string;
  journalEntryId: string;
  accountId: string;
  debit: string;
  credit: string;
  lineNo: number;
};

export type JournalLineDraft = {
  accountId: string;
  debit: string;
  credit: string;
  lineNo: number;
};

function assertJournalBalanced(lines: Pick<JournalLineDraft, "debit" | "credit">[]): void;
// throws UnbalancedJournalError if Σ Number(debit) !== Σ Number(credit)

function assertPeriodOpen(period: Pick<AccountingPeriod, "status">): void;
// throws PeriodClosedError if status !== "open"

function monthBounds(
  year: number,
  month: number,
): { startsOn: string; endsOn: string };
// calendar month bounds as YYYY-MM-DD (UTC date strings)

function periodsForFiscalYear(
  fiscalYearStartMonth: number,
  fiscalYear: number,
): Array<{ year: number; month: number; startsOn: string; endsOn: string }>;
// 12 months starting at fiscalYearStartMonth of calendar year `fiscalYear`
// Example: startMonth=4, fiscalYear=2026 → Apr 2026 … Mar 2027

function moneyAbs(value: string): string;
// String(Math.abs(Number(value))) — empty/NaN → throw or "0" consistent with tests

function voidEventType(postedType: JournalEventType): JournalEventType;
// appends ".voided" unless already ends with ".voided"
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  assertJournalBalanced,
  assertPeriodOpen,
  monthBounds,
  periodsForFiscalYear,
  moneyAbs,
  voidEventType,
} from "./accounting.js";
import {
  PeriodClosedError,
  UnbalancedJournalError,
} from "./errors.js";

describe("assertJournalBalanced", () => {
  it("allows equal debit and credit", () => {
    expect(() =>
      assertJournalBalanced([
        { debit: "100", credit: "0" },
        { debit: "0", credit: "100" },
      ]),
    ).not.toThrow();
  });
  it("rejects unbalanced", () => {
    expect(() =>
      assertJournalBalanced([
        { debit: "100", credit: "0" },
        { debit: "0", credit: "90" },
      ]),
    ).toThrow(UnbalancedJournalError);
  });
});

describe("assertPeriodOpen", () => {
  it("rejects closed", () => {
    expect(() => assertPeriodOpen({ status: "closed" })).toThrow(
      PeriodClosedError,
    );
  });
});

describe("monthBounds", () => {
  it("returns Feb 2026 bounds", () => {
    expect(monthBounds(2026, 2)).toEqual({
      startsOn: "2026-02-01",
      endsOn: "2026-02-28",
    });
  });
});

describe("periodsForFiscalYear", () => {
  it("starts in April when fiscalYearStartMonth is 4", () => {
    const periods = periodsForFiscalYear(4, 2026);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ year: 2026, month: 4 });
    expect(periods[11]).toMatchObject({ year: 2027, month: 3 });
  });
});

describe("moneyAbs / voidEventType", () => {
  it("abs", () => {
    expect(moneyAbs("-12.5")).toBe("12.5");
  });
  it("void suffix", () => {
    expect(voidEventType("goods_receipt.posted")).toBe("goods_receipt.voided");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @stock-management/domain test -- src/accounting.test.ts`  
Expected: FAIL (module / errors missing)

- [ ] **Step 3: Write minimal implementation**

Add entity types, domain errors with `code` properties (`UNBALANCED_JOURNAL`, `PERIOD_CLOSED`, `ACCOUNT_MAPPING_MISSING`, `ACCOUNTING_PERIOD_MISSING`), implement `accounting.ts`, export from `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @stock-management/domain test -- src/accounting.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "$(cat <<'EOF'
feat(domain): add GL entities and accounting pure helpers for Phase D1

EOF
)"
```

---

### Task 2: Drizzle schema + migration for GL tables

**Files:**
- Modify: `apps/api/src/infrastructure/db/schema/index.ts`
- Create: migration under `apps/api/drizzle/` (next file after `0006_phase_c3_landed_reval_reports.sql`, e.g. `0007_phase_d1_gl.sql`)

**Schema:**

```ts
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Append to existing schema/index.ts (organizations, branches already defined)

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const periodStatusEnum = pgEnum("period_status", ["open", "closed"]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("accounts_org_code_uidx").on(t.orgId, t.code)],
);

export const accountMappings = pgTable(
  "account_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    journalEventType: text("journal_event_type").notNull(),
    debitAccountId: uuid("debit_account_id")
      .notNull()
      .references(() => accounts.id),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => accounts.id),
  },
  (t) => [
    uniqueIndex("account_mappings_org_event_uidx").on(
      t.orgId,
      t.journalEventType,
    ),
  ],
);

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: periodStatusEnum("status").notNull().default("open"),
  },
  (t) => [
    uniqueIndex("accounting_periods_org_year_month_uidx").on(
      t.orgId,
      t.year,
      t.month,
    ),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    periodId: uuid("period_id")
      .notNull()
      .references(() => accountingPeriods.id),
    branchId: uuid("branch_id").references(() => branches.id),
    sourceDocumentType: text("source_document_type").notNull(),
    sourceDocumentId: uuid("source_document_id").notNull(),
    outboxEventId: uuid("outbox_event_id"),
    reversesJournalId: uuid("reverses_journal_id").references(
      (): AnyPgColumn => journalEntries.id,
    ),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("journal_entries_org_outbox_uidx")
      .on(t.orgId, t.outboxEventId)
      .where(sql`${t.outboxEventId} is not null`),
    index("journal_entries_source_idx").on(
      t.orgId,
      t.sourceDocumentType,
      t.sourceDocumentId,
    ),
  ],
);

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  debit: numeric("debit", { precision: 18, scale: 4 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 4 }).notNull().default("0"),
  lineNo: integer("line_no").notNull(),
});
```

- [ ] **Step 1: Add Drizzle tables/enums to schema**

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter @stock-management/api db:generate`  
Expected: new SQL under `apps/api/drizzle/`

- [ ] **Step 3: Apply migration**

Run: `pnpm --filter @stock-management/api db:migrate`  
Expected: success

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/infrastructure/db/schema/index.ts apps/api/drizzle
git commit -m "$(cat <<'EOF'
feat(api): add Phase D1 GL schema for accounts, periods, journals

EOF
)"
```

---

### Task 3: AccountingPort + EnsureDefaultChartOfAccounts (application)

**Files:**
- Create: `packages/application/src/ports/accounting.ts`
- Create: `packages/application/src/accounting/default-chart.ts`
- Create: `packages/application/src/use-cases/ensure-default-chart-of-accounts.ts`
- Create: `packages/application/src/use-cases/ensure-default-chart-of-accounts.test.ts`
- Modify: `packages/application/src/ports/unit-of-work.ts` — `accounting?: AccountingPort`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: domain `Account`, `AccountMapping`, `AccountingPeriod`, `JournalEntry`, `JournalLine`, helpers
- Produces:

```ts
export type JournalWithLines = JournalEntry & { lines: JournalLine[] };

export interface AccountingPort {
  listAccounts(orgId: string): Promise<Account[]>;
  findAccountByCode(orgId: string, code: string): Promise<Account | null>;
  insertAccount(
    account: Omit<Account, "id" | "createdAt"> & { id?: string },
  ): Promise<Account>;
  updateAccount(
    orgId: string,
    id: string,
    patch: Partial<Pick<Account, "name" | "active">>,
  ): Promise<Account>;

  listMappings(orgId: string): Promise<AccountMapping[]>;
  findMapping(
    orgId: string,
    journalEventType: string,
  ): Promise<AccountMapping | null>;
  upsertMapping(
    mapping: Omit<AccountMapping, "id"> & { id?: string },
  ): Promise<AccountMapping>;

  listPeriods(orgId: string): Promise<AccountingPeriod[]>;
  findPeriodByYearMonth(
    orgId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null>;
  findPeriodCoveringDate(
    orgId: string,
    onDate: string, // YYYY-MM-DD
  ): Promise<AccountingPeriod | null>;
  insertPeriod(
    period: Omit<AccountingPeriod, "id"> & { id?: string },
  ): Promise<AccountingPeriod>;
  setPeriodStatus(
    orgId: string,
    id: string,
    status: PeriodStatus,
  ): Promise<AccountingPeriod>;

  findJournalByOutboxEventId(
    orgId: string,
    outboxEventId: string,
  ): Promise<JournalWithLines | null>;
  findJournalById(orgId: string, id: string): Promise<JournalWithLines | null>;
  listJournalsBySourceDocument(
    orgId: string,
    sourceDocumentType: string,
    sourceDocumentId: string,
  ): Promise<JournalWithLines[]>;
  insertJournal(input: {
    entry: Omit<JournalEntry, "id" | "createdAt"> & { id?: string };
    lines: Array<Omit<JournalLine, "id" | "journalEntryId"> & { id?: string }>;
  }): Promise<JournalWithLines>;
}

export const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: AccountType;
}> = [
  { code: "1300", name: "Inventory", type: "asset" },
  { code: "1350", name: "Landed Cost Clearing", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "GRNI", type: "liability" },
  { code: "3900", name: "Revaluation Reserve", type: "equity" },
  { code: "5000", name: "COGS", type: "expense" },
  { code: "5100", name: "Inventory Adjustment Expense", type: "expense" },
];

export const DEFAULT_MAPPING_SPECS: Array<{
  journalEventType: JournalEventType;
  debitCode: string;
  creditCode: string;
}> = [
  { journalEventType: "goods_receipt.posted", debitCode: "1300", creditCode: "2100" },
  { journalEventType: "goods_receipt.voided", debitCode: "2100", creditCode: "1300" },
  { journalEventType: "stock_issue.posted", debitCode: "5000", creditCode: "1300" },
  { journalEventType: "stock_issue.voided", debitCode: "1300", creditCode: "5000" },
  { journalEventType: "supplier_return.posted", debitCode: "5000", creditCode: "1300" },
  { journalEventType: "supplier_return.voided", debitCode: "1300", creditCode: "5000" },
  { journalEventType: "inventory_decrease.posted", debitCode: "5100", creditCode: "1300" },
  { journalEventType: "inventory_decrease.voided", debitCode: "1300", creditCode: "5100" },
  { journalEventType: "inventory_increase.posted", debitCode: "1300", creditCode: "5100" },
  { journalEventType: "inventory_increase.voided", debitCode: "5100", creditCode: "1300" },
  { journalEventType: "landed_cost.posted", debitCode: "1300", creditCode: "1350" },
  { journalEventType: "landed_cost.voided", debitCode: "1350", creditCode: "1300" },
  { journalEventType: "cost_revaluation.increase", debitCode: "1300", creditCode: "3900" },
  { journalEventType: "cost_revaluation.increase.voided", debitCode: "3900", creditCode: "1300" },
  { journalEventType: "cost_revaluation.decrease", debitCode: "3900", creditCode: "1300" },
  { journalEventType: "cost_revaluation.decrease.voided", debitCode: "1300", creditCode: "3900" },
];
```

`EnsureDefaultChartOfAccounts.execute(orgId)`:
1. For each `DEFAULT_ACCOUNTS`, insert if `findAccountByCode` is null
2. Build code→id map
3. For each `DEFAULT_MAPPING_SPECS`, `upsertMapping` with resolved ids
4. Return `{ accounts, mappings }`

- [ ] **Step 1: Write failing test with in-memory fake AccountingPort**

```ts
import { describe, expect, it } from "vitest";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";
// fake stores maps for accounts + mappings

it("seeds seven accounts and default mappings idempotently", async () => {
  const { port } = makeFakeAccounting();
  const uc = new EnsureDefaultChartOfAccounts(port);
  const first = await uc.execute("org-1");
  expect(first.accounts).toHaveLength(7);
  expect(first.mappings).toHaveLength(16);
  const second = await uc.execute("org-1");
  expect(second.accounts).toHaveLength(7);
  expect(await port.findAccountByCode("org-1", "1300")).toMatchObject({
    name: "Inventory",
    type: "asset",
  });
  const grMap = await port.findMapping("org-1", "goods_receipt.posted");
  expect(grMap).not.toBeNull();
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/ensure-default-chart-of-accounts.test.ts` — expect FAIL

- [ ] **Step 3: Implement port type, default-chart specs, use case, export; add optional `accounting` on `UowContext`**

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application
git commit -m "$(cat <<'EOF'
feat(application): add AccountingPort and default CoA seed use case

EOF
)"
```

---

### Task 4: Period generate / list / open / close use cases

**Files:**
- Create: `packages/application/src/use-cases/accounting-periods.ts`
- Create: `packages/application/src/use-cases/accounting-periods.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: `AccountingPort`, domain `periodsForFiscalYear`, `assertPeriodOpen` (close path only needs status flip)
- Produces:

```ts
export class AccountingPeriodUseCases {
  constructor(
    private readonly accounting: AccountingPort,
    private readonly getFiscalYearStartMonth: (
      orgId: string,
    ) => Promise<number>,
  ) {}

  list(orgId: string): Promise<AccountingPeriod[]>;

  generate(
    orgId: string,
    fiscalYear: number,
  ): Promise<{ created: AccountingPeriod[]; existing: AccountingPeriod[] }>;
  // load fiscalYearStartMonth; for each month in periodsForFiscalYear:
  //   if findPeriodByYearMonth exists → existing; else insertPeriod status open

  open(orgId: string, periodId: string): Promise<AccountingPeriod>;
  // setPeriodStatus(..., "open")

  close(orgId: string, periodId: string): Promise<AccountingPeriod>;
  // setPeriodStatus(..., "closed") — no auto checklist in D1
}
```

- [ ] **Step 1: Write failing tests**

```ts
it("generates 12 open periods for fiscal year starting in January", async () => {
  const { port, uc } = makePeriodHarness(1);
  const result = await uc.generate("org-1", 2026);
  expect(result.created).toHaveLength(12);
  expect(result.created[0]).toMatchObject({
    year: 2026,
    month: 1,
    status: "open",
    startsOn: "2026-01-01",
    endsOn: "2026-01-31",
  });
  const again = await uc.generate("org-1", 2026);
  expect(again.created).toHaveLength(0);
  expect(again.existing).toHaveLength(12);
});

it("closes and reopens a period", async () => {
  const { uc } = makePeriodHarness(1);
  const { created } = await uc.generate("org-1", 2026);
  const closed = await uc.close("org-1", created[0].id);
  expect(closed.status).toBe("closed");
  const opened = await uc.open("org-1", created[0].id);
  expect(opened.status).toBe("open");
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/accounting-periods.test.ts` — expect FAIL

- [ ] **Step 3: Implement use cases**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/use-cases/accounting-periods.ts \
  packages/application/src/use-cases/accounting-periods.test.ts \
  packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(application): add accounting period generate open close use cases

EOF
)"
```

---

### Task 5: JournalEventMapper + ProcessOutboxForJournals

**Files:**
- Create: `packages/application/src/accounting/journal-event-mapper.ts`
- Create: `packages/application/src/accounting/journal-event-mapper.test.ts`
- Create: `packages/application/src/use-cases/process-outbox-for-journals.ts`
- Create: `packages/application/src/use-cases/process-outbox-for-journals.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: outbox shape `{ id, orgId, eventType, aggregateType, aggregateId, payload }`, `AccountingPort`, `EnsureDefaultChartOfAccounts`, domain asserts
- Produces:

```ts
export type OutboxLike = {
  id: string;
  orgId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export type JournalPlan =
  | { kind: "skip"; reason: string }
  | {
      kind: "create";
      journalEventType: JournalEventType;
      amount: string;
      sourceDocumentType: string;
      sourceDocumentId: string;
      branchId: string | null;
      postedAt: Date;
      isVoid: boolean;
    };

export function mapOutboxEventToJournalPlan(event: OutboxLike): JournalPlan;

// Rules:
// - eventType === "stock.changed" → skip
// - eventType not in document.posted|document.voided → skip
// - aggregateType === "stock_transfer" → skip (no money GL in D)
// - Read cost fields from payload via known keys
// - goods_receipt + inventoryValueDelta → goods_receipt.posted|voided
// - stock_issue|supplier_return + cogsTotal → *.posted|voided
// - stock_adjustment|stock_count: if cogsTotal present → inventory_decrease.*;
//     else if inventoryValueDelta → inventory_increase.*
// - customer_return + inventoryValueDelta → inventory_increase.*
// - landed_cost + landedAmount → landed_cost.*
// - cost_revaluation + revaluationValueDelta: sign picks increase|decrease
// - Missing / zero money fields → skip
// - isVoid = eventType === "document.voided"
// - branchId from payload.branchId if string uuid else null
// - postedAt = new Date() (or payload.postedAt if present ISO)

export class ProcessOutboxForJournals {
  constructor(
    private readonly accounting: AccountingPort,
    private readonly ensureDefaults: EnsureDefaultChartOfAccounts,
  ) {}

  async execute(event: OutboxLike): Promise<JournalWithLines | null> {
    const plan = mapOutboxEventToJournalPlan(event);
    if (plan.kind === "skip") return null;

    const existing = await this.accounting.findJournalByOutboxEventId(
      event.orgId,
      event.id,
    );
    if (existing) return existing;

    await this.ensureDefaults.execute(event.orgId);

    const mapping = await this.accounting.findMapping(
      event.orgId,
      plan.journalEventType,
    );
    if (!mapping) throw new AccountMappingMissingError(plan.journalEventType);

    const onDate = plan.postedAt.toISOString().slice(0, 10);
    const period = await this.accounting.findPeriodCoveringDate(
      event.orgId,
      onDate,
    );
    if (!period) throw new AccountingPeriodMissingError(onDate);
    assertPeriodOpen(period);

    const amount = moneyAbs(plan.amount);
    const lines: JournalLineDraft[] = [
      {
        accountId: mapping.debitAccountId,
        debit: amount,
        credit: "0",
        lineNo: 1,
      },
      {
        accountId: mapping.creditAccountId,
        debit: "0",
        credit: amount,
        lineNo: 2,
      },
    ];
    assertJournalBalanced(lines);

    let reversesJournalId: string | null = null;
    if (plan.isVoid) {
      const priors = await this.accounting.listJournalsBySourceDocument(
        event.orgId,
        plan.sourceDocumentType,
        plan.sourceDocumentId,
      );
      const original = priors.find((j) => j.reversesJournalId === null);
      reversesJournalId = original?.id ?? null;
    }

    return this.accounting.insertJournal({
      entry: {
        orgId: event.orgId,
        periodId: period.id,
        branchId: plan.branchId,
        sourceDocumentType: plan.sourceDocumentType,
        sourceDocumentId: plan.sourceDocumentId,
        outboxEventId: event.id,
        reversesJournalId,
        postedAt: plan.postedAt,
      },
      lines: lines.map((l) => ({
        orgId: event.orgId,
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        lineNo: l.lineNo,
      })),
    });
  }
}
```

- [ ] **Step 1: Write failing mapper tests**

```ts
it("maps GR posted to goods_receipt.posted with inventoryValueDelta", () => {
  const plan = mapOutboxEventToJournalPlan({
    id: "evt-1",
    orgId: "org-1",
    eventType: "document.posted",
    aggregateType: "goods_receipt",
    aggregateId: "gr-1",
    payload: { inventoryValueDelta: "37.5", receiptId: "gr-1" },
  });
  expect(plan).toMatchObject({
    kind: "create",
    journalEventType: "goods_receipt.posted",
    amount: "37.5",
    sourceDocumentType: "goods_receipt",
    sourceDocumentId: "gr-1",
    isVoid: false,
  });
});

it("skips stock.changed", () => {
  expect(
    mapOutboxEventToJournalPlan({
      id: "e",
      orgId: "o",
      eventType: "stock.changed",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: {},
    }),
  ).toEqual({ kind: "skip", reason: expect.any(String) });
});

it("maps void GR with reverse delta", () => {
  const plan = mapOutboxEventToJournalPlan({
    id: "evt-2",
    orgId: "org-1",
    eventType: "document.voided",
    aggregateType: "goods_receipt",
    aggregateId: "gr-1",
    payload: { inventoryValueDelta: "37.5" },
  });
  expect(plan).toMatchObject({
    kind: "create",
    journalEventType: "goods_receipt.voided",
    isVoid: true,
  });
});
```

- [ ] **Step 2: Write failing ProcessOutboxForJournals tests** (fake port preloaded with open period covering today + defaults)

```ts
it("creates Dr Inventory Cr GRNI journal idempotently", async () => {
  const { processor, port } = makeJournalHarness();
  const event = {
    id: "evt-1",
    orgId: "org-1",
    eventType: "document.posted",
    aggregateType: "goods_receipt",
    aggregateId: "gr-1",
    payload: { inventoryValueDelta: "30" },
  };
  const first = await processor.execute(event);
  expect(first?.lines).toHaveLength(2);
  const inv = await port.findAccountByCode("org-1", "1300");
  const grni = await port.findAccountByCode("org-1", "2100");
  expect(first?.lines[0]).toMatchObject({
    accountId: inv!.id,
    debit: "30",
    credit: "0",
  });
  expect(first?.lines[1]).toMatchObject({
    accountId: grni!.id,
    debit: "0",
    credit: "30",
  });
  const second = await processor.execute(event);
  expect(second?.id).toBe(first?.id);
});

it("rejects when period is closed", async () => {
  const { processor, closeCoveringPeriod } = makeJournalHarness();
  await closeCoveringPeriod();
  await expect(
    processor.execute({
      id: "evt-x",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "10" },
    }),
  ).rejects.toBeInstanceOf(PeriodClosedError);
});
```

- [ ] **Step 3: Implement mapper + processor**

- [ ] **Step 4: Run** `pnpm --filter @stock-management/application test -- src/accounting/journal-event-mapper.test.ts src/use-cases/process-outbox-for-journals.test.ts` — PASS

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/accounting packages/application/src/use-cases/process-outbox-for-journals.ts \
  packages/application/src/use-cases/process-outbox-for-journals.test.ts \
  packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(application): map outbox cost events to balanced GL journals

EOF
)"
```

---

### Task 6: Enrich void outbox payloads with reverse cost fields

**Files:**
- Modify: `packages/application/src/use-cases/void-goods-receipt.ts`
- Modify: `packages/application/src/use-cases/stock-issue.ts` (`enqueueIssueEvents`)
- Modify: `packages/application/src/use-cases/stock-adjustment.ts` (`enqueueAdjustmentEvents`)
- Modify: `packages/application/src/use-cases/stock-count.ts`
- Modify: `packages/application/src/use-cases/supplier-return.ts` (`enqueueReturnEvents`)
- Modify: `packages/application/src/use-cases/customer-return.ts`
- Modify: `packages/application/src/use-cases/landed-cost.ts` (`VoidLandedCost`)
- Modify: `packages/application/src/use-cases/cost-revaluation.ts` (`VoidCostRevaluation`)
- Test: extend existing use-case tests that assert outbox payloads (or add focused asserts in `post-goods-receipt.test.ts` / `outbound-documents.test.ts` / `landed-cost.test.ts`)

**Interfaces:**
- Consumes: `costingOutboxFields` from `packages/application/src/costing/outbox-cost-fields.ts`
- Produces: void `document.voided` payloads include the same money keys as the corresponding post, using amounts derived from void movements / document totals (absolute values; sign handled by `.voided` mapping swap)

**Per-document rules:**

| Use case | Void enrichment |
|----------|-----------------|
| `VoidGoodsReceipt` | Sum abs `totalCost` on void movements → `inventoryValueDelta` |
| `VoidStockIssue` / `VoidSupplierReturn` | Sum abs movement `totalCost` → `cogsTotal` |
| `VoidStockAdjustment` / `VoidStockCount` | Reuse `costingFieldsFromMovements` on void movements (same helper as post) |
| `VoidCustomerReturn` | Sum abs → `inventoryValueDelta` |
| `VoidLandedCost` | `landedAmount: doc.totalAmount` |
| `VoidCostRevaluation` | `revaluationValueDelta` = sum of forward adjustment amounts (same magnitude as post; mapping uses `.voided`) |
| Transfer void | Leave without money fields (mapper skips) |

Example GR void payload change:

```ts
await ctx.outbox.enqueue({
  orgId,
  eventType: "document.voided",
  aggregateType: "goods_receipt",
  aggregateId: receipt.id,
  payload: {
    receiptId: receipt.id,
    userId,
    ...costingOutboxFields({
      inventoryValueDelta: String(
        movements.reduce((sum, m) => sum + Math.abs(Number(m.totalCost ?? 0)), 0),
      ),
    }),
  },
});
```

For issue/adjustment/count/returns: change `action === "posted" ? costing… : {}` to always attach costing fields from the movements passed into the enqueue helper (posted and voided paths both have stamped costs).

- [ ] **Step 1: Write failing tests** asserting void outbox includes cost fields

```ts
it("enriches GR void outbox with inventoryValueDelta", async () => {
  const { uow, outbox } = makeFake("3");
  await new PostGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
  await new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
  const voidEvt = outbox.find(
    (e) => e.eventType === "document.voided" && e.aggregateType === "goods_receipt",
  );
  expect(voidEvt?.payload.inventoryValueDelta).toBe("30");
});
```

(Adapt to existing `makeFake` outbox capture pattern in `post-goods-receipt.test.ts`.)

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/post-goods-receipt.test.ts` — expect FAIL on new assert

- [ ] **Step 3: Implement enrichment across listed void paths**

- [ ] **Step 4: Run related application tests** — PASS

Run: `pnpm --filter @stock-management/application test`

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/use-cases
git commit -m "$(cat <<'EOF'
feat(application): enrich document.voided outbox payloads with reverse cost fields

EOF
)"
```

---

### Task 7: Drizzle AccountingPort + UoW + composition wiring

**Files:**
- Create: `apps/api/src/infrastructure/persistence/accounting.repository.ts`
- Modify: `apps/api/src/infrastructure/persistence/unit-of-work.ts`
- Modify: `apps/api/src/main/composition-root.ts`
- Create: `packages/application/src/use-cases/accounts.ts`
- Create: `packages/application/src/use-cases/journals.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: `AccountingPort`
- Produces: `DrizzleAccountingRepository` bound to `db` or `tx`; thin CRUD/inquiry use cases

```ts
export class DrizzleAccountingRepository implements AccountingPort {
  constructor(private readonly db: Db | Tx) {}
  // org-scoped queries; insertJournal inserts header then lines in same TX
  // findPeriodCoveringDate: WHERE starts_on <= onDate AND ends_on >= onDate
  // reverses_journal_id FK: .references(() => journalEntries.id) on journalEntries
}

export class AccountUseCases {
  constructor(private readonly accounting: AccountingPort) {}
  list(orgId: string): Promise<Account[]>;
  create(
    orgId: string,
    input: { code: string; name: string; type: AccountType },
  ): Promise<Account>;
  patch(
    orgId: string,
    id: string,
    patch: { name?: string; active?: boolean },
  ): Promise<Account>;
  listMappings(orgId: string): Promise<AccountMapping[]>;
  upsertMapping(
    orgId: string,
    input: {
      journalEventType: string;
      debitAccountId: string;
      creditAccountId: string;
    },
  ): Promise<AccountMapping>;
}

export class JournalUseCases {
  constructor(private readonly accounting: AccountingPort) {}
  getById(orgId: string, id: string): Promise<JournalWithLines>;
  // throws NotFoundError when missing
  listBySourceDocument(
    orgId: string,
    sourceDocumentType: string,
    sourceDocumentId: string,
  ): Promise<JournalWithLines[]>;
}
```

Wire on `DrizzleUnitOfWork` context: `accounting: new DrizzleAccountingRepository(tx)`.

Composition root additions on `AppServices`:

```ts
ensureDefaultChartOfAccounts: EnsureDefaultChartOfAccounts;
accountingPeriods: AccountingPeriodUseCases;
accounts: AccountUseCases;
journals: JournalUseCases;
processOutboxForJournals: ProcessOutboxForJournals;
```

`getFiscalYearStartMonth`: `async (orgId) => { const org = await orgRepo.findById(orgId); if (!org) throw new NotFoundError("Organization"); return org.fiscalYearStartMonth; }`.

- [ ] **Step 1: Implement repository methods (org-scoped)**

- [ ] **Step 2: Wire UoW + composition root + CRUD/journal inquiry use cases**

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @stock-management/api typecheck`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/infrastructure/persistence/accounting.repository.ts \
  apps/api/src/infrastructure/persistence/unit-of-work.ts \
  apps/api/src/main/composition-root.ts \
  packages/application/src/use-cases/accounts.ts \
  packages/application/src/use-cases/journals.ts \
  packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api): wire Drizzle AccountingPort into UnitOfWork and composition root

EOF
)"
```

---

### Task 8: Shared Zod + HTTP routes for CoA, mappings, periods

**Files:**
- Create: `packages/shared/src/accounting.ts`
- Modify: `packages/shared/src/index.ts` — export accounting schemas
- Create: `apps/api/src/interfaces/http/accounting.routes.ts`
- Create: `apps/api/src/interfaces/http/accounting.routes.test.ts`
- Modify: `apps/api/src/index.ts` — `await app.register(accountingRoutes(services), { prefix: "/api/v1" })`
- Modify: error handler mapping for `PeriodClosedError` → 409, `AccountMappingMissingError` → 400, `AccountingPeriodMissingError` → 400, `UnbalancedJournalError` → 500

**HTTP surface:**

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/accounts/ensure-defaults` | `EnsureDefaultChartOfAccounts` |
| `GET` | `/accounts` | list |
| `POST` | `/accounts` | create (code, name, type) |
| `PATCH` | `/accounts/:id` | name, active |
| `GET` | `/account-mappings` | list |
| `PUT` | `/account-mappings` | body `{ journalEventType, debitAccountId, creditAccountId }` upsert |
| `GET` | `/accounting-periods` | list |
| `POST` | `/accounting-periods/generate` | body `{ fiscalYear: number }` |
| `POST` | `/accounting-periods/:id/open` | reopen |
| `POST` | `/accounting-periods/:id/close` | hard close |

**Zod (sketch):**

```ts
export const accountSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  active: z.boolean(),
});

export const generatePeriodsBodySchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
});

export const upsertMappingBodySchema = z.object({
  journalEventType: z.string().min(1),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
});
```

- [ ] **Step 1: Add Zod schemas + failing route tests** (ensure-defaults returns 7 accounts; generate creates 12; close then open)

```ts
it("seeds defaults and generates periods", async () => {
  const app = await buildAccountingApp();
  const seed = await app.inject({
    method: "POST",
    url: "/api/v1/accounts/ensure-defaults",
    headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
  });
  expect(seed.statusCode).toBe(200);
  expect(seed.json().accounts).toHaveLength(7);

  const gen = await app.inject({
    method: "POST",
    url: "/api/v1/accounting-periods/generate",
    headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    payload: { fiscalYear: 2026 },
  });
  expect(gen.statusCode).toBe(200);
  expect(gen.json().created).toHaveLength(12);
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/api test -- src/interfaces/http/accounting.routes.test.ts` — FAIL

- [ ] **Step 3: Implement routes + register in `index.ts`**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/api/src/interfaces/http/accounting.routes.ts \
  apps/api/src/interfaces/http/accounting.routes.test.ts \
  apps/api/src/index.ts apps/api/src/interfaces/http/plugins
git commit -m "$(cat <<'EOF'
feat(api): add CoA, account mapping, and accounting period HTTP APIs

EOF
)"
```

---

### Task 9: Extend outbox poller + journal browser APIs

**Files:**
- Modify: `apps/api/src/infrastructure/workers/outbox-poller.ts`
- Modify: `apps/api/src/infrastructure/workers/outbox-poller.test.ts`
- Modify: `apps/api/src/index.ts` — construct `ProcessOutboxForJournals` with tx-scoped accounting repo inside poller TX
- Modify: `apps/api/src/interfaces/http/accounting.routes.ts` — journal GETs
- Modify: `apps/api/src/interfaces/http/accounting.routes.test.ts`
- Modify: `packages/shared/src/accounting.ts` — journal response schemas

Wire `ProcessOutboxForJournals` inside the same TX as claim via widened deps:

```ts
export type ProcessOutboxBatchOptions = {
  runInTransaction: <T>(
    fn: (deps: {
      store: OutboxPollerStore;
      processJournal: (event: PendingOutboxEvent) => Promise<void>;
    }) => Promise<T>,
  ) => Promise<T>;
  log: OutboxPollerLog;
  batchSize?: number;
};

// per event:
await deps.processJournal(row);
await deps.store.markProcessed(row.id);
```

Wire in `apps/api/src/index.ts`:

```ts
runInTransaction: (fn) =>
  db.transaction(async (tx) => {
    const store = new DrizzleOutboxRepository(tx);
    const accounting = new DrizzleAccountingRepository(tx);
    const processor = new ProcessOutboxForJournals(
      accounting,
      new EnsureDefaultChartOfAccounts(accounting),
    );
    return fn({
      store,
      processJournal: async (event) => {
        await processor.execute(event);
      },
    });
  }),
```

Update existing `outbox-poller.test.ts` fakes to supply `processJournal: async () => {}`.

**Journal HTTP:**

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/journals/:id` | `JournalUseCases.getById` → 404 if missing |
| `GET` | `/journals?sourceDocumentType=&sourceDocumentId=` | list with lines |

```ts
export const journalLineSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  debit: z.string(),
  credit: z.string(),
  lineNo: z.number().int(),
});

export const journalSchema = z.object({
  id: z.string().uuid(),
  periodId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  sourceDocumentType: z.string(),
  sourceDocumentId: z.string().uuid(),
  outboxEventId: z.string().uuid().nullable(),
  reversesJournalId: z.string().uuid().nullable(),
  postedAt: z.string().datetime(),
  lines: z.array(journalLineSchema),
});
```

- [ ] **Step 1: Write failing poller test** — `processJournal` called before `markProcessed`; on throw → `markFailed`

```ts
it("invokes processJournal before markProcessed", async () => {
  const store = createFakeStore([makeEvent()]);
  const order: string[] = [];
  await processOutboxBatch({
    runInTransaction: async (fn) =>
      fn({
        store,
        processJournal: async (e) => {
          order.push(`journal:${e.id}`);
        },
      }),
    log: { info: vi.fn(), error: vi.fn() },
  });
  // wrap store.markProcessed to push order
  expect(order[0]).toBe("journal:evt-1");
});
```

- [ ] **Step 2: Write failing journal GET route tests** (fake services)

- [ ] **Step 3: Implement poller + routes + index wiring**

- [ ] **Step 4: Run** `pnpm --filter @stock-management/api test -- src/infrastructure/workers/outbox-poller.test.ts src/interfaces/http/accounting.routes.test.ts` — PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/workers/outbox-poller.ts \
  apps/api/src/infrastructure/workers/outbox-poller.test.ts \
  apps/api/src/interfaces/http/accounting.routes.ts \
  apps/api/src/interfaces/http/accounting.routes.test.ts \
  apps/api/src/index.ts packages/shared/src/accounting.ts
git commit -m "$(cat <<'EOF'
feat(api): create journals from outbox poller and expose journal browser APIs

EOF
)"
```

---

### Task 10: Integration tests — GR post→journal and void→reverse

**Files:**
- Create: `apps/api/src/infrastructure/workers/outbox-journals.integration.test.ts`
- Modify: `packages/application/src/use-cases/post-goods-receipt.test.ts` — add assert that void outbox event processed through `ProcessOutboxForJournals` yields reverse journal (complement Task 6 enrichment assert)

**Approach:** In-memory end-to-end — fake outbox store + real `ProcessOutboxForJournals` + fake `AccountingPort` seeded with defaults/open period. Assert full debit/credit accounts and `reversesJournalId`. No live Postgres required.

```ts
describe("D1 GR journal flow", () => {
  it("posts GR cost event → Dr Inventory Cr GRNI", async () => {
    const { port, processor, ensurePeriod } = makeFullJournalHarness();
    await ensurePeriod("2026-07-01");
    const journal = await processor.execute({
      id: "outbox-post-1",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "37.5", branchId: null },
    });
    expect(journal).not.toBeNull();
    const inv = await port.findAccountByCode("org-1", "1300");
    const grni = await port.findAccountByCode("org-1", "2100");
    expect(journal!.lines).toEqual([
      expect.objectContaining({ accountId: inv!.id, debit: "37.5", credit: "0" }),
      expect.objectContaining({ accountId: grni!.id, debit: "0", credit: "37.5" }),
    ]);
    expect(journal!.outboxEventId).toBe("outbox-post-1");
  });

  it("voids GR → reversing journal linked to original", async () => {
    const { port, processor, ensurePeriod } = makeFullJournalHarness();
    await ensurePeriod("2026-07-01");
    const original = await processor.execute({
      id: "outbox-post-1",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "37.5" },
    });
    const reverse = await processor.execute({
      id: "outbox-void-1",
      orgId: "org-1",
      eventType: "document.voided",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "37.5" },
    });
    expect(reverse!.reversesJournalId).toBe(original!.id);
    const inv = await port.findAccountByCode("org-1", "1300");
    const grni = await port.findAccountByCode("org-1", "2100");
    // goods_receipt.voided mapping swaps: Dr GRNI Cr Inventory
    expect(reverse!.lines[0]).toMatchObject({
      accountId: grni!.id,
      debit: "37.5",
      credit: "0",
    });
    expect(reverse!.lines[1]).toMatchObject({
      accountId: inv!.id,
      debit: "0",
      credit: "37.5",
    });
  });

  it("poller marks stock.changed processed without journal", async () => {
    const store = createFakeStore([
      makeEvent({
        id: "evt-stock",
        eventType: "stock.changed",
        payload: {},
      }),
    ]);
    let journalCalls = 0;
    await processOutboxBatch({
      runInTransaction: async (fn) =>
        fn({
          store,
          processJournal: async (e) => {
            journalCalls += 1;
            await processor.execute(e); // returns null / skip
          },
        }),
      log: { info: vi.fn(), error: vi.fn() },
    });
    expect(journalCalls).toBe(1);
    expect(store.processed).toEqual(["evt-stock"]);
    expect(await port.listJournalsBySourceDocument("org-1", "goods_receipt", "gr-1")).toEqual([]);
  });
});
```

Also add one application test that void enrichment + mapper agree: after `VoidGoodsReceipt`, captured outbox void event processes to a reverse journal.

- [ ] **Step 1: Write failing integration/flow tests**

- [ ] **Step 2: Run** `pnpm --filter @stock-management/api test -- src/infrastructure/workers/outbox-journals.integration.test.ts` and `pnpm --filter @stock-management/application test` — FAIL until harness complete

- [ ] **Step 3: Fix any gaps in mapper void mappings / seed specs**

- [ ] **Step 4: PASS all D1-related tests**

Run:
```bash
pnpm --filter @stock-management/domain test
pnpm --filter @stock-management/application test
pnpm --filter @stock-management/api test
pnpm --filter @stock-management/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/workers/outbox-journals.integration.test.ts \
  packages/application
git commit -m "$(cat <<'EOF'
test: cover GR outbox journal create and void reverse for Phase D1

EOF
)"
```

---

### Task 11: Wiki + TASKS note after D1 ships

**Files:** `wiki/features/Phase D.md`, `wiki/concepts/Inventory Accounting.md`, `wiki/index.md`, `wiki/log.md`, `TASKS.md`, optionally one-line Status on `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`

> Note: **Planning Pass** already points at this deep plan. This task runs when **implementation** of D1 completes — not during plan-only work.

- [ ] **Step 1: Mark D1 done** in `TASKS.md`; keep D2/D3 waiting
- [ ] **Step 2: Update [[Phase D]] / [[Inventory Accounting]] with D1 shipped notes (CoA, periods, outbox journals, browser API)
- [ ] **Step 3: Append** `wiki/log.md`
- [ ] **Step 4: Commit** `docs: mark Phase D1 complete`

---

## Self-review checklist

- [x] Spec D1 rows: CoA, mappings, monthly periods, outbox→journals, journal browser, void/reverse
- [x] No AP / 3-way / aging / TB / P&L / BS / close checklist / web in this plan
- [x] Types consistent: `AccountingPort`, `JournalEventType`, `JournalWithLines`, cost field names match `outbox-cost-fields.ts`
- [x] Idempotency via `outbox_event_id` unique + find-before-insert
- [x] Hard period close via `assertPeriodOpen`
- [x] Poller skips `stock.changed` / transfers / no-money events
- [x] Void enrichment covers GR, issue, adjust, count, returns, landed, reval
- [x] Spec + master links correct
- [x] Test commands use real scripts: `pnpm --filter @stock-management/{domain,application,api} test`, `pnpm --filter @stock-management/api typecheck|db:generate|db:migrate`
