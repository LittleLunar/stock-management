import {
  assertFifoCostingMethod,
  MissingUnitCostError,
  NotFoundError,
  planCreateLayer,
  planFifoConsume,
  planPreferSourceLineThenFifo,
} from "@stock-management/domain";
import type { UowContext } from "../ports/unit-of-work.js";
import { refreshCostSummary } from "./refresh-cost-summary.js";

export async function consumeFifoForMovement(
  ctx: Pick<UowContext, "costing" | "products">,
  args: {
    orgId: string;
    productId: string;
    locationId: string;
    lotId: string | null;
    qty: string;
    movementId: string;
    preferSourceDocumentLineId?: string | null;
  },
): Promise<{ unitCost: string; totalCost: string }> {
  const product = await ctx.products.findById(args.orgId, args.productId);
  if (!product) throw new NotFoundError("Product");
  assertFifoCostingMethod(product.costingMethod);

  const fifoLayers = await ctx.costing.lockOpenLayersFifo({
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.locationId,
    lotId: args.lotId,
  });

  const plan = args.preferSourceDocumentLineId
    ? planPreferSourceLineThenFifo(
        (
          await ctx.costing.listOpenLayersBySourceLine(
            args.orgId,
            args.preferSourceDocumentLineId,
          )
        ).filter(
          (l) =>
            l.locationId === args.locationId &&
            l.productId === args.productId &&
            (l.lotId ?? null) === (args.lotId ?? null) &&
            Number(l.qtyRemaining) > 0,
        ),
        fifoLayers,
        args.qty,
      )
    : planFifoConsume(fifoLayers, args.qty);

  const remainingById = new Map(
    fifoLayers.map((l) => [l.id, Number(l.qtyRemaining)]),
  );
  for (const slice of plan.slices) {
    if (!remainingById.has(slice.layerId)) {
      const layer = await ctx.costing.getLayer(args.orgId, slice.layerId);
      remainingById.set(slice.layerId, Number(layer?.qtyRemaining ?? 0));
    }
  }

  for (const slice of plan.slices) {
    const next = (remainingById.get(slice.layerId) ?? 0) - Number(slice.qty);
    remainingById.set(slice.layerId, next);
    await ctx.costing.setQtyRemaining(args.orgId, slice.layerId, String(next));
    await ctx.costing.insertConsumption({
      orgId: args.orgId,
      costLayerId: slice.layerId,
      movementId: args.movementId,
      qty: slice.qty,
      unitCost: slice.unitCost,
      totalCost: slice.totalCost,
      isReversal: false,
    });
  }

  await refreshCostSummary(ctx.costing, {
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.locationId,
    lotId: args.lotId,
  });

  return { unitCost: plan.unitCost, totalCost: plan.totalCost };
}

export async function createLayerForMovement(
  ctx: Pick<UowContext, "costing" | "products">,
  args: {
    orgId: string;
    productId: string;
    locationId: string;
    lotId: string | null;
    qty: string;
    unitCost: string;
    movementId: string;
    sourceDocumentType: string;
    sourceDocumentId: string;
    sourceDocumentLineId: string | null;
    receivedAt?: Date;
  },
): Promise<{ unitCost: string; totalCost: string }> {
  const product = await ctx.products.findById(args.orgId, args.productId);
  if (!product) throw new NotFoundError("Product");
  assertFifoCostingMethod(product.costingMethod);

  if (args.unitCost == null || args.unitCost === "") {
    throw new MissingUnitCostError();
  }

  const planned = planCreateLayer({ qty: args.qty, unitCost: args.unitCost });
  await ctx.costing.insertLayer({
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.locationId,
    lotId: args.lotId,
    sourceDocumentType: args.sourceDocumentType,
    sourceDocumentId: args.sourceDocumentId,
    sourceDocumentLineId: args.sourceDocumentLineId,
    sourceMovementId: args.movementId,
    receivedAt: args.receivedAt ?? new Date(),
    unitCost: planned.unitCost,
    originalUnitCost: planned.unitCost,
    qtyOriginal: planned.qtyOriginal,
    qtyRemaining: planned.qtyRemaining,
  });

  await refreshCostSummary(ctx.costing, {
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.locationId,
    lotId: args.lotId,
  });

  return {
    unitCost: planned.unitCost,
    totalCost: planned.totalCost,
  };
}

