import type { CostConsumption, CostLayer } from "@stock-management/domain";

export type CostLayerKey = {
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
};

export interface CostingPort {
  insertLayer(
    layer: Omit<CostLayer, "id"> & { id?: string },
  ): Promise<CostLayer>;
  getLayer(orgId: string, layerId: string): Promise<CostLayer | null>;
  listOpenLayers(
    orgId: string,
    filter: { productId?: string; locationId?: string },
  ): Promise<CostLayer[]>;
  listLayersBySourceDocument(
    orgId: string,
    documentType: string,
    documentId: string,
  ): Promise<CostLayer[]>;
  setQtyRemaining(
    orgId: string,
    layerId: string,
    qtyRemaining: string,
  ): Promise<void>;
  lockOpenLayersFifo(key: CostLayerKey): Promise<CostLayer[]>;
  listOpenLayersBySourceLine(
    orgId: string,
    sourceDocumentLineId: string,
  ): Promise<CostLayer[]>;
  insertConsumption(
    input: Omit<CostConsumption, "id" | "createdAt"> & { id?: string },
  ): Promise<CostConsumption>;
  listConsumptionsByMovementIds(
    orgId: string,
    movementIds: string[],
  ): Promise<CostConsumption[]>;
}
