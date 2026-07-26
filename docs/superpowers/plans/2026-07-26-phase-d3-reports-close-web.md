# Phase D3 — Reports / Close Checklist / Thin Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Phase **D2 implemented** (supplier invoices, 3-way match, sync GRNI→AP journals, `GET /api/v1/reports/ap-aging`). Do not start D3 code until D2 DoD is met. **Do not re-implement AP aging** — web may *call* the D2 route only.

**Goal:** Ship trial balance, P&L, and balance sheet (optional branch filter), a soft period-close checklist (warnings only — hard close remains D1), and thin accountant web over D1/D2 APIs; then mark Phase D complete and unblock Phase E.

**Architecture:** Full Clean Architecture. Extend `AccountingPort` with aggregate line queries; add report + checklist use cases; thin HTTP under `/api/v1/reports/*` and `GET /accounting-periods/:id/close-checklist`. Web is page → TanStack Query hook → `api` client only (mirror Phase C3 costing pages). No new inventory post paths; no AP payment code; no manual journal create.

**Tech Stack:** Fastify, TypeScript, Drizzle, PostgreSQL, Zod (`packages/shared`), Vitest, Vite/React, TanStack Router/Query, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`  
**Master:** `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`  
**Prior:** `docs/superpowers/plans/2026-07-26-phase-d1-gl-journals.md`, `docs/superpowers/plans/2026-07-26-phase-d2-ap-three-way.md`  
**Wiki:** [[Phase D]] · [[Inventory Accounting]] · [[Feature Phases]]

## Global Constraints

- Full Clean Architecture — no `apps/api/src/modules/`
- Every tenant query includes `org_id`
- Money/qty: Phase B/C `Number()` + string pattern; org currency only
- Auth stub headers `X-Org-Id` + `X-User-Id`
- Web must **not** import `@stock-management/domain` or `@stock-management/application`
- Hard period close stays D1 (`POST .../:id/close`); checklist **never** closes a period
- Coding standards: `docs/architecture/coding-standards.md`

---

## Decisions (locked for D3)

| Topic | Choice |
|-------|--------|
| Report money | String decimals; compute with `Number()`; emit via `formatMoney(n)` = `(Math.round(n * 10000) / 10000).toFixed(4)` (same spirit as B/C) |
| Account net | `net = debitTotal − creditTotal` (asset/expense normal debit; liability/equity/income normal credit → negative net means credit balance) |
| Trial balance filter | Exactly one of `periodId` **or** `asOf` (YYYY-MM-DD). Optional `branchId` |
| TB / report `periodId` | Sum lines on journals where `journal.periodId === periodId` (period membership = within that period’s date bounds via D1 assignment). Optional `branchId` |
| TB / report `asOf` | Cumulative through calendar day: sum lines on journals where UTC date of `journal.postedAt` (`YYYY-MM-DD`) `<= asOf`. **Do not** filter by `period.endsOn <= asOf` (that drops mid-month activity in the open period). Optional `branchId` |
| P&L | Requires `periodId` (+ optional `branchId`). Include only `income` + `expense` accounts from that period’s rows. `totalIncome` = Σ (−net) for income (credit-positive). `totalExpense` = Σ net for expense. `netIncome` = `totalIncome − totalExpense` |
| Balance sheet | Requires `asOf` (+ optional `branchId`). Build from as-of account aggregates (`postedAt` date `<= asOf`). Section rows: `asset` / `liability` / `equity` only. **Interim equity:** fold `netIncome` (from same as-of rows via `buildPnl`) into equity — `totalEquity = Σ(credit−debit of equity accounts) + netIncome`. Expose `netIncome` on the report. Soft `balanced`: `\|totalAssets − (totalLiabilities + totalEquity)\| < 0.0001` (boolean; do not throw). Without folding P&L, BS cannot balance while books are open |
| Empty CoA sections | Default seed has **no income** accounts — P&L income may be empty/`"0.0000"`; still valid |
| Branch filter | When `branchId` set: only journals with that `branchId`. When omitted: all journals (including `branchId: null`) |
| Close checklist | Soft warnings only; returns `{ canCloseSuggested: boolean, warnings: Warning[] }`. `canCloseSuggested` is `warnings.length === 0`. Never calls `setPeriodStatus` |
| Checklist: unposted docs | Draft inventory docs with `createdAt` UTC date in `[period.startsOn, period.endsOn]`. Types: `goods_receipt`, `stock_issue`, `stock_transfer`, `stock_adjustment`, `stock_count`, `supplier_return`, `customer_return`, `landed_cost`, `cost_revaluation`. Exclude PO |
| Checklist: outbox | Count org rows with `status IN ('pending','failed')` (any created time — ops must drain before close) |
| Checklist: unmatched GRNI | Sum remaining unmatched amount on **posted** GR lines: `Σ (grLine.qty * unitCost − postedMatches)`. Warn if sum `> 0` |
| Checklist: draft invoices | Count `supplier_invoices` with `status = 'draft'` (org-wide; not date-filtered) |
| AP aging web | Calls existing D2 `GET /api/v1/reports/ap-aging` — **no** new aging use case |
| Manual journals | Still none — journal UI is read-only browser |
| UI stack | Match C3: `apps/web/src/api/client.ts` + `hooks/*.ts` + `pages/*Page.tsx` + TanStack Router in `App.tsx` |

### Report equations (brief)

```text
TB row:   debitTotal = Σ line.debit; creditTotal = Σ line.credit; net = debit − credit
P&L:      netIncome = totalIncome − totalExpense   (period via periodId)
BS:       totalEquity = equityAccounts + netIncome (as-of; interim)
          assets ≈ liabilities + totalEquity       (soft balanced flag)
asOf:     filter journal.postedAt UTC day <= asOf  (not period.endsOn)
periodId: filter journal.periodId === periodId
```

## Out of scope (D3)

- Rebuilding D1 CoA / periods / outbox journals or D2 invoice/aging backends
- AP payments / bank / remittance
- Manual journal create UI or API
- Webhook HTTP delivery (Phase E)
- Multi-currency / tax / match tolerances
- Auto-closing a period from the checklist

## File map

| Path | Responsibility |
|------|----------------|
| `packages/domain/src/financial-reports.ts` | Pure TB→P&L/BS builders + money format helper |
| `packages/domain/src/financial-reports.test.ts` | Domain unit tests |
| `packages/application/src/ports/accounting.ts` | Add `sumLinesByAccount` |
| `packages/application/src/ports/close-checklist.ts` | `CloseChecklistPort` query methods |
| `packages/application/src/use-cases/trial-balance.ts` | TB use case |
| `packages/application/src/use-cases/pnl-report.ts` | P&L use case |
| `packages/application/src/use-cases/balance-sheet.ts` | BS use case |
| `packages/application/src/use-cases/period-close-checklist.ts` | Checklist use case |
| `packages/application/src/use-cases/*.test.ts` | Application tests with fakes |
| `packages/shared/src/accounting.ts` | Extend Zod: report query/response + checklist |
| `apps/api/.../persistence/accounting.repository.ts` | Implement `sumLinesByAccount` |
| `apps/api/.../persistence/close-checklist.repository.ts` | Drizzle `CloseChecklistPort` |
| `apps/api/.../interfaces/http/financial-reports.routes.ts` | TB / P&L / BS |
| `apps/api/.../interfaces/http/accounting.routes.ts` | Add close-checklist route (or register beside periods) |
| `apps/web/src/api/client.ts` | Accounting + report + invoice client methods |
| `apps/web/src/hooks/accounting.ts` | TanStack Query hooks |
| `apps/web/src/pages/AccountsPage.tsx` | CoA list + ensure-defaults |
| `apps/web/src/pages/AccountingPeriodsPage.tsx` | Periods + checklist + open/close |
| `apps/web/src/pages/JournalsPage.tsx` | Journal browser by source doc |
| `apps/web/src/pages/SupplierInvoicesPage.tsx` | Invoice list / create draft / post / void |
| `apps/web/src/pages/SupplierInvoiceDetailPage.tsx` | Invoice detail |
| `apps/web/src/pages/ApAgingPage.tsx` | Aging (D2 API) |
| `apps/web/src/pages/TrialBalancePage.tsx` | TB |
| `apps/web/src/pages/PnlReportPage.tsx` | P&L |
| `apps/web/src/pages/BalanceSheetPage.tsx` | BS |
| `apps/web/src/App.tsx` | Routes + nav links |

**Consume from D1/D2 (by name — do not redefine):**

- `AccountingPort` — `listAccounts`, `listPeriods`, `findPeriodByYearMonth`, `findJournalById`, `listJournalsBySourceDocument`, `setPeriodStatus` (web close button still hits D1 HTTP)
- `ApPort.list` / `findById` / `create` / `sumOpenBalancesByPostedInvoice` (aging stays D2 route)
- D1 HTTP: `/accounts`, `/account-mappings`, `/accounting-periods`, `/journals`
- D2 HTTP: `/supplier-invoices`, `/reports/ap-aging`

---

### Task 1: Domain financial report helpers

**Files:**
- Create: `packages/domain/src/financial-reports.ts`
- Create: `packages/domain/src/financial-reports.test.ts`
- Modify: `packages/domain/src/index.ts` — re-export

**Interfaces:**
- Consumes: D1 `AccountType`
- Produces:

```ts
export function formatMoney(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

export type AccountBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debitTotal: string;
  creditTotal: string;
};

export type TrialBalanceReport = {
  rows: Array<AccountBalanceRow & { net: string }>;
  totalDebit: string;
  totalCredit: string;
};

export function buildTrialBalance(rows: AccountBalanceRow[]): TrialBalanceReport;
// For each row: net = formatMoney(Number(debit) - Number(credit))
// totalDebit / totalCredit = sum of debitTotal / creditTotal
// Omit rows where debitTotal and creditTotal are both 0? Keep all rows returned by query (query may filter zeros)

export type PnlReport = {
  income: Array<AccountBalanceRow & { net: string }>;
  expense: Array<AccountBalanceRow & { net: string }>;
  totalIncome: string;
  totalExpense: string;
  netIncome: string;
};

export function buildPnl(rows: AccountBalanceRow[]): PnlReport;
// income rows: type === "income"; contribution = -(debit-credit) = credit-debit
// expense rows: type === "expense"; contribution = debit-credit
// totalIncome = Σ income contributions; totalExpense = Σ expense contributions
// netIncome = totalIncome - totalExpense

export type BalanceSheetReport = {
  assets: Array<AccountBalanceRow & { net: string }>;
  liabilities: Array<AccountBalanceRow & { net: string }>;
  equity: Array<AccountBalanceRow & { net: string }>; // equity-type accounts only
  netIncome: string; // from buildPnl(rows).netIncome — folded into totalEquity
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string; // equityAccountsTotal + netIncome
  balanced: boolean;
};

export function buildBalanceSheet(rows: AccountBalanceRow[]): BalanceSheetReport;
// assets: type asset; amount = debit - credit
// liabilities: type liability; amount = credit - debit
// equity section rows: type equity; amount = credit - debit (accounts only)
// netIncome = buildPnl(rows).netIncome
// totalEquity = Σ equity amounts + Number(netIncome)   // interim fold
// balanced = |totalAssets - (totalLiabilities + totalEquity)| < 0.0001
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildTrialBalance,
  buildPnl,
  buildBalanceSheet,
} from "./financial-reports";

/** Balanced books: Inv 90 + GRNI 50 + AP 50 + Reval 30 + COGS 40 */
const rows = [
  {
    accountId: "a1",
    code: "1300",
    name: "Inventory",
    type: "asset" as const,
    debitTotal: "130.0000",
    creditTotal: "40.0000",
  },
  {
    accountId: "a2",
    code: "2100",
    name: "GRNI",
    type: "liability" as const,
    debitTotal: "50.0000",
    creditTotal: "100.0000",
  },
  {
    accountId: "a3",
    code: "2000",
    name: "AP",
    type: "liability" as const,
    debitTotal: "0.0000",
    creditTotal: "50.0000",
  },
  {
    accountId: "a4",
    code: "3900",
    name: "Reval",
    type: "equity" as const,
    debitTotal: "0.0000",
    creditTotal: "30.0000",
  },
  {
    accountId: "a5",
    code: "5000",
    name: "COGS",
    type: "expense" as const,
    debitTotal: "40.0000",
    creditTotal: "0.0000",
  },
];

