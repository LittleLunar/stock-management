import {
  InvalidStateError,
  LayerInUseError,
  NotFoundError,
  allocateLandedUnitCost,
  assertAllocationSumsToTotal,
} from "@stock-management/domain";
import type { CostLayer } from "@stock-management/domain";
import type { IdempotencyInput } from "../dto/inputs.js";
import { costingOutboxFields } from "../costing/outbox-cost-fields.js";
import { refreshCostSummary } from "../costing/refresh-cost-summary.js";
import type {
  CreateLandedCostInput,
  LandedCostDocument,
  LandedCostPort,
  UpdateLandedCostInput,
} from "../ports/landed-cost.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";

const POST_OPERATION = "post-landed-cost";

export class LandedCostUseCases {
  constructor(private readonly repo: LandedCostPort) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const doc = await this.repo.findById(orgId, id);
    if (!doc) throw new NotFoundError("Landed cost");
    return doc;
  }

  create(orgId: string, input: CreateLandedCostInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateLandedCostInput) {
    const doc = await this.get(orgId, id);
    if (doc.status !== "draft") {
      throw new InvalidStateError("Only draft landed costs can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Landed cost");
    return updated;
  }
}

export type LandedCostPostResult = {
  document: LandedCostDocument;
};

export class PostLandedCost {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    documentId: string,
    idempotency?: IdempotencyInput,
  ): Promise<LandedCostPostResult> {
    return this.uow.run(async (ctx) => {
      const landedCosts = requireLandedCosts(ctx);
      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          POST_OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as LandedCostPostResult;
      }

      const doc = await landedCosts.findById(orgId, documentId);
      if (!doc) throw new NotFoundError("Landed cost");
      if (doc.status !== "draft") {
        throw new InvalidStateError(
          `Cannot post landed cost in status ${doc.status}`,
        );
      }

      assertAllocationSumsToTotal(
        doc.lines.map((line) => line.amount),
        doc.totalAmount,
      );

      const postedAt = new Date();
      for (const line of doc.lines) {
        const targets = await resolveOpenTargetLayers(ctx, orgId, line);
        const totalQty = targets.reduce(
          (sum, layer) => sum + Number(layer.qtyRemaining),
          0,
        );
        if (totalQty <= 0) {
          throw new InvalidStateError("No open cost layers for landed cost line");
        }

        let allocated = 0;
        for (let i = 0; i < targets.length; i++) {
          const layer = targets[i]!;
          const isLast = i === targets.length - 1;
          const share = isLast
            ? Number(line.amount) - allocated
            : (Number(line.amount) * Number(layer.qtyRemaining)) / totalQty;
          allocated += share;

          const { newUnitCost } = allocateLandedUnitCost(
            layer.qtyRemaining,
            layer.unitCost,
            String(share),
          );
          const oldUnitCost = layer.unitCost;
          await ctx.costing.updateLayerUnitCost(orgId, layer.id, newUnitCost);
          await ctx.costing.insertValueAdjustment({
            orgId,
            costLayerId: layer.id,
            effectiveAt: postedAt,
            oldUnitCost,
            newUnitCost,
            amount: String(share),
            sourceDocumentType: "landed_cost",
            sourceDocumentId: doc.id,
            sourceDocumentLineId: line.id,
          });
          await refreshCostSummary(ctx.costing, {
            orgId: layer.orgId,
            productId: layer.productId,
            locationId: layer.locationId,
            lotId: layer.lotId,
          });
        }
      }

      const posted = await landedCosts.updateStatus(
        orgId,
        doc.id,
        "posted",
        postedAt,
      );
      const result = { document: posted };
      await ctx.outbox.enqueue({
        orgId,
        eventType: "document.posted",
        aggregateType: "landed_cost",
        aggregateId: doc.id,
        payload: {
          landedCostId: doc.id,
          userId,
          ...costingOutboxFields({ landedAmount: doc.totalAmount }),
        },
      });
      if (idempotency) {
        await ctx.idempotency.save({
          orgId,
          operation: POST_OPERATION,
          externalSystem: idempotency.externalSystem,
          externalId: idempotency.externalId,
          result,
        });
      }
      return result;
    });
  }
}

