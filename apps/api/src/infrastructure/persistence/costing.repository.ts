import { and, eq, gt, type SQL } from "drizzle-orm";
import type { CostingPort } from "@stock-management/application";
import type { CostLayer } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { costLayers } from "../db/schema/index.js";

export class DrizzleCostingRepository implements CostingPort {
  constructor(private readonly db: DbClient) {}

  async insertLayer(
    layer: Omit<CostLayer, "id"> & { id?: string },
  ): Promise<CostLayer> {
    const [row] = await this.db
      .insert(costLayers)
      .values({
        id: layer.id,
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
      })
      .returning();
    return row as CostLayer;
  }

  async listOpenLayers(
    orgId: string,
    filter: { productId?: string; locationId?: string },
  ): Promise<CostLayer[]> {
    const conditions: SQL[] = [
      eq(costLayers.orgId, orgId),
      gt(costLayers.qtyRemaining, "0"),
    ];
    if (filter.productId) {
      conditions.push(eq(costLayers.productId, filter.productId));
    }
    if (filter.locationId) {
      conditions.push(eq(costLayers.locationId, filter.locationId));
    }
    return this.db
      .select()
      .from(costLayers)
      .where(and(...conditions)) as Promise<CostLayer[]>;
  }

  async listLayersBySourceDocument(
    orgId: string,
    documentType: string,
    documentId: string,
  ): Promise<CostLayer[]> {
    return this.db
      .select()
      .from(costLayers)
      .where(
        and(
          eq(costLayers.orgId, orgId),
          eq(costLayers.sourceDocumentType, documentType),
          eq(costLayers.sourceDocumentId, documentId),
        ),
      ) as Promise<CostLayer[]>;
  }

  async setQtyRemaining(
    orgId: string,
    layerId: string,
    qtyRemaining: string,
  ): Promise<void> {
    await this.db
      .update(costLayers)
      .set({ qtyRemaining })
      .where(and(eq(costLayers.orgId, orgId), eq(costLayers.id, layerId)));
  }
}