describe("financial reports", () => {
  it("builds trial balance nets and totals", () => {
    const tb = buildTrialBalance(rows);
    expect(tb.totalDebit).toBe("220.0000");
    expect(tb.totalCredit).toBe("220.0000");
    expect(tb.rows.find((r) => r.code === "1300")!.net).toBe("90.0000");
  });

  it("builds P&L from income and expense only", () => {
    const pnl = buildPnl(rows);
    expect(pnl.income).toHaveLength(0);
    expect(pnl.totalExpense).toBe("40.0000");
    expect(pnl.netIncome).toBe("-40.0000");
  });

  it("folds netIncome into equity for interim balanced BS", () => {
    const bs = buildBalanceSheet(rows);
    expect(bs.totalAssets).toBe("90.0000");
    expect(bs.totalLiabilities).toBe("100.0000");
    expect(bs.netIncome).toBe("-40.0000");
    // equity accounts 30 + netIncome -40 = -10
    expect(bs.totalEquity).toBe("-10.0000");
    expect(bs.equity.find((r) => r.code === "3900")).toBeTruthy();
    expect(bs.balanced).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @stock-management/domain test -- src/financial-reports.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation** in `financial-reports.ts` matching the signatures above

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @stock-management/domain test -- src/financial-reports.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/financial-reports.ts packages/domain/src/financial-reports.test.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat(domain): add TB P&L and balance sheet pure builders

EOF
)"
```

---

### Task 2: AccountingPort.sumLinesByAccount + TB / P&L / BS use cases

**Files:**
- Modify: `packages/application/src/ports/accounting.ts`
- Create: `packages/application/src/use-cases/trial-balance.ts`
- Create: `packages/application/src/use-cases/trial-balance.test.ts`
- Create: `packages/application/src/use-cases/pnl-report.ts`
- Create: `packages/application/src/use-cases/pnl-report.test.ts`
- Create: `packages/application/src/use-cases/balance-sheet.ts`
- Create: `packages/application/src/use-cases/balance-sheet.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `apps/api/src/infrastructure/persistence/accounting.repository.ts` — implement new method (can land in Task 4 with HTTP if preferred; application tests use fakes)

**Interfaces:**
- Consumes: `AccountBalanceRow`, `buildTrialBalance`, `buildPnl`, `buildBalanceSheet`
- Produces:

```ts
// On AccountingPort:
sumLinesByAccount(
  orgId: string,
  filter: {
    periodId?: string;
    asOf?: string; // YYYY-MM-DD — UTC date of journal.postedAt <= asOf
    branchId?: string;
  },
): Promise<AccountBalanceRow[]>;
// SQL sketch:
// SELECT a.id, a.code, a.name, a.type,
//   COALESCE(SUM(jl.debit),0), COALESCE(SUM(jl.credit),0)
// FROM journal_lines jl
// JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.org_id = jl.org_id
// JOIN accounts a ON a.id = jl.account_id AND a.org_id = jl.org_id
// WHERE jl.org_id = $org
//   AND (
//     periodId ? je.period_id = $periodId
//             : (je.posted_at AT TIME ZONE 'UTC')::date <= $asOf::date
//   )
//   AND ($branchId IS NULL OR je.branch_id = $branchId)
// GROUP BY a.id
// HAVING SUM(jl.debit) <> 0 OR SUM(jl.credit) <> 0
// Lock: **non-zero activity only**. Never filter asOf via period.ends_on.

export type TrialBalanceQuery =
  | { periodId: string; asOf?: never; branchId?: string }
  | { asOf: string; periodId?: never; branchId?: string };

export class TrialBalanceUseCase {
  constructor(private readonly accounting: AccountingPort) {}
  async execute(orgId: string, query: TrialBalanceQuery): Promise<TrialBalanceReport> {
    if ("periodId" in query && query.periodId) {
      const rows = await this.accounting.sumLinesByAccount(orgId, {
        periodId: query.periodId,
        branchId: query.branchId,
      });
      return buildTrialBalance(rows);
    }
    const rows = await this.accounting.sumLinesByAccount(orgId, {
      asOf: query.asOf!,
      branchId: query.branchId,
    });
    return buildTrialBalance(rows);
  }
}

export class PnlReportUseCase {
  constructor(private readonly accounting: AccountingPort) {}
  async execute(
    orgId: string,
    input: { periodId: string; branchId?: string },
  ): Promise<PnlReport> {
    const rows = await this.accounting.sumLinesByAccount(orgId, {
      periodId: input.periodId,
      branchId: input.branchId,
    });
    return buildPnl(rows);
  }
}

export class BalanceSheetUseCase {
  constructor(private readonly accounting: AccountingPort) {}
  async execute(
    orgId: string,
    input: { asOf: string; branchId?: string },
  ): Promise<BalanceSheetReport> {
    const rows = await this.accounting.sumLinesByAccount(orgId, {
      asOf: input.asOf,
      branchId: input.branchId,
    });
    return buildBalanceSheet(rows); // folds netIncome into totalEquity
  }
}
```

**Test harness (put in each test file or a shared `report-test-fakes.ts` next to the use cases):**

```ts
import type { Account, AccountType } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting";
import { formatMoney } from "@stock-management/domain";

type FakeLine = {
  orgId: string;
  periodId: string;
  postedAt: Date; // used for asOf: UTC YYYY-MM-DD
  branchId: string | null;
  account: Pick<Account, "id" | "code" | "name" | "type">;
  debit: string;
  credit: string;
};

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makeAccount(
  id: string,
  code: string,
  name: string,
  type: AccountType,
): Pick<Account, "id" | "code" | "name" | "type"> {
  return { id, code, name, type };
}

/** Concrete fake: only sumLinesByAccount is exercised by report use cases. */
function makeFakeAccountingWithLines(lines: FakeLine[]): AccountingPort {
  return {
    // unused stubs — throw if called so tests stay honest
    async listAccounts() {
      throw new Error("not used");
    },
    async findAccountByCode() {
      throw new Error("not used");
    },
    async insertAccount() {
      throw new Error("not used");
    },
    async updateAccount() {
      throw new Error("not used");
    },
    async listMappings() {
      throw new Error("not used");
    },
    async findMapping() {
      throw new Error("not used");
    },
    async upsertMapping() {
      throw new Error("not used");
    },
    async listPeriods() {
      throw new Error("not used");
    },
    async findPeriodByYearMonth() {
      throw new Error("not used");
    },
    async findPeriodCoveringDate() {
      throw new Error("not used");
    },
    async insertPeriod() {
      throw new Error("not used");
    },
    async setPeriodStatus() {
      throw new Error("not used");
    },
    async findJournalByOutboxEventId() {
      throw new Error("not used");
    },
    async findJournalById() {
      throw new Error("not used");
    },
    async listJournalsBySourceDocument() {
      throw new Error("not used");
    },
    async insertJournal() {
      throw new Error("not used");
    },

    async sumLinesByAccount(orgId, filter) {
      const matched = lines.filter((l) => {
        if (l.orgId !== orgId) return false;
        if (filter.branchId !== undefined && l.branchId !== filter.branchId) {
          return false;
        }
        if (filter.periodId !== undefined) {
          return l.periodId === filter.periodId;
        }
        if (filter.asOf !== undefined) {
          return utcDay(l.postedAt) <= filter.asOf;
        }
        return false;
      });
      const byAccount = new Map<
        string,
        {
          accountId: string;
          code: string;
          name: string;
          type: AccountType;
          debit: number;
          credit: number;
        }
      >();
      for (const l of matched) {
        const cur = byAccount.get(l.account.id) ?? {
          accountId: l.account.id,
          code: l.account.code,
          name: l.account.name,
          type: l.account.type,
          debit: 0,
          credit: 0,
        };
        cur.debit += Number(l.debit);
        cur.credit += Number(l.credit);
        byAccount.set(l.account.id, cur);
      }
      return [...byAccount.values()]
        .filter((r) => r.debit !== 0 || r.credit !== 0)
        .map((r) => ({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          type: r.type,
          debitTotal: formatMoney(r.debit),
          creditTotal: formatMoney(r.credit),
        }));
    },
  } as AccountingPort;
}

const inv = makeAccount("acc-inv", "1300", "Inventory", "asset");
const cogs = makeAccount("acc-cogs", "5000", "COGS", "expense");
const ap = makeAccount("acc-ap", "2000", "AP", "liability");
const equity = makeAccount("acc-eq", "3900", "Reval", "equity");
```

- [ ] **Step 1: Write failing application tests** with the concrete fake above

```ts
it("trial balance filters by periodId via port", async () => {
  const accounting = makeFakeAccountingWithLines([
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: inv,
      debit: "10",
      credit: "0",
    },
    {
      orgId: "org-1",
      periodId: "p2",
      postedAt: new Date("2026-08-05T12:00:00.000Z"),
      branchId: null,
      account: inv,
      debit: "5",
      credit: "0",
    },
  ]);
  const uc = new TrialBalanceUseCase(accounting);
  const report = await uc.execute("org-1", { periodId: "p1" });
  expect(report.totalDebit).toBe("10.0000");
});

it("asOf includes mid-period postedAt on or before asOf", async () => {
  const accounting = makeFakeAccountingWithLines([
    {
      orgId: "org-1",
      periodId: "p-july", // period ends 2026-07-31
      postedAt: new Date("2026-07-15T08:00:00.000Z"),
      branchId: null,
      account: inv,
      debit: "25",
      credit: "0",
    },
    {
      orgId: "org-1",
      periodId: "p-july",
      postedAt: new Date("2026-07-20T08:00:00.000Z"),
      branchId: null,
      account: inv,
      debit: "0",
      credit: "25",
    },
  ]);
  const uc = new TrialBalanceUseCase(accounting);
  // Mid-month asOf must include 2026-07-15 activity (endsOn filter would wrongly drop it
  // if the period were still open and we keyed on endsOn <= asOf)
  const report = await uc.execute("org-1", { asOf: "2026-07-15" });
  expect(report.totalDebit).toBe("25.0000");
  expect(report.totalCredit).toBe("0.0000");
});

it("P&L uses only the requested period", async () => {
  const accounting = makeFakeAccountingWithLines([
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: cogs,
      debit: "40",
      credit: "0",
    },
    {
      orgId: "org-1",
      periodId: "p2",
      postedAt: new Date("2026-08-01T12:00:00.000Z"),
      branchId: null,
      account: cogs,
      debit: "99",
      credit: "0",
    },
  ]);
  const uc = new PnlReportUseCase(accounting);
  const report = await uc.execute("org-1", { periodId: "p1" });
  expect(report.totalExpense).toBe("40.0000");
  expect(report.netIncome).toBe("-40.0000");
});

it("balance sheet folds netIncome and uses postedAt asOf", async () => {
  const accounting = makeFakeAccountingWithLines([
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: inv,
      debit: "130",
      credit: "40",
    },
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: ap,
      debit: "0",
      credit: "50",
    },
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: makeAccount("acc-grni", "2100", "GRNI", "liability"),
      debit: "50",
      credit: "100",
    },
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: equity,
      debit: "0",
      credit: "30",
    },
    {
      orgId: "org-1",
      periodId: "p1",
      postedAt: new Date("2026-07-10T12:00:00.000Z"),
      branchId: null,
      account: cogs,
      debit: "40",
      credit: "0",
    },
  ]);
  const uc = new BalanceSheetUseCase(accounting);
  const report = await uc.execute("org-1", { asOf: "2026-07-31" });
  expect(report.netIncome).toBe("-40.0000");
  expect(report.totalEquity).toBe("-10.0000");
  expect(report.balanced).toBe(true);
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/trial-balance.test.ts src/use-cases/pnl-report.test.ts src/use-cases/balance-sheet.test.ts` — FAIL

- [ ] **Step 3: Implement** port method signature + three use cases (tests use `makeFakeAccountingWithLines` above as-is)

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/ports/accounting.ts \
  packages/application/src/use-cases/trial-balance.ts \
  packages/application/src/use-cases/trial-balance.test.ts \
  packages/application/src/use-cases/pnl-report.ts \
  packages/application/src/use-cases/pnl-report.test.ts \
  packages/application/src/use-cases/balance-sheet.ts \
  packages/application/src/use-cases/balance-sheet.test.ts \
  packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(application): add trial balance P&L and balance sheet use cases

EOF
)"
```

---

### Task 3: Period close checklist port + use case

**Files:**
- Create: `packages/application/src/ports/close-checklist.ts`
- Create: `packages/application/src/use-cases/period-close-checklist.ts`
- Create: `packages/application/src/use-cases/period-close-checklist.test.ts`
- Modify: `packages/application/src/index.ts`
- Create: `apps/api/src/infrastructure/persistence/close-checklist.repository.ts` (implementation may ship with Task 4)

**Interfaces:**
- Consumes: D1 `AccountingPort.findPeriod…` / `listPeriods`; inventory doc ports; `ApPort`; outbox table access
- Produces:

```ts
export type CloseChecklistWarningCode =
  | "UNPOSTED_INVENTORY_DOCS"
  | "OUTBOX_PENDING_OR_FAILED"
  | "UNMATCHED_GRNI"
  | "DRAFT_SUPPLIER_INVOICES";

export type CloseChecklistWarning = {
  code: CloseChecklistWarningCode;
  message: string;
  count?: number;
  amount?: string;
  documentType?: string;
};

export type CloseChecklistReport = {
  periodId: string;
  startsOn: string;
  endsOn: string;
  warnings: CloseChecklistWarning[];
  canCloseSuggested: boolean; // warnings.length === 0
};

export interface CloseChecklistPort {
  countDraftInventoryDocsInRange(
    orgId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<Array<{ documentType: string; count: number }>>;
  // createdAt::date between startsOn and endsOn inclusive; status = 'draft'
  // Union query across GR, issue, transfer, adjust, count, supplier_return,
  // customer_return, landed_costs, cost_revaluations

  countOutboxPendingOrFailed(orgId: string): Promise<{
    pending: number;
    failed: number;
  }>;

  sumUnmatchedPostedGrAmount(orgId: string): Promise<string>;
  // For each posted GR line with unitCost:
  //   remaining = Number(qty)*Number(unitCost) - sum(posted invoice_matches.matched_amount)
  // Return formatMoney(sum of remaining > 0)

  countDraftSupplierInvoices(orgId: string): Promise<number>;
}

export class PeriodCloseChecklistUseCase {
  constructor(
    private readonly accounting: AccountingPort,
    private readonly checklist: CloseChecklistPort,
  ) {}

  async execute(orgId: string, periodId: string): Promise<CloseChecklistReport> {
    const periods = await this.accounting.listPeriods(orgId);
    const period = periods.find((p) => p.id === periodId);
    if (!period) throw new NotFoundError("AccountingPeriod", periodId);

    const warnings: CloseChecklistWarning[] = [];

    const drafts = await this.checklist.countDraftInventoryDocsInRange(
      orgId,
      period.startsOn,
      period.endsOn,
    );
    for (const row of drafts) {
      if (row.count > 0) {
        warnings.push({
          code: "UNPOSTED_INVENTORY_DOCS",
          message: `${row.count} draft ${row.documentType} document(s) dated in period`,
          count: row.count,
          documentType: row.documentType,
        });
      }
    }

    const outbox = await this.checklist.countOutboxPendingOrFailed(orgId);
    if (outbox.pending + outbox.failed > 0) {
      warnings.push({
        code: "OUTBOX_PENDING_OR_FAILED",
        message: `${outbox.pending} pending and ${outbox.failed} failed outbox event(s)`,
        count: outbox.pending + outbox.failed,
      });
    }

    const grni = await this.checklist.sumUnmatchedPostedGrAmount(orgId);
    if (Number(grni) > 0) {
      warnings.push({
        code: "UNMATCHED_GRNI",
        message: `Unmatched posted GR value (GRNI) ${grni}`,
        amount: grni,
      });
    }

    const draftInvoices = await this.checklist.countDraftSupplierInvoices(orgId);
    if (draftInvoices > 0) {
      warnings.push({
        code: "DRAFT_SUPPLIER_INVOICES",
        message: `${draftInvoices} draft supplier invoice(s)`,
        count: draftInvoices,
      });
    }

    return {
      periodId: period.id,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      warnings,
      canCloseSuggested: warnings.length === 0,
    };
  }
}
```

- [ ] **Step 1: Write failing test**

```ts
it("returns soft warnings and does not close the period", async () => {
  const accounting = makeFakeAccounting({
    periods: [
      {
        id: "p1",
        orgId: "org-1",
        year: 2026,
        month: 7,
        startsOn: "2026-07-01",
        endsOn: "2026-07-31",
        status: "open",
      },
    ],
  });
  const checklist = makeFakeChecklist({
    drafts: [{ documentType: "goods_receipt", count: 2 }],
    outbox: { pending: 1, failed: 0 },
    unmatchedGrni: "15.0000",
    draftInvoices: 1,
  });
  const setStatus = vi.spyOn(accounting, "setPeriodStatus");
  const uc = new PeriodCloseChecklistUseCase(accounting, checklist);
  const report = await uc.execute("org-1", "p1");
  expect(report.canCloseSuggested).toBe(false);
  expect(report.warnings.map((w) => w.code)).toEqual([
    "UNPOSTED_INVENTORY_DOCS",
    "OUTBOX_PENDING_OR_FAILED",
    "UNMATCHED_GRNI",
    "DRAFT_SUPPLIER_INVOICES",
  ]);
  expect(setStatus).not.toHaveBeenCalled();
});

it("suggests close when clean", async () => {
  const uc = new PeriodCloseChecklistUseCase(
    accountingOpenPeriod,
    emptyChecklist,
  );
  const report = await uc.execute("org-1", "p1");
  expect(report.canCloseSuggested).toBe(true);
  expect(report.warnings).toEqual([]);
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/period-close-checklist.test.ts` — FAIL

- [ ] **Step 3: Implement** port + use case

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/ports/close-checklist.ts \
  packages/application/src/use-cases/period-close-checklist.ts \
  packages/application/src/use-cases/period-close-checklist.test.ts \
  packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(application): add period close checklist soft warnings

EOF
)"
```

---

### Task 4: Shared Zod + Drizzle adapters + HTTP routes

**Files:**
- Modify: `packages/shared/src/accounting.ts` (or create `packages/shared/src/financial-reports.ts` and export from shared index)
- Create: `apps/api/src/interfaces/http/financial-reports.routes.ts`
- Create: `apps/api/src/interfaces/http/financial-reports.routes.test.ts`
- Modify: `apps/api/src/interfaces/http/accounting.routes.ts` — `GET /accounting-periods/:id/close-checklist`
- Create or extend: `apps/api/src/interfaces/http/accounting.routes.test.ts` — checklist case
- Modify: `apps/api/src/infrastructure/persistence/accounting.repository.ts` — `sumLinesByAccount`
- Create: `apps/api/src/infrastructure/persistence/close-checklist.repository.ts`
- Modify: `apps/api/src/main/composition-root.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Produces (shared Zod — query **and** response shapes):

```ts
const MoneyStringSchema = z.string().regex(/^-?\d+\.\d{4}$/);
const AccountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const AccountBalanceRowSchema = z.object({
  accountId: UuidSchema,
  code: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  debitTotal: MoneyStringSchema,
  creditTotal: MoneyStringSchema,
  net: MoneyStringSchema.optional(), // present on TB rows
});

export const TrialBalanceQuerySchema = z
  .object({
    periodId: UuidSchema.optional(),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    branchId: UuidSchema.optional(),
  })
  .refine(
    (q) => Boolean(q.periodId) !== Boolean(q.asOf),
    { message: "Provide exactly one of periodId or asOf" },
  );

export const TrialBalanceResponseSchema = z.object({
  rows: z.array(
    AccountBalanceRowSchema.extend({ net: MoneyStringSchema }),
  ),
  totalDebit: MoneyStringSchema,
  totalCredit: MoneyStringSchema,
});

export const PnlQuerySchema = z.object({
  periodId: UuidSchema,
  branchId: UuidSchema.optional(),
});

export const PnlResponseSchema = z.object({
  income: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  expense: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  totalIncome: MoneyStringSchema,
  totalExpense: MoneyStringSchema,
  netIncome: MoneyStringSchema,
});

export const BalanceSheetQuerySchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branchId: UuidSchema.optional(),
});

export const BalanceSheetResponseSchema = z.object({
  assets: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  liabilities: z.array(
    AccountBalanceRowSchema.extend({ net: MoneyStringSchema }),
  ),
  equity: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  netIncome: MoneyStringSchema,
  totalAssets: MoneyStringSchema,
  totalLiabilities: MoneyStringSchema,
  totalEquity: MoneyStringSchema,
  balanced: z.boolean(),
});

export const AccountingPeriodIdParamsSchema = z.object({ id: UuidSchema });

export const CloseChecklistWarningSchema = z.object({
  code: z.enum([
    "UNPOSTED_INVENTORY_DOCS",
    "OUTBOX_PENDING_OR_FAILED",
    "UNMATCHED_GRNI",
    "DRAFT_SUPPLIER_INVOICES",
  ]),
  message: z.string(),
  count: z.number().int().optional(),
  amount: MoneyStringSchema.optional(),
  documentType: z.string().optional(),
});

export const CloseChecklistResponseSchema = z.object({
  periodId: UuidSchema,
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warnings: z.array(CloseChecklistWarningSchema),
  canCloseSuggested: z.boolean(),
});
```

Parse query with the Query schemas; optionally assert response with Response schemas in route tests (`Schema.parse(res.json())`).

**Routes:**

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/v1/reports/trial-balance` | `TrialBalanceUseCase` |
| GET | `/api/v1/reports/pnl` | `PnlReportUseCase` |
| GET | `/api/v1/reports/balance-sheet` | `BalanceSheetUseCase` |
| GET | `/api/v1/accounting-periods/:id/close-checklist` | `PeriodCloseChecklistUseCase` |

**Do not add** a new `/reports/ap-aging` — already D2.

- [ ] **Step 1: Write failing route tests**

```ts
it("GET /reports/trial-balance?periodId= returns rows", async () => {
  // seed org, open period, accounts, balanced journal in period
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/reports/trial-balance?periodId=${periodId}`,
    headers: { "x-org-id": orgId, "x-user-id": userId },
  });
  expect(res.statusCode).toBe(200);
  const body = TrialBalanceResponseSchema.parse(res.json());
  expect(body.totalDebit).toBeDefined();
});

