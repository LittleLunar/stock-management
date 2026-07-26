import { and, asc, eq, gt, inArray, isNull, type SQL } from "drizzle-orm";
import type { CostingPort, CostLayerKey } from "@stock-management/application";
import type { CostConsumption, CostLayer } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { costConsumptions, costLayers } from "../db/schema/index.js";

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
        originalUnitCost: layer.originalUnitCost,
        qtyOriginal: layer.qtyOriginal,
        qtyRemaining: layer.qtyRemaining,
      })
      .returning();
    return row as CostLayer;
  }

  async getLayer(orgId: string, layerId: string): Promise<CostLayer | null> {
    const [row] = await this.db
      .select()
      .from(costLayers)
      .where(and(eq(costLayers.orgId, orgId), eq(costLayers.id, layerId)))
      .limit(1);
    return (row as CostLayer | undefined) ?? null;
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

  async lockOpenLayersFifo(key: CostLayerKey): Promise<CostLayer[]> {
    const lotCondition =
      key.lotId == null
        ? isNull(costLayers.lotId)
        : eq(costLayers.lotId, key.lotId);
    return this.db
      .select()
      .from(costLayers)
      .where(
        and(
          eq(costLayers.orgId, key.orgId),
          eq(costLayers.productId, key.productId),
          eq(costLayers.locationId, key.locationId),
          lotCondition,
          gt(costLayers.qtyRemaining, "0"),
        ),
      )
      .orderBy(asc(costLayers.receivedAt), asc(costLayers.id))
      .for("update") as Promise<CostLayer[]>;
  }

  async listOpenLayersBySourceLine(
    orgId: string,
    sourceDocumentLineId: string,
  ): Promise<CostLayer[]> {
    return this.db
      .select()
      .from(costLayers)
      .where(
        and(
          eq(costLayers.orgId, orgId),
          eq(costLayers.sourceDocumentLineId, sourceDocumentLineId),
          gt(costLayers.qtyRemaining, "0"),
        ),
      )
      .orderBy(asc(costLayers.receivedAt), asc(costLayers.id)) as Promise<
      CostLayer[]
    >;
  }

  async insertConsumption(
    input: Omit<CostConsumption, "id" | "createdAt"> & { id?: string },
  ): Promise<CostConsumption> {
    const [row] = await this.db
      .insert(costConsumptions)
      .values({
        id: input.id,
        orgId: input.orgId,
        costLayerId: input.costLayerId,
        movementId: input.movementId,
        qty: input.qty,
        unitCost: input.unitCost,
        totalCost: input.totalCost,
        isReversal: input.isReversal,
      })
      .returning();
    return row as CostConsumption;
  }

  async listConsumptionsByMovementIds(
    orgId: string,
    movementIds: string[],
  ): Promise<CostConsumption[]> {
    if (movementIds.length === 0) return [];
    return this.db
      .select()
      .from(costConsumptions)
      .where(
        and(
          eq(costConsumptions.orgId, orgId),
          inArray(costConsumptions.movementId, movementIds),
        ),
      ) as Promise<CostConsumption[]>;
  }
}