export async function moveLayersForTransferHop(
  ctx: Pick<UowContext, "costing" | "products">,
  args: {
    orgId: string;
    productId: string;
    lotId: string | null;
    qty: string;
    fromLocationId: string;
    toLocationId: string;
    outMovementId: string;
    inMovementId: string;
    sourceDocumentType: "stock_transfer";
    sourceDocumentId: string;
    sourceDocumentLineId: string | null;
  },
): Promise<{ unitCost: string; totalCost: string }> {
  const product = await ctx.products.findById(args.orgId, args.productId);
  if (!product) throw new NotFoundError("Product");
  assertFifoCostingMethod(product.costingMethod);

  const fifoLayers = await ctx.costing.lockOpenLayersFifo({
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.fromLocationId,
    lotId: args.lotId,
  });
  const plan = planFifoConsume(fifoLayers, args.qty);
  const layerById = new Map(fifoLayers.map((l) => [l.id, l]));

  const remainingById = new Map(
    fifoLayers.map((l) => [l.id, Number(l.qtyRemaining)]),
  );
  for (const slice of plan.slices) {
    const sourceLayer = layerById.get(slice.layerId);
    const next = (remainingById.get(slice.layerId) ?? 0) - Number(slice.qty);
    remainingById.set(slice.layerId, next);
    await ctx.costing.setQtyRemaining(args.orgId, slice.layerId, String(next));
    await ctx.costing.insertConsumption({
      orgId: args.orgId,
      costLayerId: slice.layerId,
      movementId: args.outMovementId,
      qty: slice.qty,
      unitCost: slice.unitCost,
      totalCost: slice.totalCost,
      isReversal: false,
    });
    await ctx.costing.insertLayer({
      orgId: args.orgId,
      productId: args.productId,
      locationId: args.toLocationId,
      lotId: args.lotId,
      sourceDocumentType: args.sourceDocumentType,
      sourceDocumentId: args.sourceDocumentId,
      sourceDocumentLineId: args.sourceDocumentLineId,
      sourceMovementId: args.inMovementId,
      receivedAt: slice.receivedAt,
      unitCost: slice.unitCost,
      originalUnitCost: sourceLayer?.originalUnitCost ?? slice.unitCost,
      qtyOriginal: slice.qty,
      qtyRemaining: slice.qty,
    });
  }

  await refreshCostSummary(ctx.costing, {
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.fromLocationId,
    lotId: args.lotId,
  });
  await refreshCostSummary(ctx.costing, {
    orgId: args.orgId,
    productId: args.productId,
    locationId: args.toLocationId,
    lotId: args.lotId,
  });

  return { unitCost: plan.unitCost, totalCost: plan.totalCost };
}

export async function restoreConsumptionsForVoidedMovements(
  ctx: Pick<UowContext, "costing">,
  args: {
    orgId: string;
    forwardMovementIds: string[];
    voidMovementIdByForwardId: Map<string, string>;
  },
): Promise<void> {
  if (args.forwardMovementIds.length === 0) return;

  const consumptions = await ctx.costing.listConsumptionsByMovementIds(
    args.orgId,
    args.forwardMovementIds,
  );

  const refreshedKeys = new Map<string, {
    orgId: string;
    productId: string;
    locationId: string;
    lotId: string | null;
  }>();

  for (const consumption of consumptions.filter((c) => !c.isReversal)) {
    const voidMovementId = args.voidMovementIdByForwardId.get(
      consumption.movementId,
    );
    if (!voidMovementId) continue;

    const layer = await ctx.costing.getLayer(
      args.orgId,
      consumption.costLayerId,
    );
    const current = Number(layer?.qtyRemaining ?? 0);
    await ctx.costing.setQtyRemaining(
      args.orgId,
      consumption.costLayerId,
      String(current + Number(consumption.qty)),
    );
    await ctx.costing.insertConsumption({
      orgId: args.orgId,
      costLayerId: consumption.costLayerId,
      movementId: voidMovementId,
      qty: consumption.qty,
      unitCost: consumption.unitCost,
      totalCost: consumption.totalCost,
      isReversal: true,
    });
    if (layer) {
      refreshedKeys.set(
        `${layer.orgId}:${layer.productId}:${layer.locationId}:${layer.lotId ?? ""}`,
        {
          orgId: layer.orgId,
          productId: layer.productId,
          locationId: layer.locationId,
          lotId: layer.lotId,
        },
      );
    }
  }

  for (const key of refreshedKeys.values()) {
    await refreshCostSummary(ctx.costing, key);
  }
}