it("GET /reports/trial-balance without periodId or asOf is 400", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/reports/trial-balance",
    headers: { "x-org-id": orgId, "x-user-id": userId },
  });
  expect(res.statusCode).toBe(400);
});

it("GET /reports/pnl?periodId= returns netIncome", async () => {
  // seed: period with COGS journal line debit 40 (and balancing credit)
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/reports/pnl?periodId=${periodId}`,
    headers: { "x-org-id": orgId, "x-user-id": userId },
  });
  expect(res.statusCode).toBe(200);
  const body = PnlResponseSchema.parse(res.json());
  expect(body.totalExpense).toBe("40.0000");
  expect(body.netIncome).toBe("-40.0000");
});

it("GET /reports/balance-sheet?asOf= folds netIncome and sets balanced", async () => {
  // seed: as-of dataset matching Task 1 balanced books (Inv/GRNI/AP/Reval/COGS)
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/reports/balance-sheet?asOf=2026-07-31`,
    headers: { "x-org-id": orgId, "x-user-id": userId },
  });
  expect(res.statusCode).toBe(200);
  const body = BalanceSheetResponseSchema.parse(res.json());
  expect(body.netIncome).toBe("-40.0000");
  expect(body.totalEquity).toBe("-10.0000");
  expect(body.balanced).toBe(true);
});

