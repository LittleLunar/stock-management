import type { CostingMethod } from "./types.js";
import type { CostLayer } from "./entities.js";
import {
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
