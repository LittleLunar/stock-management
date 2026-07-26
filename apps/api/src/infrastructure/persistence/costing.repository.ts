import { and, asc, eq, gt, inArray, isNull, type SQL } from "drizzle-orm";
import type { CostingPort, CostLayerKey } from "@stock-management/application";
import type {
  CostConsumption,
  CostLayer,
  CostLayerValueAdjustment,
  ProductCostSummary,
} from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  costConsumptions,
  costLayerValueAdjustments,
  costLayers,
  productCostSummaries,
} from "../db/schema/index.js";

function sameLotCondition(lotId: string | null) {
  return lotId == null
    ? isNull(productCostSummaries.lotId)
    : eq(productCostSummaries.lotId, lotId);
}

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

  async listLayersForValuation(
    orgId: string,
    filter: {
      productId?: string;
      locationId?: string;
      locationIds?: string[];
    },
  ): Promise<CostLayer[]> {
    const conditions: SQL[] = [eq(costLayers.orgId, orgId)];
    if (filter.productId) {
      conditions.push(eq(costLayers.productId, filter.productId));
    }
    if (filter.locationId) {
      conditions.push(eq(costLayers.locationId, filter.locationId));
    }
    if (filter.locationIds && filter.locationIds.length > 0) {
      conditions.push(inArray(costLayers.locationId, filter.locationIds));
    }
    return this.db
      .select()
      .from(costLayers)
      .where(and(...conditions)) as Promise<CostLayer[]>;
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

  async updateLayerUnitCost(
    orgId: string,
    layerId: string,
    unitCost: string,
  ): Promise<void> {
    await this.db
      .update(costLayers)
      .set({ unitCost })
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

  async listConsumptionsForLayers(
    orgId: string,
    layerIds: string[],
  ): Promise<CostConsumption[]> {
    if (layerIds.length === 0) return [];
    return this.db
      .select()
      .from(costConsumptions)
      .where(
        and(
          eq(costConsumptions.orgId, orgId),
          inArray(costConsumptions.costLayerId, layerIds),
        ),
      ) as Promise<CostConsumption[]>;
  }

  async insertValueAdjustment(
    input: Omit<CostLayerValueAdjustment, "id" | "createdAt"> & {
      id?: string;
    },
  ): Promise<CostLayerValueAdjustment> {
    const [row] = await this.db
      .insert(costLayerValueAdjustments)
      .values({
        id: input.id,
        orgId: input.orgId,
        costLayerId: input.costLayerId,
        effectiveAt: input.effectiveAt,
        oldUnitCost: input.oldUnitCost,
        newUnitCost: input.newUnitCost,
        amount: input.amount,
        sourceDocumentType: input.sourceDocumentType,
        sourceDocumentId: input.sourceDocumentId,
        sourceDocumentLineId: input.sourceDocumentLineId,
      })
      .returning();
    return row as CostLayerValueAdjustment;
  }

  async listAdjustmentsForLayers(
    orgId: string,
    layerIds: string[],
  ): Promise<CostLayerValueAdjustment[]> {
    if (layerIds.length === 0) return [];
    return this.db
      .select()
      .from(costLayerValueAdjustments)
      .where(
        and(
          eq(costLayerValueAdjustments.orgId, orgId),
          inArray(costLayerValueAdjustments.costLayerId, layerIds),
        ),
      ) as Promise<CostLayerValueAdjustment[]>;
  }

  async upsertProductCostSummary(
    row: Omit<ProductCostSummary, "id" | "updatedAt"> & {
      id?: string;
      updatedAt?: Date;
    },
  ): Promise<ProductCostSummary> {
    const [existing] = await this.db
      .select()
      .from(productCostSummaries)
      .where(
        and(
          eq(productCostSummaries.orgId, row.orgId),
          eq(productCostSummaries.productId, row.productId),
          eq(productCostSummaries.locationId, row.locationId),
          sameLotCondition(row.lotId),
        ),
      )
      .limit(1);

    const updatedAt = row.updatedAt ?? new Date();
    if (existing) {
      const [updated] = await this.db
        .update(productCostSummaries)
        .set({
          qtyRemainingSum: row.qtyRemainingSum,
          onHandValue: row.onHandValue,
          updatedAt,
        })
        .where(eq(productCostSummaries.id, existing.id))
        .returning();
      return updated as ProductCostSummary;
    }

    const [created] = await this.db
      .insert(productCostSummaries)
      .values({
        id: row.id,
        orgId: row.orgId,
        productId: row.productId,
        locationId: row.locationId,
        lotId: row.lotId,
        qtyRemainingSum: row.qtyRemainingSum,
        onHandValue: row.onHandValue,
        updatedAt,
      })
      .returning();
    return created as ProductCostSummary;
  }

  async recomputeProductCostSummary(
    key: CostLayerKey,
  ): Promise<ProductCostSummary> {
    const lotCondition =
      key.lotId == null
        ? isNull(costLayers.lotId)
        : eq(costLayers.lotId, key.lotId);
    const open = await this.db
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
      );

    let qty = 0;
    let value = 0;
    for (const layer of open) {
      const remaining = Number(layer.qtyRemaining);
      qty += remaining;
      value += remaining * Number(layer.unitCost);
    }

    return this.upsertProductCostSummary({
      orgId: key.orgId,
      productId: key.productId,
      locationId: key.locationId,
      lotId: key.lotId,
      qtyRemainingSum: String(qty),
      onHandValue: String(value),
    });
  }

  async listProductCostSummaries(
    orgId: string,
    filter: { productId?: string; locationId?: string } = {},
  ): Promise<ProductCostSummary[]> {
    const conditions: SQL[] = [eq(productCostSummaries.orgId, orgId)];
    if (filter.productId) {
      conditions.push(eq(productCostSummaries.productId, filter.productId));
    }
    if (filter.locationId) {
      conditions.push(eq(productCostSummaries.locationId, filter.locationId));
    }
    return this.db
      .select()
      .from(productCostSummaries)
      .where(and(...conditions)) as Promise<ProductCostSummary[]>;
  }
}
