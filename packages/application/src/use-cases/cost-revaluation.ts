import {
  InvalidStateError,
  LayerInUseError,
  NotFoundError,
  revaluationValueDelta,
} from "@stock-management/domain";
import type { IdempotencyInput } from "../dto/inputs.js";
import { costingOutboxFields } from "../costing/outbox-cost-fields.js";
import { refreshCostSummary } from "../costing/refresh-cost-summary.js";
import type {
  CostRevaluation,
  CostRevaluationPort,
  CreateCostRevaluationInput,
  UpdateCostRevaluationInput,
} from "../ports/revaluation.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";

const POST_OPERATION = "post-cost-revaluation";

export class CostRevaluationUseCases {
  constructor(private readonly repo: CostRevaluationPort) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const doc = await this.repo.findById(orgId, id);
    if (!doc) throw new NotFoundError("Cost revaluation");
    return doc;
  }

  create(orgId: string, input: CreateCostRevaluationInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateCostRevaluationInput) {
    const doc = await this.get(orgId, id);
    if (doc.status !== "draft") {
      throw new InvalidStateError("Only draft cost revaluations can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Cost revaluation");
    return updated;
  }
}

export type CostRevaluationPostResult = {
  document: CostRevaluation;
};

export class PostCostRevaluation {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    documentId: string,
    idempotency?: IdempotencyInput,
  ): Promise<CostRevaluationPostResult> {
    return this.uow.run(async (ctx) => {
      const revaluations = requireRevaluations(ctx);
      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          POST_OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as CostRevaluationPostResult;
      }

      const doc = await revaluations.findById(orgId, documentId);
      if (!doc) throw new NotFoundError("Cost revaluation");
      if (doc.status !== "draft") {
        throw new InvalidStateError(
          `Cannot post cost revaluation in status ${doc.status}`,
        );
      }

      const postedAt = new Date();
      let valueDeltaTotal = 0;
      for (const line of doc.lines) {
        if (Number(line.newUnitCost) < 0) {
          throw new InvalidStateError("New unit cost must be >= 0");
        }
        const layer = await ctx.costing.getLayer(orgId, line.costLayerId);
        if (!layer || Number(layer.qtyRemaining) <= 0) {
          throw new InvalidStateError("Revaluation target layer is not open");
        }
        const amount = revaluationValueDelta(
          layer.qtyRemaining,
          layer.unitCost,
          line.newUnitCost,
        );
        valueDeltaTotal += Number(amount);
        const oldUnitCost = layer.unitCost;
        await ctx.costing.updateLayerUnitCost(
          orgId,
          layer.id,
          line.newUnitCost,
        );
        await ctx.costing.insertValueAdjustment({
          orgId,
          costLayerId: layer.id,
          effectiveAt: postedAt,
          oldUnitCost,
          newUnitCost: line.newUnitCost,
          amount,
          sourceDocumentType: "cost_revaluation",
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

      const posted = await revaluations.updateStatus(
        orgId,
        doc.id,
        "posted",
        postedAt,
      );
      const result = { document: posted };
      await ctx.outbox.enqueue({
        orgId,
        eventType: "document.posted",
        aggregateType: "cost_revaluation",
        aggregateId: doc.id,
        payload: {
          revaluationId: doc.id,
          userId,
          ...costingOutboxFields({
            revaluationValueDelta: String(valueDeltaTotal),
          }),
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

export class VoidCostRevaluation {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    documentId: string,
  ): Promise<CostRevaluationPostResult> {
    return this.uow.run(async (ctx) => {
      const revaluations = requireRevaluations(ctx);
      const doc = await revaluations.findById(orgId, documentId);
      if (!doc) throw new NotFoundError("Cost revaluation");
      if (doc.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void cost revaluation in status ${doc.status}`,
        );
      }

      const allForDoc = await ctx.costing.listAdjustmentsBySourceDocument(
        orgId,
        "cost_revaluation",
        doc.id,
      );
      const lineIds = new Set(doc.lines.map((l) => l.id));
      const forward = allForDoc.filter(
        (a) =>
          a.sourceDocumentLineId != null &&
          lineIds.has(a.sourceDocumentLineId),
      );
      // Take earliest adjustment per layer+line (the post), ignore later void compensations
      const earliest = new Map<string, (typeof forward)[number]>();
      for (const adj of forward.sort(
        (a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime(),
      )) {
        const key = `${adj.costLayerId}:${adj.sourceDocumentLineId}`;
        if (!earliest.has(key)) earliest.set(key, adj);
      }
      const toReverse = [...earliest.values()];
      const layerIds = [...new Set(toReverse.map((a) => a.costLayerId))];
      await assertNoLaterAdjustments(ctx, orgId, layerIds, toReverse);

      const voidedAt = new Date();
      for (const adjustment of toReverse) {
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
          sourceDocumentType: "cost_revaluation",
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

      const voided = await revaluations.updateStatus(
        orgId,
        doc.id,
        "void",
        voidedAt,
      );
      const revaluationValueDelta = toReverse.reduce(
        (sum, a) => sum + Number(a.amount),
        0,
      );
      await ctx.outbox.enqueue({
        orgId,
        eventType: "document.voided",
        aggregateType: "cost_revaluation",
        aggregateId: doc.id,
        payload: {
          revaluationId: doc.id,
          userId,
          ...costingOutboxFields({
            revaluationValueDelta: String(revaluationValueDelta),
          }),
        },
      });
      return { document: voided };
    });
  }
}

function requireRevaluations(ctx: UowContext): CostRevaluationPort {
  if (!ctx.revaluations) throw new Error("Cost revaluation port is not configured");
  return ctx.revaluations;
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
