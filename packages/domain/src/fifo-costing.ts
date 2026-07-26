import type { CostingMethod } from "./types.js";
import type { CostLayer } from "./entities.js";
import {
  InsufficientCostError,
  LayerInUseError,
  MissingUnitCostError,
  UnsupportedCostingMethodError,
} from "./errors.js";

export function resolveReceiptUnitCost(
  lineUnitCost: string | null | undefined,
  poLineUnitCost: string | null | undefined,
): string {
  if (lineUnitCost != null && lineUnitCost !== "") {
    return lineUnitCost;
  }
  if (poLineUnitCost != null && poLineUnitCost !== "") {
    return poLineUnitCost;
  }
  throw new MissingUnitCostError();
}

export function assertFifoCostingMethod(method: CostingMethod): void {
  if (method !== "fifo") {
    throw new UnsupportedCostingMethodError();
  }
}

export function totalCost(unitCost: string, qty: string): string {
  return String(Number(unitCost) * Math.abs(Number(qty)));
}

export function planCreateLayer(input: {
  qty: string;
  unitCost: string;
}): { unitCost: string; qtyOriginal: string; qtyRemaining: string; totalCost: string } {
  const qtyOriginal = String(Math.abs(Number(input.qty)));
  return {
    unitCost: input.unitCost,
    qtyOriginal,
    qtyRemaining: qtyOriginal,
    totalCost: totalCost(input.unitCost, qtyOriginal),
  };
}

export function assertLayersFullyOpen(
  layers: ReadonlyArray<Pick<CostLayer, "qtyOriginal" | "qtyRemaining">>,
): void {
  for (const layer of layers) {
    if (Number(layer.qtyRemaining) < Number(layer.qtyOriginal)) {
      throw new LayerInUseError();
    }
  }
}

export type FifoLayerInput = Pick<
  CostLayer,
  "id" | "qtyRemaining" | "unitCost" | "receivedAt"
>;

export type FifoConsumeSlice = {
  layerId: string;
  qty: string;
  unitCost: string;
  totalCost: string;
  receivedAt: Date;
};

export type FifoConsumePlan = {
  slices: FifoConsumeSlice[];
  totalCost: string;
  unitCost: string;
};

export function weightedUnitCost(totalCostValue: string, qty: string): string {
  const q = Number(qty);
  if (q === 0) return "0";
  return String(Number(totalCostValue) / q);
}

/** layers must already be sorted oldest receivedAt, id ascending */
export function planFifoConsume(
  openLayers: ReadonlyArray<FifoLayerInput>,
  qtyNeeded: string,
): FifoConsumePlan {
  let remaining = Math.abs(Number(qtyNeeded));
  if (remaining === 0) {
    return { slices: [], totalCost: "0", unitCost: "0" };
  }

  const slices: FifoConsumeSlice[] = [];
  let total = 0;

  for (const layer of openLayers) {
    if (remaining <= 0) break;
    const available = Number(layer.qtyRemaining);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const sliceTotal = Number(layer.unitCost) * take;
    slices.push({
      layerId: layer.id,
      qty: String(take),
      unitCost: layer.unitCost,
      totalCost: String(sliceTotal),
      receivedAt: layer.receivedAt,
    });
    total += sliceTotal;
    remaining -= take;
  }

  if (remaining > 0) {
    throw new InsufficientCostError();
  }

  const qty = String(Math.abs(Number(qtyNeeded)));
  return {
    slices,
    totalCost: String(total),
    unitCost: weightedUnitCost(String(total), qty),
  };
}

export function planPreferSourceLineThenFifo(
  preferred: ReadonlyArray<FifoLayerInput>,
  fallbackFifoSorted: ReadonlyArray<FifoLayerInput>,
  qtyNeeded: string,
): FifoConsumePlan {
  const preferredPlan = planFifoConsumePartial(preferred, qtyNeeded);
  if (preferredPlan.remainingNeeded <= 0) {
    return preferredPlan.plan;
  }

  const preferredIds = new Set(preferred.map((l) => l.id));
  const fallbackOnly = fallbackFifoSorted.filter((l) => !preferredIds.has(l.id));
  // Reduce preferred layers' remaining for fallback planning by applying preferred takes
  const remainingById = new Map(
    fallbackFifoSorted.map((l) => [l.id, Number(l.qtyRemaining)]),
  );
  for (const slice of preferredPlan.plan.slices) {
    remainingById.set(
      slice.layerId,
      (remainingById.get(slice.layerId) ?? 0) - Number(slice.qty),
    );
  }

  const adjustedFallback: FifoLayerInput[] = fallbackOnly.map((l) => ({
    ...l,
    qtyRemaining: String(Math.max(0, remainingById.get(l.id) ?? Number(l.qtyRemaining))),
  }));

  const fallbackPlan = planFifoConsume(
    adjustedFallback,
    String(preferredPlan.remainingNeeded),
  );

  const slices = [...preferredPlan.plan.slices, ...fallbackPlan.slices];
  const total = slices.reduce((sum, s) => sum + Number(s.totalCost), 0);
  const qty = String(Math.abs(Number(qtyNeeded)));
  return {
    slices,
    totalCost: String(total),
    unitCost: weightedUnitCost(String(total), qty),
  };
}

function planFifoConsumePartial(
  openLayers: ReadonlyArray<FifoLayerInput>,
  qtyNeeded: string,
): { plan: FifoConsumePlan; remainingNeeded: number } {
  let remaining = Math.abs(Number(qtyNeeded));
  const slices: FifoConsumeSlice[] = [];
  let total = 0;

  for (const layer of openLayers) {
    if (remaining <= 0) break;
    const available = Number(layer.qtyRemaining);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const sliceTotal = Number(layer.unitCost) * take;
    slices.push({
      layerId: layer.id,
      qty: String(take),
      unitCost: layer.unitCost,
      totalCost: String(sliceTotal),
      receivedAt: layer.receivedAt,
    });
    total += sliceTotal;
    remaining -= take;
  }

  const taken = Math.abs(Number(qtyNeeded)) - remaining;
  return {
    plan: {
      slices,
      totalCost: String(total),
      unitCost: taken === 0 ? "0" : weightedUnitCost(String(total), String(taken)),
    },
    remainingNeeded: remaining,
  };
}
