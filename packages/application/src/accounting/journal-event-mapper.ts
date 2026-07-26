import type { JournalEventType } from "@stock-management/domain";
import { voidEventType } from "@stock-management/domain";

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

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.trim()) return null;
  return value;
}

function moneyField(payload: Record<string, unknown>, key: string): string | null {
  const raw = payload[key];
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return null;
  return String(raw);
}

function branchIdFromPayload(payload: Record<string, unknown>): string | null {
  const v = payload.branchId;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function postedAtFromPayload(payload: Record<string, unknown>): Date {
  const raw = payload.postedAt;
  if (typeof raw === "string" && raw.length > 0) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function resolvePostedType(
  aggregateType: string,
  payload: Record<string, unknown>,
): { type: JournalEventType; amount: string } | null {
  switch (aggregateType) {
    case "goods_receipt": {
      const amount = moneyField(payload, "inventoryValueDelta");
      if (!amount) return null;
      return { type: "goods_receipt.posted", amount };
    }
    case "stock_issue": {
      const amount = moneyField(payload, "cogsTotal");
      if (!amount) return null;
      return { type: "stock_issue.posted", amount };
    }
    case "supplier_return": {
      const amount = moneyField(payload, "cogsTotal");
      if (!amount) return null;
      return { type: "supplier_return.posted", amount };
    }
    case "stock_adjustment":
    case "stock_count": {
      const cogs = moneyField(payload, "cogsTotal");
      if (cogs) return { type: "inventory_decrease.posted", amount: cogs };
      const inv = moneyField(payload, "inventoryValueDelta");
      if (inv) return { type: "inventory_increase.posted", amount: inv };
      return null;
    }
    case "customer_return": {
      const amount = moneyField(payload, "inventoryValueDelta");
      if (!amount) return null;
      return { type: "inventory_increase.posted", amount };
    }
    case "landed_cost": {
      const amount = moneyField(payload, "landedAmount");
      if (!amount) return null;
      return { type: "landed_cost.posted", amount };
    }
    case "cost_revaluation": {
      const amount = moneyField(payload, "revaluationValueDelta");
      if (!amount) return null;
      const n = Number(amount);
      if (n >= 0) {
        return { type: "cost_revaluation.increase", amount };
      }
      return {
        type: "cost_revaluation.decrease",
        amount: String(Math.abs(n)),
      };
    }
    default:
      return null;
  }
}

export function mapOutboxEventToJournalPlan(event: OutboxLike): JournalPlan {
  if (event.eventType === "stock.changed") {
    return { kind: "skip", reason: "stock.changed has no GL" };
  }
  if (
    event.eventType !== "document.posted" &&
    event.eventType !== "document.voided"
  ) {
    return { kind: "skip", reason: `unsupported eventType ${event.eventType}` };
  }
  if (event.aggregateType === "stock_transfer") {
    return { kind: "skip", reason: "transfers have no money GL in D1" };
  }

  const resolved = resolvePostedType(event.aggregateType, event.payload);
  if (!resolved) {
    return { kind: "skip", reason: "missing or zero money fields" };
  }

  const isVoid = event.eventType === "document.voided";
  const journalEventType = isVoid
    ? voidEventType(resolved.type)
    : resolved.type;

  const sourceDocumentId =
    asNonEmptyString(event.payload.receiptId) ??
    asNonEmptyString(event.payload.issueId) ??
    asNonEmptyString(event.payload.adjustmentId) ??
    asNonEmptyString(event.payload.countId) ??
    asNonEmptyString(event.payload.returnId) ??
    asNonEmptyString(event.payload.landedCostId) ??
    asNonEmptyString(event.payload.revaluationId) ??
    event.aggregateId;

  return {
    kind: "create",
    journalEventType,
    amount: resolved.amount,
    sourceDocumentType: event.aggregateType,
    sourceDocumentId,
    branchId: branchIdFromPayload(event.payload),
    postedAt: postedAtFromPayload(event.payload),
    isVoid,
  };
}