it("GET /accounting-periods/:id/close-checklist returns warnings shape", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/accounting-periods/${periodId}/close-checklist`,
    headers: { "x-org-id": orgId, "x-user-id": userId },
  });
  expect(res.statusCode).toBe(200);
  const body = CloseChecklistResponseSchema.parse(res.json());
  expect(body).toMatchObject({
    periodId,
    warnings: expect.any(Array),
    canCloseSuggested: expect.any(Boolean),
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/api test -- src/interfaces/http/financial-reports.routes.test.ts` — FAIL

- [ ] **Step 3: Implement** Zod, Drizzle `sumLinesByAccount`, `DrizzleCloseChecklistRepository`, routes, composition wiring

`sumLinesByAccount` notes:
- Join `journal_lines` → `journal_entries` → `accounts` (period join optional; not used for asOf)
- `periodId` filter: `je.period_id = $periodId`
- `asOf` filter: `(je.posted_at AT TIME ZONE 'UTC')::date <= $asOf::date` — **not** `period.ends_on`
- `branchId`: `je.branch_id = $branchId`
- Group by account; `HAVING` non-zero debit or credit sums
- Always `org_id` on every table predicate

- [ ] **Step 4: PASS** + `pnpm --filter @stock-management/shared typecheck` + `pnpm --filter @stock-management/api typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/api/src/infrastructure/persistence \
  apps/api/src/interfaces/http/financial-reports.routes.ts \
  apps/api/src/interfaces/http/financial-reports.routes.test.ts \
  apps/api/src/interfaces/http/accounting.routes.ts \
  apps/api/src/main/composition-root.ts \
  apps/api/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api): add financial reports and period close checklist HTTP

EOF
)"
```

---

### Task 5: Web API client + accounting hooks

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/hooks/accounting.ts`

**Interfaces:**
- Produces client methods (exact names):

```ts
// apps/web/src/api/client.ts — add to `api` object:
listAccounts: (ctx) => request("/api/v1/accounts", ctx),
ensureDefaultAccounts: (ctx) =>
  request("/api/v1/accounts/ensure-defaults", ctx, { method: "POST" }),
listAccountMappings: (ctx) => request("/api/v1/account-mappings", ctx),
listAccountingPeriods: (ctx) => request("/api/v1/accounting-periods", ctx),
generateAccountingPeriods: (ctx, body: { fiscalYear: number }) =>
  request("/api/v1/accounting-periods/generate", ctx, {
    method: "POST",
    body: JSON.stringify(body),
  }),
openAccountingPeriod: (ctx, id: string) =>
  request(`/api/v1/accounting-periods/${id}/open`, ctx, { method: "POST" }),
closeAccountingPeriod: (ctx, id: string) =>
  request(`/api/v1/accounting-periods/${id}/close`, ctx, { method: "POST" }),
getCloseChecklist: (ctx, id: string) =>
  request(`/api/v1/accounting-periods/${id}/close-checklist`, ctx),
getJournal: (ctx, id: string) => request(`/api/v1/journals/${id}`, ctx),
listJournalsBySource: (
  ctx,
  q: { sourceDocumentType: string; sourceDocumentId: string },
) => request(withQuery("/api/v1/journals", q), ctx),
listSupplierInvoices: (ctx) => request("/api/v1/supplier-invoices", ctx),
getSupplierInvoice: (ctx, id: string) =>
  request(`/api/v1/supplier-invoices/${id}`, ctx),
createSupplierInvoice: (ctx, body: unknown) =>
  request("/api/v1/supplier-invoices", ctx, {
    method: "POST",
    body: JSON.stringify(body),
  }),
postSupplierInvoice: (ctx, id: string, body?: unknown) =>
  request(`/api/v1/supplier-invoices/${id}/post`, ctx, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  }),
