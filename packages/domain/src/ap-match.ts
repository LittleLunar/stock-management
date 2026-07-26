import type {
  GoodsReceipt,
  GoodsReceiptLine,
  PurchaseOrderLine,
} from "./entities.js";
import type { SupplierInvoiceStatus } from "./types.js";
import { ThreeWayMatchError } from "./errors.js";

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
  poLine: Pick<
    PurchaseOrderLine,
    "id" | "orderedQty" | "unitCost" | "productId" | "purchaseOrderId"
  >;
  grLine: Pick<
    GoodsReceiptLine,
    | "id"
    | "qty"
    | "unitCost"
    | "productId"
    | "purchaseOrderLineId"
    | "goodsReceiptId"
  >;
  gr: Pick<GoodsReceipt, "id" | "status" | "supplierId">;
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

export function assertRemainingCapacity(
  capacityQty: string,
  capacityAmount: string,
  alreadyMatchedQty: string,
  alreadyMatchedAmount: string,
  requestQty: string,
  requestAmount: string,
  label: string,
): void {
  const remQty = Number(capacityQty) - Number(alreadyMatchedQty);
  const remAmt = Number(capacityAmount) - Number(alreadyMatchedAmount);
  if (Number(requestQty) > remQty + 1e-9) {
    throw new ThreeWayMatchError(
      `${label} remaining qty ${remQty} cannot cover ${requestQty}`,
    );
  }
  if (Number(requestAmount) > remAmt + 1e-9) {
    throw new ThreeWayMatchError(
      `${label} remaining amount ${remAmt} cannot cover ${requestAmount}`,
    );
  }
}

export function assertExactUnitCost(
  invoiceUnitCost: string,
  poUnitCost: string | null,
  grUnitCost: string | null,
): void {
  if (poUnitCost == null || grUnitCost == null) {
    throw new ThreeWayMatchError("PO and GR unit cost are required for match");
  }
  if (
    Number(invoiceUnitCost) !== Number(poUnitCost) ||
    Number(invoiceUnitCost) !== Number(grUnitCost)
  ) {
    throw new ThreeWayMatchError(
      `Unit cost mismatch invoice=${invoiceUnitCost} po=${poUnitCost} gr=${grUnitCost}`,
    );
  }
}

export function assertLineAmount(
  qty: string,
  unitCost: string,
  amount: string,
): void {
  const expected = Number(qty) * Number(unitCost);
  if (Number(amount) !== expected) {
    throw new ThreeWayMatchError(
      `Line amount ${amount} must equal qty*unitCost ${expected}`,
    );
  }
}

export function planInvoiceLineMatch(
  line: MatchLineInput,
  ctx: MatchLineContext,
): PlannedInvoiceMatch {
  if (ctx.gr.status !== "posted") {
    throw new ThreeWayMatchError("Goods receipt must be posted");
  }
  if (ctx.grLine.purchaseOrderLineId !== line.purchaseOrderLineId) {
    throw new ThreeWayMatchError(
      "GR line purchaseOrderLineId must match invoice line",
    );
  }
  if (ctx.poLine.id !== line.purchaseOrderLineId) {
    throw new ThreeWayMatchError("PO line id mismatch");
  }
  if (ctx.grLine.id !== line.goodsReceiptLineId) {
    throw new ThreeWayMatchError("GR line id mismatch");
  }
  assertExactUnitCost(line.unitCost, ctx.poLine.unitCost, ctx.grLine.unitCost);
  assertLineAmount(line.qty, line.unitCost, line.amount);

  const poCapacityAmount = String(
    Number(ctx.poLine.orderedQty) * Number(ctx.poLine.unitCost),
  );
  const grCapacityAmount = String(
    Number(ctx.grLine.qty) * Number(ctx.grLine.unitCost ?? 0),
  );

  assertRemainingCapacity(
    ctx.poLine.orderedQty,
    poCapacityAmount,
    ctx.matchedOnPo.qty,
    ctx.matchedOnPo.amount,
    line.qty,
    line.amount,
    "PO line",
  );
  assertRemainingCapacity(
    ctx.grLine.qty,
    grCapacityAmount,
    ctx.matchedOnGr.qty,
    ctx.matchedOnGr.amount,
    line.qty,
    line.amount,
    "GR line",
  );

  return {
    purchaseOrderLineId: line.purchaseOrderLineId,
    goodsReceiptLineId: line.goodsReceiptLineId,
    matchedQty: line.qty,
    matchedAmount: line.amount,
    lineNumber: line.lineNumber,
  };
}