export class VoidLandedCost {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    documentId: string,
  ): Promise<LandedCostPostResult> {
    return this.uow.run(async (ctx) => {
      const landedCosts = requireLandedCosts(ctx);
      const doc = await landedCosts.findById(orgId, documentId);
      if (!doc) throw new NotFoundError("Landed cost");
      if (doc.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void landed cost in status ${doc.status}`,
        );
      }

      const allForDoc = await ctx.costing.listAdjustmentsBySourceDocument(
        orgId,
        "landed_cost",
        doc.id,
      );
      const lineIds = new Set(doc.lines.map((l) => l.id));
      const forward = allForDoc.filter(
        (a) =>
          a.sourceDocumentLineId != null && lineIds.has(a.sourceDocumentLineId),
      );
      const earliest = new Map<string, (typeof forward)[number]>();
      for (const adj of forward.sort(
        (a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime(),
      )) {
        const key = `${adj.costLayerId}:${adj.sourceDocumentLineId}`;
        if (!earliest.has(key)) earliest.set(key, adj);
      }
      const ours = [...earliest.values()];
      const layerIds = [...new Set(ours.map((a) => a.costLayerId))];
      await assertNoLaterAdjustments(ctx, orgId, layerIds, ours);

      const voidedAt = new Date();
      for (const adjustment of ours) {
        const layer = await ctx.costing.getLayer(orgId, adjustment.costLayerId);
        if (!layer) continue;
        await ctx.costing.updateLayerUnitCost(
          orgId,
          layer.id,
          adjustment.oldUnitCost,
        );
        await ctx.costing.insertValueAdjustment({
          orgId,
          costLayerId: layer.id,
          effectiveAt: voidedAt,
          oldUnitCost: adjustment.newUnitCost,
          newUnitCost: adjustment.oldUnitCost,
          amount: String(-Number(adjustment.amount)),
          sourceDocumentType: "landed_cost",
          sourceDocumentId: doc.id,
          sourceDocumentLineId: adjustment.sourceDocumentLineId,
        });
        await refreshCostSummary(ctx.costing, {
          orgId: layer.orgId,
          productId: layer.productId,
          locationId: layer.locationId,
          lotId: layer.lotId,
        });
      }

      const voided = await landedCosts.updateStatus(
        orgId,
        doc.id,
        "void",
        voidedAt,
      );
      await ctx.outbox.enqueue({
        orgId,
        eventType: "document.voided",
        aggregateType: "landed_cost",
        aggregateId: doc.id,
        payload: { landedCostId: doc.id, userId },
      });
      return { document: voided };
    });
  }
}

function requireLandedCosts(ctx: UowContext): LandedCostPort {
  if (!ctx.landedCosts) throw new Error("Landed cost port is not configured");
  return ctx.landedCosts;
}

async function resolveOpenTargetLayers(
  ctx: UowContext,
  orgId: string,
  line: LandedCostDocument["lines"][number],
): Promise<CostLayer[]> {
  if (line.costLayerId) {
    const layer = await ctx.costing.getLayer(orgId, line.costLayerId);
    if (!layer || Number(layer.qtyRemaining) <= 0) {
      throw new InvalidStateError("Landed cost target layer is not open");
    }
    return [layer];
  }
  if (line.goodsReceiptLineId) {
    const open = await ctx.costing.listOpenLayersBySourceLine(
      orgId,
      line.goodsReceiptLineId,
    );
    if (open.length === 0) {
      throw new InvalidStateError(
        "No open layers for goods receipt line on landed cost",
      );
    }
    return open;
  }
  throw new InvalidStateError(
    "Landed cost line requires goodsReceiptLineId or costLayerId",
  );
}

async function assertNoLaterAdjustments(
  ctx: UowContext,
  orgId: string,
  layerIds: string[],
  ourAdjustments: Array<{
    id: string;
    costLayerId: string;
    effectiveAt: Date;
  }>,
): Promise<void> {
  const all = await ctx.costing.listAdjustmentsForLayers(orgId, layerIds);
  const ourIds = new Set(ourAdjustments.map((a) => a.id));
  const ourLatestByLayer = new Map<string, Date>();
  for (const adj of ourAdjustments) {
    const prev = ourLatestByLayer.get(adj.costLayerId);
    if (!prev || adj.effectiveAt > prev) {
      ourLatestByLayer.set(adj.costLayerId, adj.effectiveAt);
    }
  }
  for (const adj of all) {
    if (ourIds.has(adj.id)) continue;
    const ourLatest = ourLatestByLayer.get(adj.costLayerId);
    if (ourLatest && adj.effectiveAt > ourLatest) {
      throw new LayerInUseError(
        "Cost layer has a later value adjustment; cannot void",
      );
    }
  }
}