voidSupplierInvoice: (ctx, id: string, body?: unknown) =>
  request(`/api/v1/supplier-invoices/${id}/void`, ctx, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  }),
listApAging: (ctx, q: { asOf: string }) =>
  request(withQuery("/api/v1/reports/ap-aging", q), ctx),
listTrialBalance: (
  ctx,
  q: { periodId?: string; asOf?: string; branchId?: string },
) => request(withQuery("/api/v1/reports/trial-balance", q), ctx),
listPnl: (ctx, q: { periodId: string; branchId?: string }) =>
  request(withQuery("/api/v1/reports/pnl", q), ctx),
listBalanceSheet: (ctx, q: { asOf: string; branchId?: string }) =>
  request(withQuery("/api/v1/reports/balance-sheet", q), ctx),
```

Hooks in `apps/web/src/hooks/accounting.ts` (mirror `hooks/costing.ts`):

```ts
export function useAccounts() { /* api.listAccounts */ }
export function useEnsureDefaultAccounts() { /* mutation */ }
export function useAccountMappings() { /* … */ }
export function useAccountingPeriods() { /* … */ }
export function useGenerateAccountingPeriods() { /* … */ }
export function useOpenAccountingPeriod() { /* … */ }
export function useCloseAccountingPeriod() { /* … */ }
export function useCloseChecklist(periodId: string) {
  // enabled: Boolean(periodId); api.getCloseChecklist
}
export function useJournalsBySource(q: {
  sourceDocumentType: string;
  sourceDocumentId: string;
}) { /* enabled when both set */ }
export function useJournal(id: string) { /* … */ }
export function useSupplierInvoices() { /* … */ }
export function useSupplierInvoice(id: string) { /* … */ }
export function useCreateSupplierInvoice() { /* … */ }
export function usePostSupplierInvoice() { /* … */ }
export function useVoidSupplierInvoice() { /* … */ }
export function useApAging(asOf: string) { /* api.listApAging — D2 */ }
export function useTrialBalance(filters: {
  periodId?: string;
  asOf?: string;
  branchId?: string;
}) { /* … */ }
export function usePnl(filters: { periodId: string; branchId?: string }) { /* … */ }
export function useBalanceSheet(filters: {
  asOf: string;
  branchId?: string;
}) { /* … */ }
```

- [ ] **Step 1: Add client methods + hooks**

- [ ] **Step 2: Typecheck web**

Run: `pnpm --filter @stock-management/web typecheck`  
Expected: PASS (no pages wired yet is OK)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/hooks/accounting.ts
git commit -m "$(cat <<'EOF'
feat(web): add accounting and financial report API client hooks

EOF
)"
```