export function planThreeWayMatches(
  lines: MatchLineInput[],
  resolveContext: (line: MatchLineInput) => MatchLineContext,
): PlannedInvoiceMatch[] {
  const poSeen = new Set<string>();
  const grSeen = new Set<string>();
  for (const line of lines) {
    if (poSeen.has(line.purchaseOrderLineId)) {
      throw new ThreeWayMatchError(
        `Duplicate purchaseOrderLineId ${line.purchaseOrderLineId} on invoice`,
      );
    }
    if (grSeen.has(line.goodsReceiptLineId)) {
      throw new ThreeWayMatchError(
        `Duplicate goodsReceiptLineId ${line.goodsReceiptLineId} on invoice`,
      );
    }
    poSeen.add(line.purchaseOrderLineId);
    grSeen.add(line.goodsReceiptLineId);
  }

  const runningPo = new Map<string, { qty: number; amount: number }>();
  const runningGr = new Map<string, { qty: number; amount: number }>();
  const plans: PlannedInvoiceMatch[] = [];

  const sorted = [...lines].sort((a, b) => a.lineNumber - b.lineNumber);
  for (const line of sorted) {
    const ctx = resolveContext(line);
    const poExtra = runningPo.get(line.purchaseOrderLineId) ?? {
      qty: 0,
      amount: 0,
    };
    const grExtra = runningGr.get(line.goodsReceiptLineId) ?? {
      qty: 0,
      amount: 0,
    };
    const plan = planInvoiceLineMatch(line, {
      ...ctx,
      matchedOnPo: {
        qty: String(Number(ctx.matchedOnPo.qty) + poExtra.qty),
        amount: String(Number(ctx.matchedOnPo.amount) + poExtra.amount),
      },
      matchedOnGr: {
        qty: String(Number(ctx.matchedOnGr.qty) + grExtra.qty),
        amount: String(Number(ctx.matchedOnGr.amount) + grExtra.amount),
      },
    });
    plans.push(plan);
    runningPo.set(line.purchaseOrderLineId, {
      qty: poExtra.qty + Number(plan.matchedQty),
      amount: poExtra.amount + Number(plan.matchedAmount),
    });
    runningGr.set(line.goodsReceiptLineId, {
      qty: grExtra.qty + Number(plan.matchedQty),
      amount: grExtra.amount + Number(plan.matchedAmount),
    });
  }
  return plans;
}

export type AgingBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export function daysBetween(invoiceDate: string, asOf: string): number {
  const [iy, im, id] = invoiceDate.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  const invMs = Date.UTC(iy!, im! - 1, id!);
  const asOfMs = Date.UTC(ay!, am! - 1, ad!);
  return Math.max(0, Math.floor((asOfMs - invMs) / 86_400_000));
}

export function agingBucket(daysOutstanding: number): AgingBucketKey {
  if (daysOutstanding <= 30) return "0-30";
  if (daysOutstanding <= 60) return "31-60";
  if (daysOutstanding <= 90) return "61-90";
  return "90+";
}

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
): ApAgingReport {
  const totalsByBucket: Record<AgingBucketKey, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  const rows: ApAgingInvoiceRow[] = [];
  for (const inv of invoices) {
    if (inv.status !== "posted") continue;
    const daysOutstanding = daysBetween(inv.invoiceDate, asOf);
    const bucket = agingBucket(daysOutstanding);
    const bal = Number(inv.openBalance);
    totalsByBucket[bucket] += bal;
    rows.push({
      invoiceId: inv.id,
      supplierId: inv.supplierId,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      openBalance: inv.openBalance,
      daysOutstanding,
      bucket,
    });
  }
  const grandTotal = Object.values(totalsByBucket).reduce((a, b) => a + b, 0);
  return {
    asOf,
    totalsByBucket: {
      "0-30": String(totalsByBucket["0-30"]),
      "31-60": String(totalsByBucket["31-60"]),
      "61-90": String(totalsByBucket["61-90"]),
      "90+": String(totalsByBucket["90+"]),
    },
    grandTotal: String(grandTotal),
    invoices: rows,
  };
}
