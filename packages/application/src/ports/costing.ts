import type {
  CostConsumption,
  CostLayer,
  CostLayerValueAdjustment,
  ProductCostSummary,
} from "@stock-management/domain";

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
  listLayersForValuation(
    orgId: string,
    filter: {
      productId?: string;
      locationId?: string;
      locationIds?: string[];
    },
  ): Promise<CostLayer[]>;
  setQtyRemaining(
    orgId: string,
    layerId: string,
    qtyRemaining: string,
  ): Promise<void>;
  updateLayerUnitCost(
    orgId: string,
    layerId: string,
    unitCost: string,
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
  listConsumptionsForLayers(
    orgId: string,
    layerIds: string[],
  ): Promise<CostConsumption[]>;
  insertValueAdjustment(
    input: Omit<CostLayerValueAdjustment, "id" | "createdAt"> & { id?: string },
  ): Promise<CostLayerValueAdjustment>;
  listAdjustmentsForLayers(
    orgId: string,
    layerIds: string[],
  ): Promise<CostLayerValueAdjustment[]>;
  listAdjustmentsBySourceDocument(
    orgId: string,
    documentType: string,
    documentId: string,
  ): Promise<CostLayerValueAdjustment[]>;
  upsertProductCostSummary(
    row: Omit<ProductCostSummary, "id" | "updatedAt"> & {
      id?: string;
      updatedAt?: Date;
    },
  ): Promise<ProductCostSummary>;
  recomputeProductCostSummary(key: CostLayerKey): Promise<ProductCostSummary>;
  listProductCostSummaries(
    orgId: string,
    filter?: { productId?: string; locationId?: string },
  ): Promise<ProductCostSummary[]>;
}