---

### Task 6: Thin web — CoA, periods (+ checklist), journal browser

**Files:**
- Create: `apps/web/src/pages/AccountsPage.tsx`
- Create: `apps/web/src/pages/AccountingPeriodsPage.tsx`
- Create: `apps/web/src/pages/JournalsPage.tsx`
- Modify: `apps/web/src/App.tsx` — routes + nav

**Routes (TanStack Router, same pattern as `/cost-valuation`):**

| Path | Component |
|------|-----------|
| `/accounts` | `AccountsPage` |
| `/accounting-periods` | `AccountingPeriodsPage` |
| `/journals` | `JournalsPage` |

**UX (thin, match costing pages):**
- **Accounts:** table of code/name/type/active; button “Ensure defaults”; read-only mappings table below (code keys from `useAccountMappings`)
- **Periods:** list year/month/status/dates; generate by fiscal year input; Open / Close buttons calling D1 APIs; selected period shows `useCloseChecklist` warnings list + `canCloseSuggested` badge (checklist does **not** auto-close — Close still explicit)
- **Journals:** inputs for `sourceDocumentType` + `sourceDocumentId`; table of journals + expandable lines (account, debit, credit); optional jump by journal id

- [ ] **Step 1: Implement pages + register routes/nav in `App.tsx`**

