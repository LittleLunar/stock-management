import type { CostConsumption, CostLayer } from "@stock-management/domain";
import type { CostingPort, CostLayerKey } from "../ports/costing.js";

export type FakeCosting = CostingPort & {
  layers: CostLayer[];
  consumptions: CostConsumption[];
};

export function createFakeCosting(): FakeCosting {
  const layers: CostLayer[] = [];
  const consumptions: CostConsumption[] = [];
  let layerSeq = 0;
  let consSeq = 0;

  return {
    layers,
    consumptions,
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
    async setQtyRemaining(orgId, layerId, qtyRemaining) {
      const layer = layers.find((l) => l.orgId === orgId && l.id === layerId);
      if (layer) layer.qtyRemaining = qtyRemaining;
    },
    async lockOpenLayersFifo(key: CostLayerKey) {
      return layers
        .filter(
          (l) =>
            l.orgId === key.orgId &&
            l.productId === key.productId &&
            l.locationId === key.locationId &&
            (l.lotId ?? null) === (key.lotId ?? null) &&
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
  };
}
