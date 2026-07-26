import type { CostLayer } from "@stock-management/domain";

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
}