Nav labels: `Accounts`, `Periods`, `Journals` (group under accounting near Valuation/COGS).

- [ ] **Step 2: Manual verify (or Playwright if present — prefer manual smoke)**

Checklist:
1. Open `/accounts` → Ensure defaults → see seeded codes `1300`…`5100`
2. Open `/accounting-periods` → Generate year → see open months → checklist for a period returns JSON-shaped warnings list in UI
3. Open `/journals` with a known posted GR source → see journal lines after D1 poller

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/AccountsPage.tsx \
  apps/web/src/pages/AccountingPeriodsPage.tsx \
  apps/web/src/pages/JournalsPage.tsx \
  apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): add CoA periods and journal browser pages

EOF
)"
```

---

### Task 7: Thin web — supplier invoices + AP aging (D2 API)

**Files:**
- Create: `apps/web/src/pages/SupplierInvoicesPage.tsx`
- Create: `apps/web/src/pages/SupplierInvoiceDetailPage.tsx`
- Create: `apps/web/src/pages/ApAgingPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Routes:**

| Path | Component |
|------|-----------|
| `/supplier-invoices` | `SupplierInvoicesPage` |
| `/supplier-invoices/$invoiceId` | `SupplierInvoiceDetailPage` |
| `/ap-aging` | `ApAgingPage` |

**UX:**
- **List:** status, invoice number, date, supplier; link to detail; minimal create-draft form (supplierId, invoiceNumber, invoiceDate, one line with PO/GR line ids + qty/cost/amount)
- **Detail:** lines table; Post / Void buttons (no payments UI); show status
- **Aging:** `asOf` date input → `useApAging(asOf)` → buckets table + grand total (**calls D2 only**)

- [ ] **Step 1: Implement pages + routes/nav** (`Supplier invoices`, `AP aging`)

- [ ] **Step 2: Manual verify**

