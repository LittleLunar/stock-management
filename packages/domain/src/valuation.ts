import { AllocationMismatchError, InvalidStateError } from "./errors.js";

export function allocateLandedUnitCost(
  qtyRemaining: string,
  oldUnitCost: string,
  allocatedAmount: string,
): { newUnitCost: string; valueDelta: string } {
  const qty = Number(qtyRemaining);
  if (qty <= 0) {
    throw new InvalidStateError("Quantity remaining must be positive");
  }
  const oldCost = Number(oldUnitCost);
  const amount = Number(allocatedAmount);
  const newUnitCost = String((qty * oldCost + amount) / qty);
  const valueDelta = String(qty * (Number(newUnitCost) - oldCost));
  return { newUnitCost, valueDelta };
}

export function revaluationValueDelta(
  qtyRemaining: string,
  oldUnitCost: string,
  newUnitCost: string,
): string {
  const qty = Number(qtyRemaining);
  return String(qty * (Number(newUnitCost) - Number(oldUnitCost)));
}

export function netConsumedQty(
  consumptions: ReadonlyArray<{ qty: string; isReversal: boolean; createdAt: Date }>,
  asOf: Date,
): string {
  let net = 0;
  for (const consumption of consumptions) {
    if (consumption.createdAt > asOf) continue;
    const qty = Number(consumption.qty);
    net += consumption.isReversal ? -qty : qty;
  }
  return String(net);
}

export function unitCostAtAsOf(
  originalUnitCost: string,
  adjustments: ReadonlyArray<{ effectiveAt: Date; newUnitCost: string }>,
  asOf: Date,
): string {
  let result = originalUnitCost;
  let latestEffectiveAt: Date | null = null;
  for (const adjustment of adjustments) {
    if (adjustment.effectiveAt > asOf) continue;
    if (
      latestEffectiveAt === null ||
      adjustment.effectiveAt >= latestEffectiveAt
    ) {
      latestEffectiveAt = adjustment.effectiveAt;
      result = adjustment.newUnitCost;
    }
  }
  return result;
}

export function layerValueAtAsOf(input: {
  receivedAt: Date;
  qtyOriginal: string;
  originalUnitCost: string;
  consumptions: ReadonlyArray<{ qty: string; isReversal: boolean; createdAt: Date }>;
  adjustments: ReadonlyArray<{ effectiveAt: Date; newUnitCost: string }>;
  asOf: Date;
}): { qty: string; unitCost: string; value: string } | null {
  if (input.receivedAt > input.asOf) {
    return null;
  }
  const consumed = Number(netConsumedQty(input.consumptions, input.asOf));
  const qty = Number(input.qtyOriginal) - consumed;
  if (qty <= 0) {
    return null;
  }
  const unitCost = unitCostAtAsOf(
    input.originalUnitCost,
    input.adjustments,
    input.asOf,
  );
  const value = String(qty * Number(unitCost));
  return { qty: String(qty), unitCost, value };
}

const ALLOCATION_EPSILON = 1e-9;

export function assertAllocationSumsToTotal(
  lineAmounts: string[],
  totalAmount: string,
): void {
  const sum = lineAmounts.reduce((acc, amount) => acc + Number(amount), 0);
  if (Math.abs(sum - Number(totalAmount)) > ALLOCATION_EPSILON) {
    throw new AllocationMismatchError();
  }
}
