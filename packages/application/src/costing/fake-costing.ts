import type {
  CostConsumption,
  CostLayer,
  CostLayerValueAdjustment,
  ProductCostSummary,
} from "@stock-management/domain";
import type { CostingPort, CostLayerKey } from "../ports/costing.js";

function sameLot(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return (left ?? null) === (right ?? null);
}

export type FakeCosting = CostingPort & {
  layers: CostLayer[];
  consumptions: CostConsumption[];
  adjustments: CostLayerValueAdjustment[];
  summaries: ProductCostSummary[];
};

export function createFakeCosting(): FakeCosting {
  const layers: CostLayer[] = [];
  const consumptions: CostConsumption[] = [];
  const adjustments: CostLayerValueAdjustment[] = [];
  const summaries: ProductCostSummary[] = [];
  let layerSeq = 0;
  let consSeq = 0;
  let adjSeq = 0;
  let summarySeq = 0;

  const api: FakeCosting = {
    layers,
    consumptions,
    adjustments,
    summaries,
    async insertLayer(layer) {
      const row: CostLayer = {
        id: layer.id ?? `layer-${++layerSeq}`,
        orgId: layer.orgId,
        productId: layer.productId,
        locationId: layer.locationId,
        lotId: layer.lotId,
        sourceDocumentType: layer.sourceDocumentType,
        sourceDocumentId: layer.sourceDocumentId,
        sourceDocumentLineId: layer.sourceDocumentLineId,
        sourceMovementId: layer.sourceMovementId,
        receivedAt: layer.receivedAt,
        unitCost: layer.unitCost,
        originalUnitCost: layer.originalUnitCost ?? layer.unitCost,
        qtyOriginal: layer.qtyOriginal,
        qtyRemaining: layer.qtyRemaining,
      };
      layers.push(row);
      return row;
    },
    async getLayer(orgId, layerId) {
      return layers.find((l) => l.orgId === orgId && l.id === layerId) ?? null;
    },
    async listOpenLayers(orgId, filter) {
      return layers.filter(
        (l) =>
          l.orgId === orgId &&
          Number(l.qtyRemaining) > 0 &&
          (!filter.productId || l.productId === filter.productId) &&
          (!filter.locationId || l.locationId === filter.locationId),
      );
    },
    async listLayersBySourceDocument(orgId, documentType, documentId) {
      return layers.filter(
        (l) =>
          l.orgId === orgId &&
          l.sourceDocumentType === documentType &&
          l.sourceDocumentId === documentId,
      );
    },
    async listLayersForValuation(orgId, filter) {
      const locationSet =
        filter.locationIds && filter.locationIds.length > 0
          ? new Set(filter.locationIds)
          : null;
      return layers.filter(
        (l) =>
          l.orgId === orgId &&
          (!filter.productId || l.productId === filter.productId) &&
          (!filter.locationId || l.locationId === filter.locationId) &&
          (!locationSet || locationSet.has(l.locationId)),
      );
    },
    async setQtyRemaining(orgId, layerId, qtyRemaining) {
      const layer = layers.find((l) => l.orgId === orgId && l.id === layerId);
      if (layer) layer.qtyRemaining = qtyRemaining;
    },
    async updateLayerUnitCost(orgId, layerId, unitCost) {
      const layer = layers.find((l) => l.orgId === orgId && l.id === layerId);
      if (layer) layer.unitCost = unitCost;
    },
    async lockOpenLayersFifo(key: CostLayerKey) {
      return layers
        .filter(
          (l) =>
            l.orgId === key.orgId &&
            l.productId === key.productId &&
            l.locationId === key.locationId &&
            sameLot(l.lotId, key.lotId) &&
            Number(l.qtyRemaining) > 0,
        )
        .sort(
          (a, b) =>
            a.receivedAt.getTime() - b.receivedAt.getTime() ||
            a.id.localeCompare(b.id),
        );
    },
    async listOpenLayersBySourceLine(orgId, sourceDocumentLineId) {
      return layers.filter(
        (l) =>
          l.orgId === orgId &&
          l.sourceDocumentLineId === sourceDocumentLineId &&
          Number(l.qtyRemaining) > 0,
      );
    },
    async insertConsumption(input) {
      const row: CostConsumption = {
        id: input.id ?? `cons-${++consSeq}`,
        orgId: input.orgId,
        costLayerId: input.costLayerId,
        movementId: input.movementId,
        qty: input.qty,
        unitCost: input.unitCost,
        totalCost: input.totalCost,
        isReversal: input.isReversal,
        createdAt: new Date(),
      };
      consumptions.push(row);
      return row;
    },
    async listConsumptionsByMovementIds(orgId, movementIds) {
      const set = new Set(movementIds);
      return consumptions.filter(
        (c) => c.orgId === orgId && set.has(c.movementId),
      );
    },
    async listConsumptionsForLayers(orgId, layerIds) {
      if (layerIds.length === 0) return [];
      const set = new Set(layerIds);
      return consumptions.filter(
        (c) => c.orgId === orgId && set.has(c.costLayerId),
      );
    },
    async insertValueAdjustment(input) {
      const row: CostLayerValueAdjustment = {
        id: input.id ?? `adj-${++adjSeq}`,
        orgId: input.orgId,
        costLayerId: input.costLayerId,
        effectiveAt: input.effectiveAt,
        oldUnitCost: input.oldUnitCost,
        newUnitCost: input.newUnitCost,
        amount: input.amount,
        sourceDocumentType: input.sourceDocumentType,
        sourceDocumentId: input.sourceDocumentId,
        sourceDocumentLineId: input.sourceDocumentLineId,
        createdAt: new Date(),
      };
      adjustments.push(row);
      return row;
    },
    async listAdjustmentsForLayers(orgId, layerIds) {
      if (layerIds.length === 0) return [];
      const set = new Set(layerIds);
      return adjustments.filter(
        (a) => a.orgId === orgId && set.has(a.costLayerId),
      );
    },
    async listAdjustmentsBySourceDocument(orgId, documentType, documentId) {
      return adjustments.filter(
        (a) =>
          a.orgId === orgId &&
          a.sourceDocumentType === documentType &&
          a.sourceDocumentId === documentId,
      );
    },
    async upsertProductCostSummary(row) {
      const existing = summaries.find(
        (s) =>
          s.orgId === row.orgId &&
          s.productId === row.productId &&
          s.locationId === row.locationId &&
          sameLot(s.lotId, row.lotId),
      );
      const updatedAt = row.updatedAt ?? new Date();
      if (existing) {
        existing.qtyRemainingSum = row.qtyRemainingSum;
        existing.onHandValue = row.onHandValue;
        existing.updatedAt = updatedAt;
        return existing;
      }
      const created: ProductCostSummary = {
        id: row.id ?? `summary-${++summarySeq}`,
        orgId: row.orgId,
        productId: row.productId,
        locationId: row.locationId,
        lotId: row.lotId,
        qtyRemainingSum: row.qtyRemainingSum,
        onHandValue: row.onHandValue,
        updatedAt,
      };
      summaries.push(created);
      return created;
    },
    async recomputeProductCostSummary(key) {
      const open = layers.filter(
        (l) =>
          l.orgId === key.orgId &&
          l.productId === key.productId &&
          l.locationId === key.locationId &&
          sameLot(l.lotId, key.lotId) &&
          Number(l.qtyRemaining) > 0,
      );
      let qty = 0;
      let value = 0;
      for (const layer of open) {
        qty += Number(layer.qtyRemaining);
        value += Number(layer.qtyRemaining) * Number(layer.unitCost);
      }
      return api.upsertProductCostSummary({
        orgId: key.orgId,
        productId: key.productId,
        locationId: key.locationId,
        lotId: key.lotId,
        qtyRemainingSum: String(qty),
        onHandValue: String(value),
      });
    },
    async listProductCostSummaries(orgId, filter = {}) {
      return summaries.filter(
        (s) =>
          s.orgId === orgId &&
          (!filter.productId || s.productId === filter.productId) &&
          (!filter.locationId || s.locationId === filter.locationId),
      );
    },
  };

  return api;
}
