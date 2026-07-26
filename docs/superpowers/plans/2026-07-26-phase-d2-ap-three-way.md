# Phase D2 — AP / Three-Way Match / Aging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Phase **D1 implemented** (CoA, `AccountingPort` on UoW, periods, journal writer, default mappings including GRNI `2100` + AP `2000`). Do not start D2 code until D1 DoD is met.

**Goal:** Ship supplier invoices with **exact** line-level 3-way match (PO ↔ GR ↔ invoice), sync GRNI→AP match journals in the invoice post UoW, void via reversing journals, and AP aging (entire posted balance; no payments).

**Architecture:** Full Clean Architecture. Inventory post/outbox poller unchanged. Invoice post/void run in their own UoW: validate match rules → write `invoice_matches` → mark invoice posted → **write balanced journal via `AccountingPort.insertJournal` in the same TX** (not outbox). Void finds the forward journal by source document and inserts a reversing entry. HTTP thin under `/api/v1/supplier-invoices` + `/api/v1/reports/ap-aging`. **No** payments, TB/P&L/BS, period-close checklist, or web UI (D3).

**Tech Stack:** Fastify, TypeScript, Drizzle, PostgreSQL, Zod (`packages/shared`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-26-phase-d-accounting-design.md`  
**Master:** `docs/superpowers/plans/2026-07-26-phase-d-accounting.md`  
**Prior:** `docs/superpowers/plans/2026-07-26-phase-d1-gl-journals.md`  
**Wiki:** [[Phase D]] · [[Inventory Accounting]] · [[Feature Phases]]

## Global Constraints

- Full Clean Architecture — no `apps/api/src/modules/`
- Every tenant table / query includes `org_id`
- Inventory UoW / outbox poller **unchanged** in D2
- Journal lines never UPDATE/DELETE; void → reversing journal with `reverses_journal_id`
- Hard period close: reject invoice journals dated in a closed period (`assertPeriodOpen`)
- Money/qty: Phase B/C `Number()` + string pattern; org currency only
- Auth stub headers `X-Org-Id` + `X-User-Id`
- Coding standards: `docs/architecture/coding-standards.md`

---

## Decisions (locked for D2)

| Topic | Choice |
|-------|--------|
| Invoice journal timing | **Sync in invoice post UoW** via `AccountingPort.insertJournal` — not outbox `ap.invoice.posted`. Simpler for AP; void reverses in same style. Inventory journals stay async (D1). |
| Inventory bill links | Every invoice line **requires** both `purchaseOrderLineId` **and** `goodsReceiptLineId` (not optional) |
| GR ↔ PO consistency | GR line’s `purchaseOrderLineId` must equal the invoice line’s `purchaseOrderLineId`; GR header must be `posted` |
| Match tolerance | **Exact** qty and unit-cost match; **no** % tolerance |
| Unit-cost equality | `Number(invoiceLine.unitCost) === Number(poLine.unitCost)` and `Number(invoiceLine.unitCost) === Number(grLine.unitCost)`; missing PO/GR unit cost → reject |
| Remaining capacity | `matchedQty/Amount ≤ remaining unmatched` on **both** PO line and GR line; remaining = capacity − sum of matches from **posted** invoices (voided invoice matches do not count) |
| PO capacity qty | `purchaseOrderLine.orderedQty` |
| GR capacity qty | `goodsReceiptLine.qty` |
| Amount capacity | PO: `orderedQty * unitCost`; GR: `qty * unitCost`; invoice line `amount` must equal `qty * unitCost` (string via `Number()`) |
| Match rows | On post, insert one `InvoiceMatch` per invoice line (links invoice line ↔ PO line ↔ GR line + matched qty/amount) |
| Invoice status | `draft` → `posted` → `voided` (dedicated `SupplierInvoiceStatus`; not DocumentStatus `"void"`) |
| Journal event types | Extend D1: `supplier_invoice.posted` (Dr GRNI `2100` / Cr AP `2000`), `supplier_invoice.voided` (Dr AP / Cr GRNI). Seed via `DEFAULT_MAPPING_SPECS` |
| Journal amount | Sum of invoice line `amount` values (matched total) |
| Journal provenance | `sourceDocumentType: "supplier_invoice"`, `sourceDocumentId: invoice.id`, `outboxEventId: null` |
| Void reverse | `listJournalsBySourceDocument` → pick forward (`reversesJournalId == null`); insert reverse with swapped lines + `reversesJournalId`; mark invoice `voided` |
| Idempotency | Post/void accept `external_system` + `external_id` via existing `IdempotencyPort` (`post-supplier-invoice` / `void-supplier-invoice`); optional columns on invoice header |
| AP aging open | Entire **posted** invoice balance (sum of line amounts); voided excluded; **no** payments |
| Aging buckets | `0-30` / `31-60` / `61-90` / `90+` by calendar days between `invoiceDate` and `asOf` (inclusive day count: `floor((asOf - invoiceDate) / 1d)`) |
| Branch | Optional `branchId` on invoice header; copied to journal when set |
| UI | No web screens in D2 (API only) |

### Journal matrix (D2 addition)

| Trigger | `journalEventType` | Debit | Credit | Amount |
|---------|--------------------|-------|--------|--------|
| Invoice posted (matched) | `supplier_invoice.posted` | GRNI (`2100`) | AP (`2000`) | Σ line amounts |
| Invoice voided | `supplier_invoice.voided` | AP (`2000`) | GRNI (`2100`) | same as forward |

## Out of scope (D2)

- AP payments, remittance, bank reconciliation
- Trial balance / P&L / balance sheet / period-close checklist / thin web (D3)
- Re-doing D1 CoA / outbox poller / inventory void enrichment
- Non-inventory / expense-only AP without PO+GR
- Match % tolerances
- Multi-currency / tax
- Manual journals

## Invoice post → journal flow (D2)

```mermaid
sequenceDiagram
  participant HTTP as PostSupplierInvoice
  participant TX as UoW_TX
  participant AP as ApPort
  participant Dom as threeWayMatch
  participant GL as AccountingPort

  HTTP->>TX: begin
  TX->>AP: load draft invoice + lines
  TX->>Dom: validate exact 3-way vs PO/GR + remaining
  Dom-->>TX: match drafts
  TX->>AP: insert invoice_matches; mark posted
  TX->>GL: findMapping supplier_invoice.posted
  TX->>GL: findPeriodCoveringDate; assertPeriodOpen
  TX->>GL: insertJournal Dr GRNI Cr AP
  TX-->>HTTP: commit
```

## File map

| Path | Responsibility |
|------|----------------|
| `packages/domain/src/types.ts` | `SupplierInvoiceStatus`; extend `JOURNAL_EVENT_TYPES` with invoice posted/voided |
| `packages/domain/src/entities.ts` | `SupplierInvoice`, `SupplierInvoiceLine`, `InvoiceMatch` |
| `packages/domain/src/errors.ts` | Match / invoice lifecycle errors |
| `packages/domain/src/ap-match.ts` | Pure 3-way validation + remaining + aging helpers |
| `packages/domain/src/ap-match.test.ts` | Domain unit tests |
| `packages/application/src/accounting/default-chart.ts` | Add invoice mapping specs to `DEFAULT_MAPPING_SPECS` |
| `packages/application/src/ports/ap.ts` | `ApPort` |
| `packages/application/src/ports/unit-of-work.ts` | `ap?: ApPort` (D1 already adds `accounting?`) |
| `packages/application/src/use-cases/supplier-invoices.ts` | Draft list/get/create/update |
| `packages/application/src/use-cases/post-supplier-invoice.ts` | 3-way + matches + sync journal |
| `packages/application/src/use-cases/void-supplier-invoice.ts` | Reverse journal + void status |
| `packages/application/src/use-cases/ap-aging.ts` | Aging report query |
| `packages/shared/src/ap.ts` | Zod DTOs for invoices + aging |
| `apps/api/src/infrastructure/db/schema/index.ts` | Three tables + enum |
| `apps/api/drizzle/0008_phase_d2_ap.sql` | Migration (after D1 `0007_…`) |
| `apps/api/src/infrastructure/persistence/ap.repository.ts` | Drizzle `ApPort` |
| `apps/api/src/infrastructure/persistence/unit-of-work.ts` | Wire `ap` |
| `apps/api/src/interfaces/http/supplier-invoices.routes.ts` | CRUD + post/void |
| `apps/api/src/interfaces/http/ap-reports.routes.ts` | `GET /reports/ap-aging` |
| `apps/api/src/main/composition-root.ts` | Wire use cases |
| `apps/api/src/index.ts` | Register routes |

**Consume from D1 (by name — do not redefine):**

- `AccountingPort` — especially `findMapping`, `findPeriodCoveringDate`, `insertJournal`, `listJournalsBySourceDocument`, `findAccountByCode`
- `EnsureDefaultChartOfAccounts` / `DEFAULT_ACCOUNTS` (AP `2000`, GRNI `2100`)
- Domain helpers: `assertPeriodOpen`, `assertJournalBalanced`, `moneyAbs`, `JournalLineDraft`
- `UowContext.accounting`

Reuse: `IdempotencyPort`, composition root, auth stub, `PostIdempotencySchema` / headers from shared inventory patterns, `ctx.po.findLineById`, `ctx.gr.findById`.

---

### Task 1: Domain AP entities, match rules, aging helpers

**Files:**
- Modify: `packages/domain/src/types.ts`, `entities.ts`, `errors.ts`, `index.ts`
- Create: `packages/domain/src/ap-match.ts`
- Test: `packages/domain/src/ap-match.test.ts`

**Interfaces:**
- Consumes: existing `PurchaseOrderLine`, `GoodsReceiptLine`, `GoodsReceipt` shapes; D1 `JOURNAL_EVENT_TYPES` array (extend)
- Produces:

```ts
export type SupplierInvoiceStatus = "draft" | "posted" | "voided";

// Append to JOURNAL_EVENT_TYPES (D1 list):
// "supplier_invoice.posted",
// "supplier_invoice.voided",

export type SupplierInvoice = {
  id: string;
  orgId: string;
  supplierId: string;
  branchId: string | null;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string | null;
  status: SupplierInvoiceStatus;
  externalSystem: string | null;
  externalId: string | null;
  postedAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SupplierInvoiceLine = {
  id: string;
  orgId: string;
  supplierInvoiceId: string;
  productId: string | null;
  lineNumber: number;
  qty: string;
  unitCost: string;
  amount: string;
  purchaseOrderLineId: string; // required
  goodsReceiptLineId: string; // required
};

export type InvoiceMatch = {
  id: string;
  orgId: string;
  supplierInvoiceLineId: string;
  purchaseOrderLineId: string;
  goodsReceiptLineId: string;
  matchedQty: string;
  matchedAmount: string;
};

export class ThreeWayMatchError extends DomainError { /* code: THREE_WAY_MATCH */ }
export class InvoiceNotDraftError extends DomainError { /* code: INVALID_STATE */ }
export class InvoiceNotPostedError extends DomainError { /* code: INVALID_STATE */ }
export class InvoiceAlreadyVoidedError extends DomainError { /* code: INVALID_STATE */ }

export type MatchLineInput = {
  lineNumber: number;
  qty: string;
  unitCost: string;
  amount: string;
  purchaseOrderLineId: string;
  goodsReceiptLineId: string;
  productId?: string | null;
};

export type MatchLineContext = {
  poLine: Pick<PurchaseOrderLine, "id" | "orderedQty" | "unitCost" | "productId" | "purchaseOrderId">;
  grLine: Pick<GoodsReceiptLine, "id" | "qty" | "unitCost" | "productId" | "purchaseOrderLineId" | "goodsReceiptId">;
  gr: Pick<GoodsReceipt, "id" | "status" | "supplierId">;
  /** Sum of matched qty/amount from *posted* invoices only */
  matchedOnPo: { qty: string; amount: string };
  matchedOnGr: { qty: string; amount: string };
};

export type PlannedInvoiceMatch = {
  purchaseOrderLineId: string;
  goodsReceiptLineId: string;
  matchedQty: string;
  matchedAmount: string;
  lineNumber: number;
};

/** capacity − alreadyMatched; throws ThreeWayMatchError if request > remaining */
export function assertRemainingCapacity(
  capacityQty: string,
  capacityAmount: string,
  alreadyMatchedQty: string,
  alreadyMatchedAmount: string,
  requestQty: string,
  requestAmount: string,
  label: string, // "PO line" | "GR line"
): void;

export function assertExactUnitCost(
  invoiceUnitCost: string,
  poUnitCost: string | null,
  grUnitCost: string | null,
): void;

export function assertLineAmount(qty: string, unitCost: string, amount: string): void;

/** Validates one inventory invoice line; returns planned match */
export function planInvoiceLineMatch(
  line: MatchLineInput,
  ctx: MatchLineContext,
): PlannedInvoiceMatch;

/** Validate all lines; returns plans in lineNumber order */
export function planThreeWayMatches(
  lines: MatchLineInput[],
  resolveContext: (line: MatchLineInput) => MatchLineContext,
): PlannedInvoiceMatch[];

export type AgingBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export function daysBetween(invoiceDate: string, asOf: string): number;
// UTC date-only: Math.floor((Date.parse(asOf) - Date.parse(invoiceDate)) / 86400000)

export function agingBucket(daysOutstanding: number): AgingBucketKey;
// <0 → treat as 0-30; 0..30 → 0-30; 31..60 → 31-60; 61..90 → 61-90; else 90+

export type ApAgingInvoiceRow = {
  invoiceId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  openBalance: string;
  daysOutstanding: number;
  bucket: AgingBucketKey;
};

export type ApAgingReport = {
  asOf: string;
  totalsByBucket: Record<AgingBucketKey, string>;
  grandTotal: string;
  invoices: ApAgingInvoiceRow[];
};

export function buildApAgingReport(
  invoices: Array<{
    id: string;
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    status: SupplierInvoiceStatus;
    openBalance: string;
  }>,
  asOf: string,
): ApAgingReport;
// Only status === "posted"; openBalance already = Σ line amounts
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  assertExactUnitCost,
  assertLineAmount,
  assertRemainingCapacity,
  agingBucket,
  buildApAgingReport,
  daysBetween,
  planInvoiceLineMatch,
  ThreeWayMatchError,
} from "./ap-match.js";

describe("assertRemainingCapacity", () => {
  it("allows when request fits remaining", () => {
    expect(() =>
      assertRemainingCapacity("10", "100", "4", "40", "6", "60", "PO line"),
    ).not.toThrow();
  });

  it("rejects over-qty", () => {
    expect(() =>
      assertRemainingCapacity("10", "100", "4", "40", "7", "70", "PO line"),
    ).toThrow(ThreeWayMatchError);
  });
});

describe("assertExactUnitCost", () => {
  it("rejects cost mismatch", () => {
    expect(() => assertExactUnitCost("11", "10", "10")).toThrow(
      ThreeWayMatchError,
    );
  });

  it("rejects null reference cost", () => {
    expect(() => assertExactUnitCost("10", null, "10")).toThrow(
      ThreeWayMatchError,
    );
  });
});

describe("assertLineAmount", () => {
  it("rejects amount not equal qty * unitCost", () => {
    expect(() => assertLineAmount("2", "10", "21")).toThrow(ThreeWayMatchError);
  });
});

describe("planInvoiceLineMatch", () => {
  const base = {
    poLine: {
      id: "pol-1",
      orderedQty: "10",
      unitCost: "5",
      productId: "p1",
      purchaseOrderId: "po-1",
    },
    grLine: {
      id: "grl-1",
      qty: "8",
      unitCost: "5",
      productId: "p1",
      purchaseOrderLineId: "pol-1",
      goodsReceiptId: "gr-1",
    },
    gr: { id: "gr-1", status: "posted" as const, supplierId: "sup-1" },
    matchedOnPo: { qty: "0", amount: "0" },
    matchedOnGr: { qty: "0", amount: "0" },
  };

  it("plans exact match", () => {
    const plan = planInvoiceLineMatch(
      {
        lineNumber: 1,
        qty: "3",
        unitCost: "5",
        amount: "15",
        purchaseOrderLineId: "pol-1",
        goodsReceiptLineId: "grl-1",
      },
      base,
    );
    expect(plan).toEqual({
      purchaseOrderLineId: "pol-1",
      goodsReceiptLineId: "grl-1",
      matchedQty: "3",
      matchedAmount: "15",
      lineNumber: 1,
    });
  });

  it("rejects when GR line PO link differs", () => {
    expect(() =>
      planInvoiceLineMatch(
        {
          lineNumber: 1,
          qty: "1",
          unitCost: "5",
          amount: "5",
          purchaseOrderLineId: "pol-1",
          goodsReceiptLineId: "grl-1",
        },
        {
          ...base,
          grLine: { ...base.grLine, purchaseOrderLineId: "pol-other" },
        },
      ),
    ).toThrow(ThreeWayMatchError);
  });

  it("rejects unposted GR", () => {
    expect(() =>
      planInvoiceLineMatch(
        {
          lineNumber: 1,
          qty: "1",
          unitCost: "5",
          amount: "5",
          purchaseOrderLineId: "pol-1",
          goodsReceiptLineId: "grl-1",
        },
        { ...base, gr: { ...base.gr, status: "draft" } },
      ),
    ).toThrow(ThreeWayMatchError);
  });
});

describe("aging", () => {
  it("buckets by days", () => {
    expect(agingBucket(0)).toBe("0-30");
    expect(agingBucket(30)).toBe("0-30");
    expect(agingBucket(31)).toBe("31-60");
    expect(agingBucket(61)).toBe("61-90");
    expect(agingBucket(91)).toBe("90+");
  });

  it("builds report from posted invoices only", () => {
    const report = buildApAgingReport(
      [
        {
          id: "inv-1",
          supplierId: "s1",
          invoiceNumber: "A-1",
          invoiceDate: "2026-06-01",
          status: "posted",
          openBalance: "100",
        },
        {
          id: "inv-2",
          supplierId: "s1",
          invoiceNumber: "A-2",
          invoiceDate: "2026-06-01",
          status: "voided",
          openBalance: "50",
        },
      ],
      "2026-07-15",
    );
    expect(report.invoices).toHaveLength(1);
    expect(report.invoices[0].daysOutstanding).toBe(
      daysBetween("2026-06-01", "2026-07-15"),
    );
    expect(report.grandTotal).toBe("100");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @stock-management/domain test -- src/ap-match.test.ts`  
Expected: FAIL (module / exports missing)

- [ ] **Step 3: Write minimal implementation**

Implement types, entities, errors, `ap-match.ts` helpers, extend `JOURNAL_EVENT_TYPES`, export from `index.ts`.

`planInvoiceLineMatch` must:
1. Require both link ids present (caller guarantees; still throw if empty string)
2. Require `gr.status === "posted"`
3. Require `grLine.purchaseOrderLineId === line.purchaseOrderLineId`
4. `assertExactUnitCost`, `assertLineAmount`
5. Optional: if `line.productId` set, must equal `poLine.productId` and `grLine.productId`
6. `assertRemainingCapacity` for PO (`orderedQty`, `orderedQty*unitCost`) and GR (`qty`, `qty*unitCost`)
7. Return planned match with `matchedQty = line.qty`, `matchedAmount = line.amount`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @stock-management/domain test -- src/ap-match.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "$(cat <<'EOF'
feat(domain): add AP three-way match and aging helpers

EOF
)"
```

---

### Task 2: Schema — supplier_invoices, lines, invoice_matches

**Files:**
- Modify: `apps/api/src/infrastructure/db/schema/index.ts`
- Create: `apps/api/drizzle/0008_phase_d2_ap.sql` (via generate after schema edit; name may differ — keep `phase_d2_ap` in filename when renaming generated migration)

**Interfaces:**
- Consumes: existing `organizations`, `suppliers`, `branches`, `products`, `purchaseOrderLines`, `goodsReceiptLines`
- Produces: Drizzle tables matching entities below

```ts
export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", [
  "draft",
  "posted",
  "voided",
]);

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    branchId: uuid("branch_id").references(() => branches.id),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    status: supplierInvoiceStatusEnum("status").notNull().default("draft"),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_invoices_org_number_uidx").on(
      t.orgId,
      t.invoiceNumber,
    ),
    uniqueIndex("supplier_invoices_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const supplierInvoiceLines = pgTable(
  "supplier_invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id),
    productId: uuid("product_id").references(() => products.id),
    lineNumber: integer("line_number").notNull(),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    purchaseOrderLineId: uuid("purchase_order_line_id")
      .notNull()
      .references(() => purchaseOrderLines.id),
    goodsReceiptLineId: uuid("goods_receipt_line_id")
      .notNull()
      .references(() => goodsReceiptLines.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_invoice_lines_org_doc_line_uidx").on(
      t.orgId,
      t.supplierInvoiceId,
      t.lineNumber,
    ),
  ],
);

export const invoiceMatches = pgTable("invoice_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  supplierInvoiceLineId: uuid("supplier_invoice_line_id")
    .notNull()
    .references(() => supplierInvoiceLines.id),
  purchaseOrderLineId: uuid("purchase_order_line_id")
    .notNull()
    .references(() => purchaseOrderLines.id),
  goodsReceiptLineId: uuid("goods_receipt_line_id")
    .notNull()
    .references(() => goodsReceiptLines.id),
  matchedQty: numeric("matched_qty", { precision: 18, scale: 4 }).notNull(),
  matchedAmount: numeric("matched_amount", {
    precision: 18,
    scale: 4,
  }).notNull(),
  ...timestamps,
});
```

- [ ] **Step 1: Add schema definitions** (no separate unit test — verified by generate + later repo tests)

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter @stock-management/api db:generate`  
Expected: new SQL under `apps/api/drizzle/` creating the three tables + enum. Rename to `0008_phase_d2_ap.sql` if the toolkit uses a different slug (after D1’s `0007_phase_d1_gl.sql`).

- [ ] **Step 3: Apply locally**

Run: `pnpm --filter @stock-management/api db:migrate`  
Expected: migration applies cleanly

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/infrastructure/db/schema/index.ts apps/api/drizzle
git commit -m "$(cat <<'EOF'
feat(api): add supplier invoice and invoice match schema

EOF
)"
```

---

### Task 3: Extend D1 default mappings + ApPort + UoW wiring

**Files:**
- Modify: `packages/application/src/accounting/default-chart.ts` (or wherever D1 put `DEFAULT_MAPPING_SPECS`)
- Create: `packages/application/src/ports/ap.ts`
- Modify: `packages/application/src/ports/unit-of-work.ts` — add `ap?: ApPort`
- Create: `apps/api/src/infrastructure/persistence/ap.repository.ts`
- Modify: `apps/api/src/infrastructure/persistence/unit-of-work.ts` — construct `ap` in TX
- Modify: `packages/application/src/index.ts` — export port
- Test: `packages/application/src/use-cases/ensure-default-chart-of-accounts.test.ts` (extend mapping count)

**Interfaces:**
- Consumes: D1 `AccountingPort`, `DEFAULT_ACCOUNTS`, `EnsureDefaultChartOfAccounts`
- Produces:

```ts
// Append to DEFAULT_MAPPING_SPECS:
{ journalEventType: "supplier_invoice.posted", debitCode: "2100", creditCode: "2000" },
{ journalEventType: "supplier_invoice.voided", debitCode: "2000", creditCode: "2100" },

export type SupplierInvoiceWithLines = SupplierInvoice & {
  lines: SupplierInvoiceLine[];
};

export type CreateSupplierInvoiceInput = {
  supplierId: string;
  branchId?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  externalSystem?: string | null;
  externalId?: string | null;
  lines: Array<{
    productId?: string | null;
    lineNumber: number;
    qty: string;
    unitCost: string;
    amount: string;
    purchaseOrderLineId: string;
    goodsReceiptLineId: string;
  }>;
};

export type UpdateSupplierInvoiceInput = Partial<
  Omit<CreateSupplierInvoiceInput, "lines">
> & {
  lines?: CreateSupplierInvoiceInput["lines"];
};

export interface ApPort {
  list(orgId: string): Promise<SupplierInvoice[]>;
  findById(orgId: string, id: string): Promise<SupplierInvoiceWithLines | null>;

  create(
    orgId: string,
    input: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines>;

  update(
    orgId: string,
    id: string,
    input: UpdateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines>;
  // Only when status === "draft"; replace lines when lines provided

  markPosted(
    orgId: string,
    id: string,
    postedAt: Date,
  ): Promise<SupplierInvoice>;

  markVoided(
    orgId: string,
    id: string,
    voidedAt: Date,
  ): Promise<SupplierInvoice>;

  insertMatches(
    orgId: string,
    matches: Array<Omit<InvoiceMatch, "id"> & { id?: string }>,
  ): Promise<InvoiceMatch[]>;

  listMatchesForPostedInvoicesByPoLine(
    orgId: string,
    purchaseOrderLineId: string,
  ): Promise<InvoiceMatch[]>;
  // JOIN invoice_matches → supplier_invoice_lines → supplier_invoices
  // WHERE invoices.status = 'posted'

  listMatchesForPostedInvoicesByGrLine(
    orgId: string,
    goodsReceiptLineId: string,
  ): Promise<InvoiceMatch[]>;

  sumOpenBalancesByPostedInvoice(
    orgId: string,
  ): Promise<
    Array<{
      invoice: SupplierInvoice;
      openBalance: string; // SUM(lines.amount)
    }>
  >;
}
```

Update `EnsureDefaultChartOfAccounts` test expectation: mappings length increases by **2** (was 16 in D1 → **18**).

- [ ] **Step 1: Write failing test** — extend ensure-defaults test expecting 18 mappings including `supplier_invoice.posted`

```ts
it("seeds supplier_invoice posted/voided mappings", async () => {
  const { port } = makeFakeAccounting();
  const uc = new EnsureDefaultChartOfAccounts(port);
  const result = await uc.execute("org-1");
  expect(result.mappings).toHaveLength(18);
  const posted = await port.findMapping("org-1", "supplier_invoice.posted");
  expect(posted).not.toBeNull();
  const ap = await port.findAccountByCode("org-1", "2000");
  const grni = await port.findAccountByCode("org-1", "2100");
  expect(posted!.debitAccountId).toBe(grni!.id);
  expect(posted!.creditAccountId).toBe(ap!.id);
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/ensure-default-chart-of-accounts.test.ts` — expect FAIL on length/mapping

- [ ] **Step 3: Implement** mapping specs, `ApPort`, Drizzle repo (org-scoped), UoW `ap` wiring

`DrizzleApRepository` notes:
- `create` inserts header + lines in one TX (caller already in UoW TX)
- `update` deletes/reinserts draft lines when `lines` provided
- Match list methods filter `supplier_invoices.status = 'posted'` only
- `sumOpenBalancesByPostedInvoice`: `WHERE status = 'posted'` + `SUM(amount)` group by invoice

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application apps/api/src/infrastructure/persistence
git commit -m "$(cat <<'EOF'
feat(application): add ApPort and supplier invoice GL mappings

EOF
)"
```

---

### Task 4: Draft supplier invoice CRUD use cases

**Files:**
- Create: `packages/application/src/use-cases/supplier-invoices.ts`
- Create: `packages/application/src/use-cases/supplier-invoices.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: `ApPort` (via constructor or UoW — prefer dedicated port injection like landed costs CRUD, not requiring full UoW for draft)
- Produces:

```ts
export class SupplierInvoiceUseCases {
  constructor(private readonly ap: ApPort) {}

  list(orgId: string): Promise<SupplierInvoice[]>;

  get(orgId: string, id: string): Promise<SupplierInvoiceWithLines>;
  // throws NotFoundError

  create(
    orgId: string,
    input: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines>;
  // Validate each line has purchaseOrderLineId + goodsReceiptLineId (non-empty)
  // Validate assertLineAmount for each line
  // Do NOT run full 3-way against PO/GR on draft create (deferred to post)
  // Still reject empty lines array

  update(
    orgId: string,
    id: string,
    input: UpdateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines>;
  // Load; if status !== "draft" throw InvoiceNotDraftError
  // assertLineAmount when lines provided
}
```

- [ ] **Step 1: Write failing tests** with in-memory fake `ApPort`

```ts
it("creates draft invoice with required PO+GR line links", async () => {
  const { ap, uc } = makeSupplierInvoiceHarness();
  const inv = await uc.create("org-1", {
    supplierId: "sup-1",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-07-01",
    lines: [
      {
        lineNumber: 1,
        qty: "2",
        unitCost: "10",
        amount: "20",
        purchaseOrderLineId: "pol-1",
        goodsReceiptLineId: "grl-1",
      },
    ],
  });
  expect(inv.status).toBe("draft");
  expect(inv.lines[0].purchaseOrderLineId).toBe("pol-1");
});

it("rejects update when not draft", async () => {
  const { uc, seedPosted } = makeSupplierInvoiceHarness();
  const id = await seedPosted();
  await expect(
    uc.update("org-1", id, { invoiceNumber: "X" }),
  ).rejects.toBeInstanceOf(InvoiceNotDraftError);
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/supplier-invoices.test.ts` — FAIL

- [ ] **Step 3: Implement use cases**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/use-cases/supplier-invoices.ts packages/application/src/use-cases/supplier-invoices.test.ts packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(application): add supplier invoice draft CRUD use cases

EOF
)"
```

---

### Task 5: PostSupplierInvoice — 3-way validate + sync GRNI/AP journal

**Files:**
- Create: `packages/application/src/use-cases/post-supplier-invoice.ts`
- Create: `packages/application/src/use-cases/post-supplier-invoice.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: `UnitOfWork` (`ctx.ap`, `ctx.accounting`, `ctx.po`, `ctx.gr`, `ctx.idempotency`), domain `planThreeWayMatches` / `planInvoiceLineMatch`, D1 `EnsureDefaultChartOfAccounts`, `assertPeriodOpen`, `assertJournalBalanced`, `moneyAbs`
- Produces:

```ts
const OPERATION = "post-supplier-invoice";

export type PostSupplierInvoiceResult = {
  invoice: SupplierInvoiceWithLines;
  matches: InvoiceMatch[];
  journal: JournalWithLines;
};

export class PostSupplierInvoice {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ensureDefaults: EnsureDefaultChartOfAccounts,
  ) {}

  execute(
    orgId: string,
    userId: string,
    invoiceId: string,
    idempotency?: IdempotencyInput,
  ): Promise<PostSupplierInvoiceResult>;
}
```

**Algorithm (inside `uow.run`):**

1. Idempotency lookup → return cached result if present
2. `ctx.ap.findById` — NotFoundError if missing; `InvoiceNotDraftError` if not draft
3. `await this.ensureDefaults.execute(orgId)` (idempotent CoA + new mappings)
4. For each line, build `MatchLineContext`:
   - `poLine = ctx.po.findLineById`
   - Load GR: find line via `ctx.gr.findById` for the receipt that owns `goodsReceiptLineId` — implement helper on ApPort **or** add `ctx.gr.findLineById(orgId, id)` if missing. **Lock:** add `findLineById` to `GoodsReceiptPort` if not present:

```ts
// packages/application/src/ports/inventory.ts — GoodsReceiptPort
findLineById(orgId: string, id: string): Promise<GoodsReceiptLine | null>;
```

   Implement in GR repository: select line by id+orgId; for `gr` header use `findById` with `grLine.goodsReceiptId`.
5. Aggregates: sum qty/amount from `listMatchesForPostedInvoicesByPoLine` / `ByGrLine`
6. `planThreeWayMatches(lines, resolveContext)` — throws `ThreeWayMatchError` on failure
7. If `gr.supplierId` is non-null, require `invoice.supplierId === gr.supplierId` (else `ThreeWayMatchError`)
8. `insertMatches` for each planned row (generate ids; set `supplierInvoiceLineId` from invoice lines by lineNumber)
9. `markPosted(orgId, id, now)`
10. Resolve mapping `supplier_invoice.posted`; throw `AccountMappingMissingError` if null
11. `findPeriodCoveringDate(orgId, invoice.invoiceDate)`; throw `AccountingPeriodMissingError` if null; `assertPeriodOpen(period)`
12. `total = moneyAbs(sum of line amounts as string via Number())`
13. `insertJournal`:

```ts
{
  entry: {
    orgId,
    periodId: period.id,
    branchId: invoice.branchId,
    sourceDocumentType: "supplier_invoice",
    sourceDocumentId: invoice.id,
    outboxEventId: null,
    reversesJournalId: null,
    postedAt: now,
  },
  lines: [
    { accountId: mapping.debitAccountId, debit: total, credit: "0", lineNo: 1 },
    { accountId: mapping.creditAccountId, debit: "0", credit: total, lineNo: 2 },
  ],
}
```

14. Save idempotency result; return `{ invoice, matches, journal }`

- [ ] **Step 1: Write failing tests** (fake UoW with in-memory ap/accounting/po/gr)

```ts
it("posts with exact 3-way and writes Dr GRNI Cr AP journal", async () => {
  const { uc, seedDraft, accounts } = makePostInvoiceHarness();
  const draftId = await seedDraft({ qty: "2", unitCost: "10", amount: "20" });
  const result = await uc.execute("org-1", "user-1", draftId);
  expect(result.invoice.status).toBe("posted");
  expect(result.matches).toHaveLength(1);
  expect(result.journal.lines[0]).toMatchObject({
    accountId: accounts.grni.id,
    debit: "20",
    credit: "0",
  });
  expect(result.journal.lines[1]).toMatchObject({
    accountId: accounts.ap.id,
    debit: "0",
    credit: "20",
  });
  expect(result.journal.outboxEventId).toBeNull();
  expect(result.journal.sourceDocumentType).toBe("supplier_invoice");
});

it("rejects over-qty vs remaining GR", async () => {
  const { uc, seedDraft } = makePostInvoiceHarness({ grQty: "2", alreadyMatchedGrQty: "2" });
  const draftId = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
  await expect(uc.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
    ThreeWayMatchError,
  );
});

it("rejects unit-cost mismatch", async () => {
  const { uc, seedDraft } = makePostInvoiceHarness({ poUnitCost: "10", grUnitCost: "10" });
  const draftId = await seedDraft({ qty: "1", unitCost: "11", amount: "11" });
  await expect(uc.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
    ThreeWayMatchError,
  );
});

it("rejects when period closed", async () => {
  const { uc, seedDraft, closePeriod } = makePostInvoiceHarness();
  await closePeriod();
  const draftId = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
  await expect(uc.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
    PeriodClosedError,
  );
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/post-supplier-invoice.test.ts` — FAIL

- [ ] **Step 3: Implement** post use case + `GoodsReceiptPort.findLineById` if needed

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application apps/api/src/infrastructure/persistence
git commit -m "$(cat <<'EOF'
feat(application): post supplier invoice with three-way match journal

EOF
)"
```

---

### Task 6: VoidSupplierInvoice — reversing AP journal

**Files:**
- Create: `packages/application/src/use-cases/void-supplier-invoice.ts`
- Create: `packages/application/src/use-cases/void-supplier-invoice.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: `UnitOfWork` (`ap`, `accounting`, `idempotency`), mapping `supplier_invoice.voided`
- Produces:

```ts
const OPERATION = "void-supplier-invoice";

export type VoidSupplierInvoiceResult = {
  invoice: SupplierInvoice;
  reverseJournal: JournalWithLines;
};

export class VoidSupplierInvoice {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ensureDefaults: EnsureDefaultChartOfAccounts,
  ) {}

  execute(
    orgId: string,
    userId: string,
    invoiceId: string,
    idempotency?: IdempotencyInput,
  ): Promise<VoidSupplierInvoiceResult>;
}
```

**Algorithm:**

1. Idempotency lookup
2. Load invoice — NotFound; if `voided` → `InvoiceAlreadyVoidedError`; if not `posted` → `InvoiceNotPostedError`
3. `ensureDefaults.execute(orgId)`
4. `journals = accounting.listJournalsBySourceDocument(orgId, "supplier_invoice", invoiceId)`
5. `forward = journals.find(j => j.reversesJournalId == null)` — if missing, throw `ConflictError("Forward AP journal missing")`
6. If any journal already has `reversesJournalId === forward.id`, treat as already voided journal-side → still ensure invoice marked voided (idempotent) or return existing
7. Mapping `supplier_invoice.voided`; period covering **today** (void date) **or** `invoice.invoiceDate` — **lock: use `invoice.invoiceDate`** so void stays in same period as forward (matches inventory void enrichment spirit); `assertPeriodOpen`
8. Amount = moneyAbs(sum of forward journal debit lines) (or reload Σ invoice line amounts)
9. `insertJournal` with swapped accounts from voided mapping, `reversesJournalId: forward.id`, `outboxEventId: null`
10. `markVoided` — **do not delete** `invoice_matches` rows (historical); remaining-capacity queries ignore voided invoices via status join, so capacity frees automatically
11. Save idempotency; return

- [ ] **Step 1: Write failing tests**

```ts
it("voids posted invoice and reverses AP journal", async () => {
  const { postUc, voidUc, seedDraft, accounts } = makeVoidInvoiceHarness();
  const draftId = await seedDraft({ qty: "2", unitCost: "10", amount: "20" });
  const posted = await postUc.execute("org-1", "user-1", draftId);
  const voided = await voidUc.execute("org-1", "user-1", draftId);
  expect(voided.invoice.status).toBe("voided");
  expect(voided.reverseJournal.reversesJournalId).toBe(posted.journal.id);
  expect(voided.reverseJournal.lines[0]).toMatchObject({
    accountId: accounts.ap.id,
    debit: "20",
    credit: "0",
  });
  expect(voided.reverseJournal.lines[1]).toMatchObject({
    accountId: accounts.grni.id,
    debit: "0",
    credit: "20",
  });
});

it("rejects void of draft", async () => {
  const { voidUc, seedDraft } = makeVoidInvoiceHarness();
  const id = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
  await expect(voidUc.execute("org-1", "user-1", id)).rejects.toBeInstanceOf(
    InvoiceNotPostedError,
  );
});

it("rejects double void", async () => {
  const { postUc, voidUc, seedDraft } = makeVoidInvoiceHarness();
  const id = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
  await postUc.execute("org-1", "user-1", id);
  await voidUc.execute("org-1", "user-1", id);
  await expect(voidUc.execute("org-1", "user-1", id)).rejects.toBeInstanceOf(
    InvoiceAlreadyVoidedError,
  );
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/void-supplier-invoice.test.ts` — FAIL

- [ ] **Step 3: Implement**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/use-cases/void-supplier-invoice.ts packages/application/src/use-cases/void-supplier-invoice.test.ts packages/application/src/index.ts
git commit -m "$(cat <<'EOF'
feat(application): void supplier invoice with reversing AP journal

EOF
)"
```

---

### Task 7: Shared Zod DTOs + HTTP routes + composition root

**Files:**
- Create: `packages/shared/src/ap.ts`
- Modify: `packages/shared/src/index.ts` — export AP schemas
- Create: `apps/api/src/interfaces/http/supplier-invoices.routes.ts`
- Create: `apps/api/src/interfaces/http/supplier-invoices.routes.test.ts`
- Modify: `apps/api/src/main/composition-root.ts`
- Modify: `apps/api/src/index.ts` — register under `/api/v1`

**Interfaces:**
- Produces:

```ts
// packages/shared/src/ap.ts
export const SupplierInvoiceStatusSchema = z.enum(["draft", "posted", "voided"]);

export const SupplierInvoiceLineInputSchema = z.object({
  productId: UuidSchema.nullable().optional(),
  lineNumber: z.number().int().positive(),
  qty: z.string().min(1),
  unitCost: z.string().min(1),
  amount: z.string().min(1),
  purchaseOrderLineId: UuidSchema,
  goodsReceiptLineId: UuidSchema,
});

export const CreateSupplierInvoiceSchema = z.object({
  supplierId: UuidSchema,
  branchId: UuidSchema.nullable().optional(),
  invoiceNumber: z.string().trim().min(1),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  externalSystem: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  lines: z.array(SupplierInvoiceLineInputSchema).min(1),
});

export const UpdateSupplierInvoiceSchema = CreateSupplierInvoiceSchema.partial().extend({
  lines: z.array(SupplierInvoiceLineInputSchema).min(1).optional(),
});

export const SupplierInvoiceIdParamsSchema = z.object({ id: UuidSchema });

// Reuse PostIdempotencySchema + PostIdempotencyHeadersSchema from inventory shared
```

**Routes** (`supplierInvoicesRoutes`):

| Method | Path | Handler |
|--------|------|---------|
| GET | `/supplier-invoices` | list |
| GET | `/supplier-invoices/:id` | get |
| POST | `/supplier-invoices` | create |
| PATCH | `/supplier-invoices/:id` | update (draft only) |
| POST | `/supplier-invoices/:id/post` | post + idempotency body/headers |
| POST | `/supplier-invoices/:id/void` | void + idempotency body/headers |

Map domain errors to HTTP like other document routes (`ThreeWayMatchError` → 422, `InvoiceNotDraftError` / `InvoiceNotPostedError` / `InvoiceAlreadyVoidedError` → 409, `PeriodClosedError` → 409, `NotFoundError` → 404).

Composition root: construct `SupplierInvoiceUseCases(apRepo)`, `PostSupplierInvoice(uow, ensureDefaults)`, `VoidSupplierInvoice(uow, ensureDefaults)`.

- [ ] **Step 1: Write failing route tests** (pattern from `landed-costs` / `goods-receipts.routes.test.ts`)

```ts
it("POST /supplier-invoices/:id/post returns posted invoice", async () => {
  // seed org, supplier, PO line, posted GR line, open period, CoA, draft invoice
  const res = await app.inject({
    method: "POST",
    url: `/api/v1/supplier-invoices/${draftId}/post`,
    headers: { "x-org-id": orgId, "x-user-id": userId },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().invoice.status).toBe("posted");
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/api test -- src/interfaces/http/supplier-invoices.routes.test.ts` — FAIL

- [ ] **Step 3: Implement schemas, routes, wiring**

- [ ] **Step 4: PASS** + `pnpm --filter @stock-management/shared typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/api/src/interfaces/http/supplier-invoices.routes.ts apps/api/src/interfaces/http/supplier-invoices.routes.test.ts apps/api/src/main/composition-root.ts apps/api/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api): add supplier invoice HTTP routes with post and void

EOF
)"
```

---

### Task 8: AP aging report use case + route

**Files:**
- Create: `packages/application/src/use-cases/ap-aging.ts`
- Create: `packages/application/src/use-cases/ap-aging.test.ts`
- Create: `apps/api/src/interfaces/http/ap-reports.routes.ts`
- Create: `apps/api/src/interfaces/http/ap-reports.routes.test.ts`
- Modify: `packages/shared/src/ap.ts` — `ApAgingQuerySchema`
- Modify: composition root + `index.ts` route register
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Produces:

```ts
export class ApAgingReportUseCase {
  constructor(private readonly ap: ApPort) {}

  async execute(orgId: string, asOf: string): Promise<ApAgingReport> {
    const rows = await this.ap.sumOpenBalancesByPostedInvoice(orgId);
    return buildApAgingReport(
      rows.map(({ invoice, openBalance }) => ({
        id: invoice.id,
        supplierId: invoice.supplierId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        openBalance,
      })),
      asOf,
    );
  }
}

// shared
export const ApAgingQuerySchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Route:** `GET /api/v1/reports/ap-aging?asOf=YYYY-MM-DD`

- [ ] **Step 1: Write failing application + route tests**

```ts
it("ages entire posted balance into buckets", async () => {
  const { uc, seedPostedInvoice } = makeAgingHarness();
  await seedPostedInvoice({
    invoiceDate: "2026-01-01",
    amount: "40",
  });
  await seedPostedInvoice({
    invoiceDate: "2026-06-20",
    amount: "10",
  });
  const report = await uc.execute("org-1", "2026-07-15");
  expect(report.grandTotal).toBe("50");
  expect(Number(report.totalsByBucket["90+"])).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/ap-aging.test.ts` — FAIL

- [ ] **Step 3: Implement use case + HTTP**

- [ ] **Step 4: PASS** both application and `pnpm --filter @stock-management/api test -- src/interfaces/http/ap-reports.routes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/use-cases/ap-aging.ts packages/application/src/use-cases/ap-aging.test.ts packages/shared/src/ap.ts apps/api/src/interfaces/http/ap-reports.routes.ts apps/api/src/interfaces/http/ap-reports.routes.test.ts apps/api/src/main/composition-root.ts apps/api/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api): add AP aging report use case and route

EOF
)"
```

---

### Task 9: End-to-end application coverage checklist tests

**Files:**
- Create or extend: `packages/application/src/use-cases/supplier-invoice-three-way.integration.test.ts`

**Interfaces:**
- Consumes: harness combining Tasks 5–6 scenarios in one file for DoD evidence

Required cases (must all pass):

| Case | Expectation |
|------|-------------|
| Happy 3-way | Post succeeds; match row; journal Dr GRNI Cr AP |
| Over-qty | Second invoice exceeding GR remaining → `ThreeWayMatchError` |
| Cost mismatch | Invoice unitCost ≠ PO/GR → reject |
| Void reverses | Reverse journal linked; invoice `voided`; capacity freed for new draft post |
| Idempotent post | Same external keys return same journal id |

```ts
describe("supplier invoice three-way DoD", () => {
  it("happy path posts match journal", async () => { /* ... */ });
  it("rejects over-qty against remaining GR", async () => { /* ... */ });
  it("rejects cost mismatch", async () => { /* ... */ });
  it("void reverses AP journal and frees capacity", async () => {
    // post inv-1 matching full GR qty → void → post inv-2 same links succeeds
  });
  it("post is idempotent on external_system+external_id", async () => {
    const a = await post.execute("org-1", "u", id, {
      externalSystem: "pos",
      externalId: "bill-1",
    });
    const b = await post.execute("org-1", "u", id, {
      externalSystem: "pos",
      externalId: "bill-1",
    });
    expect(b.journal.id).toBe(a.journal.id);
  });
});
```

- [ ] **Step 1: Write the five failing DoD tests** in `supplier-invoice-three-way.integration.test.ts` (full bodies as table above; do not omit cases even if Tasks 5–6 overlap)

- [ ] **Step 2: Run** `pnpm --filter @stock-management/application test -- src/use-cases/supplier-invoice-three-way.integration.test.ts`  
Expected: FAIL until harness wired, or PASS if Tasks 5–6 already satisfy — still keep the file as DoD evidence

- [ ] **Step 3: Implement/fix harness** until all five cases green

- [ ] **Step 4: Run broader check**

Run: `pnpm --filter @stock-management/domain test && pnpm --filter @stock-management/application test && pnpm --filter @stock-management/api test -- src/interfaces/http/supplier-invoices.routes.test.ts src/interfaces/http/ap-reports.routes.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/use-cases/supplier-invoice-three-way.integration.test.ts
git commit -m "$(cat <<'EOF'
test(application): cover supplier invoice three-way DoD scenarios

EOF
)"
```

---

### Task 10: Wiki / FEATURES touch after D2 ship

**Files:**
- Modify: `wiki/features/Phase D.md` (or equivalent) — note D2 AP/3-way/aging API shipped; journals sync in invoice UoW
- Modify: `wiki/concepts/Inventory Accounting.md` — invoice match journal + aging buckets
- Modify: `wiki/index.md`, `wiki/log.md` — append ingest/update entry dated implementation day
- Modify: `docs/FEATURES.md` Phase D rows for supplier invoices / 3-way / AP aging when code lands
- Modify: `docs/superpowers/plans/2026-07-26-phase-d-accounting.md` — mark D2 checkbox when done

**Interfaces:** None (docs only)

- [ ] **Step 1: Read** `wiki/index.md` + affected pages (`wiki/AGENTS.md` / obsidian-markdown)

- [ ] **Step 2: Update** pages with D2 facts (required PO+GR links; sync AccountingPort journal; aging = full posted balance)

- [ ] **Step 3: Append** `wiki/log.md`:

```markdown
## [YYYY-MM-DD] update | Phase D2 AP three-way shipped
```

- [ ] **Step 4: Commit**

```bash
git add wiki docs/FEATURES.md docs/superpowers/plans/2026-07-26-phase-d-accounting.md
git commit -m "$(cat <<'EOF'
docs(wiki): record Phase D2 AP three-way match delivery

EOF
)"
```

---

## Definition of done (D2)

- [ ] Domain match + aging helpers tested
- [ ] Schema + migration for invoices / lines / matches
- [ ] `ApPort` + draft CRUD
- [ ] Post: exact 3-way; sync Dr GRNI Cr AP via `AccountingPort.insertJournal` in same UoW
- [ ] Void: reversing journal; matches retained; capacity freed via posted-only sums
- [ ] HTTP `/api/v1/supplier-invoices` + post/void idempotency
- [ ] `GET /api/v1/reports/ap-aging`
- [ ] Tests: happy 3-way; over-qty; cost mismatch; void reverse
- [ ] D1 poller / CoA seed path extended with invoice mappings only — no inventory UoW changes
- [ ] Wiki + FEATURES updated after ship

## Self-review (plan author)

1. **Spec coverage:** Design D2 items (SupplierInvoice, lines, InvoiceMatch, exact 3-way, GRNI→AP, aging buckets, no payments) map to Tasks 1–8; DoD tests Task 9; wiki Task 10.
2. **Task 1 deferred wording locked:** required PO+GR ids; exact qty/unit-cost; remaining unmatched; aging = entire posted balance with 0–30 / 31–60 / 61–90 / 90+.
3. **Journal approach locked:** sync `AccountingPort` in invoice UoW (not outbox enqueue).
4. **D1 names consumed:** `AccountingPort.insertJournal`, `findMapping`, `findPeriodCoveringDate`, `listJournalsBySourceDocument`, `EnsureDefaultChartOfAccounts`, `assertPeriodOpen`, `assertJournalBalanced`, `moneyAbs`, accounts `2000`/`2100`.
5. **Placeholders:** none — concrete types, algorithms, commands, commits.