1. Create draft invoice → appear in list
2. Post (with valid D2 seed data) → status `posted`
3. `/ap-aging?` UI with asOf → bucket totals render (empty OK if no posted bills)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/SupplierInvoicesPage.tsx \
  apps/web/src/pages/SupplierInvoiceDetailPage.tsx \
  apps/web/src/pages/ApAgingPage.tsx \
  apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): add supplier invoices and AP aging pages

EOF
)"
```

---

### Task 8: Thin web — TB / P&L / BS

**Files:**
- Create: `apps/web/src/pages/TrialBalancePage.tsx`
- Create: `apps/web/src/pages/PnlReportPage.tsx`
- Create: `apps/web/src/pages/BalanceSheetPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Routes:**

| Path | Component |
|------|-----------|
| `/reports/trial-balance` | `TrialBalancePage` |
| `/reports/pnl` | `PnlReportPage` |
| `/reports/balance-sheet` | `BalanceSheetPage` |

**UX (mirror `CostValuationPage` filters + table):**
- **TB:** toggle/select exactly one of period dropdown **or** asOf date; optional branch; table code/name/debit/credit/net; footer totals
- **P&L:** required period; optional branch; income section, expense section, net income
- **BS:** required asOf; optional branch; assets / liabilities / equity sections; show `netIncome` (folded into equity total) and `balanced` flag

- [ ] **Step 1: Implement pages + nav** (`Trial balance`, `P&L`, `Balance sheet`)

- [ ] **Step 2: Manual verify**

1. With journals in an open period, TB by `periodId` shows balancing totals
2. P&L for same period shows expense (COGS) when issues posted
3. BS asOf mid-month or period end shows assets/liabilities/equity, `netIncome`, folded `totalEquity`, and `balanced`

- [ ] **Step 3: `pnpm --filter @stock-management/web typecheck` PASS**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/TrialBalancePage.tsx \
  apps/web/src/pages/PnlReportPage.tsx \
  apps/web/src/pages/BalanceSheetPage.tsx \
  apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): add trial balance P&L and balance sheet pages

EOF
)"
```

---

### Task 9: Phase D DoD — wiki, FEATURES, TASKS, unblock E

**Files:**
- Modify: `wiki/features/Phase D.md` — mark complete; note TB/P&L/BS, checklist, thin web
- Modify: `wiki/concepts/Inventory Accounting.md` — report equations + checklist soft-warn
- Modify: `wiki/features/Feature Phases.md` — D done; E next
- Modify: `wiki/features/Phase E.md` — unblocked if it has a blocked note
- Modify: `wiki/index.md`, `wiki/log.md`
- Modify: `docs/FEATURES.md` — Phase D rows reflected as shipped when code lands
- Modify: `docs/superpowers/plans/2026-07-26-phase-d-accounting.md` — status complete; D3 checkbox
- Modify: `TASKS.md` — D1–D3 done; Phase E active/someday → active

**Interfaces:** None (docs only). Follow `wiki/AGENTS.md` + obsidian-markdown: read `wiki/index.md` first; append log.

- [ ] **Step 1: Read** `wiki/index.md` + affected pages

- [ ] **Step 2: Update** pages with D3 facts:
  - TB: periodId **or** asOf via `postedAt` UTC day; optional branch
  - P&L: period income − expense
  - BS: as-of A/L/E with interim `netIncome` folded into `totalEquity`; soft `balanced`
  - Checklist: soft warnings only; hard close remains D1 API
  - Thin web routes listed above
  - AP aging web consumes D2 API (not reimplemented)

- [ ] **Step 3: Append** `wiki/log.md`:

```markdown
## [YYYY-MM-DD] update | Phase D3 reports close web shipped — Phase D complete
```

- [ ] **Step 4: Verify DoD checklist** (below) all checked against repo

- [ ] **Step 5: Commit**

```bash
git add wiki docs/FEATURES.md docs/superpowers/plans/2026-07-26-phase-d-accounting.md TASKS.md
git commit -m "$(cat <<'EOF'
docs: mark Phase D complete and unblock Phase E

EOF
)"
```

---

## Definition of done (D3 / Phase D)

- [ ] Domain TB/P&L/BS builders tested
- [ ] `AccountingPort.sumLinesByAccount` + three report use cases
- [ ] Period close checklist use case (soft warn; never auto-closes)
- [ ] HTTP: `GET /reports/trial-balance`, `/reports/pnl`, `/reports/balance-sheet`
- [ ] HTTP: `GET /accounting-periods/:id/close-checklist`
- [ ] Thin web: CoA, periods (+ checklist), journals, invoices, aging (D2), TB/P&L/BS
- [ ] No AP aging backend reimplementation; no manual journal create; no payments
- [ ] `pnpm --filter @stock-management/domain test` + application report/checklist tests + API route tests green
- [ ] `pnpm --filter @stock-management/web typecheck` green
- [ ] Wiki [[Phase D]] complete; [[Feature Phases]] / TASKS unblock Phase E
- [ ] All `docs/FEATURES.md` Phase D rows covered across D1–D3

## Self-review (plan author)

1. **Spec coverage:** Design D3 items (TB, P&L, BS optional branch, close checklist soft warnings, thin web CoA/periods/journals/invoices/aging/reports) map to Tasks 1–8; Phase D DoD Task 9.
2. **No AP aging rebuild:** Task 7 web calls D2 `listApAging` / `/reports/ap-aging` only.
3. **Equations locked:** `periodId` = journal.periodId; `asOf` = `postedAt` UTC day `<= asOf` (not `period.endsOn`); P&L income−expense; interim BS folds `netIncome` into `totalEquity` for soft `balanced`.
4. **Hard close unchanged:** Checklist never calls `setPeriodStatus`; Close button still D1 HTTP.
5. **Type consistency:** `AccountBalanceRow`, `TrialBalanceQuery`, `CloseChecklistWarningCode`, response Zod (`TrialBalanceResponseSchema`, `PnlResponseSchema`, `BalanceSheetResponseSchema`, `CloseChecklistResponseSchema`), client method names match across tasks.
6. **Placeholder scan:** No TBD/TODO; concrete files, routes, full fake harness, test snippets, commit messages.
7. **CA layers:** Domain pure builders; application use cases + ports; infra Drizzle; HTTP thin; web page→hook→client only.
8. **Route coverage:** Task 4 includes TB, P&L (`periodId`), BS (`asOf` + `netIncome`/`balanced`), checklist.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-phase-d3-reports-close-web.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks

**2. Inline Execution** — `executing-plans` with checkpoints

Implement only after D2 ships and the user explicitly starts D3.
