import { layerValueAtAsOf } from "@stock-management/domain";
import type { CostLayer } from "@stock-management/domain";
import type { CostingPort } from "../ports/costing.js";
import type { LocationLookupPort } from "../ports/inventory.js";

export type ValuationFilter = {
  asOf?: Date;
  branchId?: string;
  locationId?: string;
  productId?: string;
};

export type ValuationRow = {
  productId: string;
  locationId: string;
  branchId: string;
  lotId: string | null;
  qty: string;
  unitCost: string;
  value: string;
};

export type ValuationResult = {
  rows: ValuationRow[];
  totalValue: string;
};

export class ValuationReportUseCases {
  constructor(
    private readonly costing: CostingPort,
    private readonly locations: LocationLookupPort,
  ) {}

  async listValuation(
    orgId: string,
    filter: ValuationFilter = {},
  ): Promise<ValuationResult> {
    const locationIds = await this.resolveLocationIds(orgId, filter);
    const layers = await this.costing.listLayersForValuation(orgId, {
      productId: filter.productId,
      locationId: filter.locationId,
      locationIds: locationIds ?? undefined,
    });

    const locationBranch = await this.branchByLocation(orgId, layers);
    const asOf = filter.asOf;

    if (!asOf) {
      const rows: ValuationRow[] = [];
      let total = 0;
      for (const layer of layers) {
        if (Number(layer.qtyRemaining) <= 0) continue;
        const branchId = locationBranch.get(layer.locationId) ?? "";
        if (filter.branchId && branchId !== filter.branchId) continue;
        const value = Number(layer.qtyRemaining) * Number(layer.unitCost);
        total += value;
        rows.push({
          productId: layer.productId,
          locationId: layer.locationId,
          branchId,
          lotId: layer.lotId,
          qty: layer.qtyRemaining,
          unitCost: layer.unitCost,
          value: String(value),
        });
      }
      return { rows, totalValue: String(total) };
    }

    const layerIds = layers.map((l) => l.id);
    const consumptions = await this.costing.listConsumptionsForLayers(
      orgId,
      layerIds,
    );
    const adjustments = await this.costing.listAdjustmentsForLayers(
      orgId,
      layerIds,
    );
    const consumptionsByLayer = groupBy(consumptions, (c) => c.costLayerId);
    const adjustmentsByLayer = groupBy(adjustments, (a) => a.costLayerId);

    const rows: ValuationRow[] = [];
    let total = 0;
    for (const layer of layers) {
      const branchId = locationBranch.get(layer.locationId) ?? "";
      if (filter.branchId && branchId !== filter.branchId) continue;
      const at = layerValueAtAsOf({
        receivedAt: layer.receivedAt,
        qtyOriginal: layer.qtyOriginal,
        originalUnitCost: layer.originalUnitCost,
        consumptions: consumptionsByLayer.get(layer.id) ?? [],
        adjustments: (adjustmentsByLayer.get(layer.id) ?? []).map((a) => ({
          effectiveAt: a.effectiveAt,
          newUnitCost: a.newUnitCost,
        })),
        asOf,
      });
      if (!at) continue;
      total += Number(at.value);
      rows.push({
        productId: layer.productId,
        locationId: layer.locationId,
        branchId,
        lotId: layer.lotId,
        qty: at.qty,
        unitCost: at.unitCost,
        value: at.value,
      });
    }
    return { rows, totalValue: String(total) };
  }

  private async resolveLocationIds(
    orgId: string,
    filter: ValuationFilter,
  ): Promise<string[] | null> {
    if (filter.locationId) return [filter.locationId];
    if (!filter.branchId) return null;
    if (!this.locations.list) return null;
    const locs = await this.locations.list(orgId, filter.branchId);
    return locs.map((l) => l.id);
  }

  private async branchByLocation(
    orgId: string,
    layers: CostLayer[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const ids = [...new Set(layers.map((l) => l.locationId))];
    for (const id of ids) {
      const loc = await this.locations.findById(orgId, id);
      if (loc) map.set(id, loc.branchId);
    }
    return map;
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}
