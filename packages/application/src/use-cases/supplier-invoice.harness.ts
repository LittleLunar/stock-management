import { randomUUID } from "node:crypto";
import type {
  ApPort,
  CreateSupplierInvoiceInput,
  SupplierInvoiceWithLines,
} from "../ports/ap.js";
import type {
  IdempotencyRecord,
  GoodsReceiptWithLines,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { makeFakeAccounting } from "../accounting/fake-accounting.js";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";
import { PostSupplierInvoice } from "./post-supplier-invoice.js";
import { VoidSupplierInvoice } from "./void-supplier-invoice.js";
import type {
  GoodsReceipt,
  GoodsReceiptLine,
  InvoiceMatch,
  PurchaseOrderLine,
  SupplierInvoice,
} from "@stock-management/domain";

const ORG_ID = "org-1";
const now = new Date("2026-07-26T00:00:00.000Z");

export type HarnessOptions = {
  grQty?: string;
  poOrderedQty?: string;
  poUnitCost?: string;
  grUnitCost?: string;
  purchaseOrderLineId?: string;
  goodsReceiptLineId?: string;
  goodsReceiptId?: string;
  alreadyMatchedGrQty?: string;
  alreadyMatchedGrAmount?: string;
  alreadyMatchedPoQty?: string;
  alreadyMatchedPoAmount?: string;
  periodClosed?: boolean;
};

export function makeThreeWayDodHarness(options: HarnessOptions = {}) {
  const poLineId = options.purchaseOrderLineId ?? "pol-1";
  const grLineId = options.goodsReceiptLineId ?? "grl-1";
  const grId = options.goodsReceiptId ?? "gr-1";
  const poUnitCost = options.poUnitCost ?? "10";
  const grUnitCost = options.grUnitCost ?? "10";
  const grQty = options.grQty ?? "5";
  const poOrderedQty = options.poOrderedQty ?? "10";

  const poLine: PurchaseOrderLine = {
    id: poLineId,
    orgId: ORG_ID,
    purchaseOrderId: "po-1",
    productId: "p1",
    orderedQty: poOrderedQty,
    receivedQty: "0",
    unitCost: poUnitCost,
    lineNumber: 1,
  };

  const grLine: GoodsReceiptLine = {
    id: grLineId,
    orgId: ORG_ID,
    goodsReceiptId: grId,
    productId: "p1",
    purchaseOrderLineId: poLineId,
    qty: grQty,
    unitCost: grUnitCost,
    lotId: null,
    lineNumber: 1,
  };

  const grHeader: GoodsReceipt = {
    id: grId,
    orgId: ORG_ID,
    purchaseOrderId: "po-1",
    supplierId: "sup-1",
    branchId: "branch-1",
    locationId: "loc-1",
    status: "posted",
    postedAt: now,
    voidedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const grWithLines: GoodsReceiptWithLines = {
    ...grHeader,
    lines: [
      {
        ...grLine,
        lotCode: null,
        expiryDate: null,
        serialNumbers: [],
      },
    ],
  };

  const invoices = new Map<string, SupplierInvoiceWithLines>();
  const matches: InvoiceMatch[] = [];
  const idempotency = new Map<string, IdempotencyRecord>();

  const ap: ApPort = {
    async list(orgId) {
      return [...invoices.values()].filter((i) => i.orgId === orgId);
    },
    async findById(orgId, id) {
      const invoice = invoices.get(id);
      return invoice?.orgId === orgId ? invoice : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const invoice: SupplierInvoiceWithLines = {
        id,
        orgId,
        supplierId: input.supplierId,
        branchId: input.branchId ?? null,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate ?? null,
        status: "draft",
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
        postedAt: null,
        voidedAt: null,
        createdAt: now,
        updatedAt: now,
        lines: input.lines.map((line) => ({
          id: randomUUID(),
          orgId,
          supplierInvoiceId: id,
          productId: line.productId ?? null,
          lineNumber: line.lineNumber,
          qty: line.qty,
          unitCost: line.unitCost,
          amount: line.amount,
          purchaseOrderLineId: line.purchaseOrderLineId,
          goodsReceiptLineId: line.goodsReceiptLineId,
        })),
      };
      invoices.set(id, invoice);
      return invoice;
    },
    async update(orgId, id, input) {
      const current = await ap.findById(orgId, id);
      if (!current) throw new Error("not found");
      const updated: SupplierInvoiceWithLines = {
        ...current,
        ...input,
        lines: input.lines
          ? input.lines.map((line) => ({
              id: randomUUID(),
              orgId,
              supplierInvoiceId: id,
              productId: line.productId ?? null,
              lineNumber: line.lineNumber,
              qty: line.qty,
              unitCost: line.unitCost,
              amount: line.amount,
              purchaseOrderLineId: line.purchaseOrderLineId,
              goodsReceiptLineId: line.goodsReceiptLineId,
            }))
          : current.lines,
        updatedAt: now,
      };
      invoices.set(id, updated);
      return updated;
    },
    async markPosted(orgId, id, postedAt) {
      const invoice = await ap.findById(orgId, id);
      if (!invoice) throw new Error("not found");
      const posted: SupplierInvoiceWithLines = {
        ...invoice,
        status: "posted",
        postedAt,
        updatedAt: postedAt,
      };
      invoices.set(id, posted);
      return posted;
    },
    async markVoided(orgId, id, voidedAt) {
      const invoice = await ap.findById(orgId, id);
      if (!invoice) throw new Error("not found");
      const voided: SupplierInvoiceWithLines = {
        ...invoice,
        status: "voided",
        voidedAt,
        updatedAt: voidedAt,
      };
      invoices.set(id, voided);
      return voided;
    },
    async insertMatches(orgId, rows) {
      const inserted = rows.map((row) => ({
        id: row.id ?? randomUUID(),
        orgId,
        supplierInvoiceLineId: row.supplierInvoiceLineId,
        purchaseOrderLineId: row.purchaseOrderLineId,
        goodsReceiptLineId: row.goodsReceiptLineId,
        matchedQty: row.matchedQty,
        matchedAmount: row.matchedAmount,
      }));
      matches.push(...inserted);
      return inserted;
    },
    async listMatchesForPostedInvoicesByPoLine(orgId, purchaseOrderLineId) {
      return matches.filter(
        (m) =>
          m.orgId === orgId &&
          m.purchaseOrderLineId === purchaseOrderLineId &&
          [...invoices.values()].some(
            (inv) =>
              inv.status === "posted" &&
              inv.lines.some((line) => line.id === m.supplierInvoiceLineId),
          ),
      );
    },
    async listMatchesForPostedInvoicesByGrLine(orgId, goodsReceiptLineId) {
      return matches.filter(
        (m) =>
          m.orgId === orgId &&
          m.goodsReceiptLineId === goodsReceiptLineId &&
          [...invoices.values()].some(
            (inv) =>
              inv.status === "posted" &&
              inv.lines.some((line) => line.id === m.supplierInvoiceLineId),
          ),
      );
    },
    async sumOpenBalancesByPostedInvoice(orgId) {
      return [...invoices.values()]
        .filter((inv) => inv.orgId === orgId && inv.status === "posted")
        .map((invoice) => ({
          invoice: invoice as SupplierInvoice,
          openBalance: String(
            invoice.lines.reduce((sum, line) => sum + Number(line.amount), 0),
          ),
        }));
    },
  };

  const { port: accounting } = makeFakeAccounting();
  const ensureDefaults = new EnsureDefaultChartOfAccounts(accounting);

  const ctx: UowContext = {
    po: {
      async list() {
        return [];
      },
      async findById() {
        return null;
      },
      async findLineById(orgId, id) {
        return orgId === ORG_ID && id === poLineId ? poLine : null;
      },
      async create() {
        throw new Error("not implemented");
      },
      async update() {
        return null;
      },
      async updateLineReceivedQty() {
        return poLine;
      },
      async updateStatus() {
        return { ...poLine, purchaseOrderId: "po-1" } as never;
      },
    },
    gr: {
      async list() {
        return [grHeader];
      },
      async findById(orgId, id) {
        return orgId === ORG_ID && id === grId ? grWithLines : null;
      },
      async findLineById(orgId, id) {
        return orgId === ORG_ID && id === grLineId ? grLine : null;
      },
      async create() {
        return grWithLines;
      },
      async update() {
        return grWithLines;
      },
      async updateStatus() {
        return grHeader;
      },
      async setLineLotId() {},
    },
    products: {
      async findById() {
        return null;
      },
      async list() {
        return [];
      },
    },
    stock: {} as UowContext["stock"],
    lots: {} as UowContext["lots"],
    serials: {} as UowContext["serials"],
    costing: {} as UowContext["costing"],
    outbox: {
      async enqueue() {
        return { id: randomUUID() };
      },
    },
    idempotency: {
      async find(orgId, operation, externalSystem, externalId) {
        return (
          idempotency.get(`${orgId}:${operation}:${externalSystem}:${externalId}`) ??
          null
        );
      },
      async save(record) {
        idempotency.set(
          `${record.orgId}:${record.operation}:${record.externalSystem}:${record.externalId}`,
          record,
        );
      },
    },
    ap,
    accounting,
  };

  const uow: UnitOfWork = {
    run(fn) {
      return fn(ctx);
    },
  };

  async function ensurePeriodForDate(onDate: string, status: "open" | "closed" = "open") {
    const existing = await accounting.findPeriodCoveringDate(ORG_ID, onDate);
    if (existing) {
      if (status === "closed" && existing.status !== "closed") {
        await accounting.setPeriodStatus(ORG_ID, existing.id, "closed");
      }
      return existing;
    }
    return accounting.insertPeriod({
      orgId: ORG_ID,
      year: 2026,
      month: 1,
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      status,
    });
  }

  async function seedDefaults() {
    const seeded = await ensureDefaults.execute(ORG_ID);
    await ensurePeriodForDate(
      "2026-07-15",
      options.periodClosed ? "closed" : "open",
    );
    return seeded;
  }

  async function seedDraft(input: {
    invoiceNumber?: string;
    qty: string;
    unitCost: string;
    amount: string;
    invoiceDate?: string;
    purchaseOrderLineId?: string;
    goodsReceiptLineId?: string;
  }) {
    await seedDefaults();
    const invoiceDate = input.invoiceDate ?? "2026-07-15";
    await ensurePeriodForDate(
      invoiceDate,
      options.periodClosed ? "closed" : "open",
    );
    const invoice = await ap.create(ORG_ID, {
      supplierId: "sup-1",
      invoiceNumber: input.invoiceNumber ?? "INV-DRAFT",
      invoiceDate,
      lines: [
        {
          lineNumber: 1,
          qty: input.qty,
          unitCost: input.unitCost,
          amount: input.amount,
          purchaseOrderLineId: input.purchaseOrderLineId ?? poLineId,
          goodsReceiptLineId: input.goodsReceiptLineId ?? grLineId,
        },
      ],
    });
    return invoice.id;
  }

  async function seedPostedMatch(input: {
    grLineId: string;
    poLineId: string;
    matchedQty: string;
    matchedAmount: string;
  }) {
    await ensurePeriodForDate("2026-07-01");
    const postedInvoice = await ap.create(ORG_ID, {
      supplierId: "sup-1",
      invoiceNumber: `INV-POSTED-${randomUUID()}`,
      invoiceDate: "2026-07-01",
      lines: [
        {
          lineNumber: 1,
          qty: input.matchedQty,
          unitCost: "10",
          amount: input.matchedAmount,
          purchaseOrderLineId: input.poLineId,
          goodsReceiptLineId: input.grLineId,
        },
      ],
    });
    await ap.markPosted(ORG_ID, postedInvoice.id, now);
    await ap.insertMatches(ORG_ID, [
      {
        orgId: ORG_ID,
        supplierInvoiceLineId: postedInvoice.lines[0]!.id,
        purchaseOrderLineId: input.poLineId,
        goodsReceiptLineId: input.grLineId,
        matchedQty: input.matchedQty,
        matchedAmount: input.matchedAmount,
      },
    ]);
  }

  if (options.alreadyMatchedGrQty) {
    // Callers pre-seed via seedPostedMatch when needed.
  }

  const post = new PostSupplierInvoice(uow, ensureDefaults);
  const voidInvoice = new VoidSupplierInvoice(uow, ensureDefaults);

  return {
    ORG_ID,
    ap,
    accounting,
    post,
    voidInvoice,
    seedDraft,
    seedPostedMatch,
    closePeriod: async () => {
      const period = await accounting.findPeriodCoveringDate(ORG_ID, "2026-07-15");
      if (period) await accounting.setPeriodStatus(ORG_ID, period.id, "closed");
    },
    accounts: async () => {
      const seeded = await seedDefaults();
      const apAccount = seeded.accounts.find((a) => a.code === "2000")!;
      const grni = seeded.accounts.find((a) => a.code === "2100")!;
      return { ap: apAccount, grni };
    },
  };
}

export async function makeSupplierInvoiceHarness() {
  const harness = makeThreeWayDodHarness();
  const { SupplierInvoiceUseCases } = await import("./supplier-invoices.js");
  const uc = new SupplierInvoiceUseCases(harness.ap);

  async function seedPosted() {
    const id = await harness.seedDraft({
      qty: "1",
      unitCost: "10",
      amount: "10",
    });
    await harness.post.execute(ORG_ID, "user-1", id);
    return id;
  }

  return { ap: harness.ap, uc, seedPosted };
}

export async function makeAgingHarness() {
  const harness = makeThreeWayDodHarness();
  const { ApAgingReportUseCase } = await import("./ap-aging.js");
  const uc = new ApAgingReportUseCase(harness.ap);

  async function seedPostedInvoice(input: {
    invoiceDate: string;
    amount: string;
    invoiceNumber?: string;
  }) {
    const unitCost = "10";
    const qty = String(Number(input.amount) / Number(unitCost));
    const id = await harness.seedDraft({
      invoiceNumber: input.invoiceNumber ?? randomUUID(),
      qty,
      unitCost,
      amount: input.amount,
      invoiceDate: input.invoiceDate,
    });
    await harness.post.execute(ORG_ID, "user-1", id);
  }

  return { uc, seedPostedInvoice };
}

export type SeedDraftInput = Parameters<
  ReturnType<typeof makeThreeWayDodHarness>["seedDraft"]
>[0];

export type CreateInvoiceLine = CreateSupplierInvoiceInput["lines"][number];
