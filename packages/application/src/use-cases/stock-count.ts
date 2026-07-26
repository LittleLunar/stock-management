import {
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  assertCanPostCount,
  assertLayersFullyOpen,
  countVariance,
  signedQtyForMovement,
} from "@stock-management/domain";
import type { StockCount, StockMovement } from "@stock-management/domain";
import type {
  CreateStockCountInput,
  IdempotencyInput,
  UpdateStockCountInput,
} from "../dto/inputs.js";
import {
  consumeFifoForMovement,
  createLayerForMovement,
  restoreConsumptionsForVoidedMovements,
} from "../costing/apply-document-costing.js";
import { costingOutboxFields } from "../costing/outbox-cost-fields.js";
import type { StockCountPort, StockPort } from "../ports/inventory.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export type StockCountResult = {
  count: StockCount;
  movements: StockMovement[];
};

export class StockCountUseCases {
  constructor(
    private readonly repo: StockCountPort,
    private readonly stock: StockPort,
  ) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const count = await this.repo.findById(orgId, id);
    if (!count) throw new NotFoundError("Stock count");
    return count;
  }

  async create(orgId: string, input: CreateStockCountInput) {
    const lines = await this.snapshotLines(
      orgId,
      input.locationId,
      input.lines,
    );
    return this.repo.create(orgId, { ...input, lines });
  }

  async update(orgId: string, id: string, input: UpdateStockCountInput) {
    const count = await this.get(orgId, id);
    if (count.status !== "draft") {
      throw new InvalidStateError("Only draft stock counts can be updated");
    }
    const lines = input.lines
      ? await this.snapshotLines(
          orgId,
          input.locationId ?? count.locationId,
          input.lines,
        )
      : undefined;
    const updated = await this.repo.update(orgId, id, { ...input, lines });
    if (!updated) throw new NotFoundError("Stock count");
    return updated;
  }

  private async snapshotLines(
    orgId: string,
    locationId: string,
    lines: CreateStockCountInput["lines"],
  ) {
    return Promise.all(
      lines.map(async (line) => {
        const balance = await this.stock.findBalance({
          orgId,
          productId: line.productId,
          locationId,
          lotId: line.lotId ?? null,
        });
        return {
          ...line,
          lotId: line.lotId ?? null,
          expectedQty: balance?.qtyOnHand ?? "0",
        };
      }),
    );
  }
}

const POST_OPERATION = "post-stock-count";

export class PostStockCount {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    countId: string,
    idempotency?: IdempotencyInput,
  ): Promise<StockCountResult> {
    return this.uow.run(async (ctx) => {
      const counts = ctx.counts;
      if (!counts) throw new Error("Stock count port is not configured");
      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          POST_OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as StockCountResult;
      }

      const count = await counts.findById(orgId, countId);
      if (!count) throw new NotFoundError("Stock count");
      assertCanPostCount(count);

      const variances = count.lines.map((line) => {
        if (line.countedQty === null) {
          throw new InvalidStateError(
            "All stock count lines require a counted quantity",
          );
        }
        return { line, qty: countVariance(line.expectedQty, line.countedQty) };
      });
      for (const { line, qty } of variances) {
        if (Number(qty) === 0) continue;
        const balance = await ctx.stock.findBalance({
          orgId,
          productId: line.productId,
          locationId: count.locationId,
          lotId: line.lotId,
        });
        if (Number(balance?.qtyOnHand ?? "0") + Number(qty) < 0) {
          throw new InsufficientStockError(
            "Posting stock count would create negative stock",
          );
        }
      }

      const movements: StockMovement[] = [];
      for (const { line, qty } of variances) {
        if (Number(qty) === 0) continue;
        const balanceKey = {
          orgId,
          productId: line.productId,
          locationId: count.locationId,
          lotId: line.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const movement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "stock_count",
          documentId: count.id,
          documentLineId: line.id,
          movementType: "count_variance",
          qty,
        });
        const absQty = String(Math.abs(Number(qty)));
        const costs =
          Number(qty) > 0
            ? await createLayerForMovement(ctx, {
                orgId,
                productId: line.productId,
                locationId: count.locationId,
                lotId: line.lotId,
                qty: absQty,
                unitCost: line.unitCost ?? "",
                movementId: movement.id,
                sourceDocumentType: "stock_count",
                sourceDocumentId: count.id,
                sourceDocumentLineId: line.id,
              })
            : await consumeFifoForMovement(ctx, {
                orgId,
                productId: line.productId,
                locationId: count.locationId,
                lotId: line.lotId,
                qty: absQty,
                movementId: movement.id,
              });
        movements.push(
          await ctx.stock.updateMovementCosts(
            orgId,
            movement.id,
            costs.unitCost,
            Number(qty) < 0
              ? String(-Math.abs(Number(costs.totalCost)))
              : costs.totalCost,
          ),
        );
        await ctx.stock.setBalance(
          balanceKey,
          String(Number(balance?.qtyOnHand ?? "0") + Number(qty)),
        );
      }

      const posted = await counts.updateStatus(
        orgId,
        count.id,
        "posted",
        new Date(),
      );
      const result = { count: posted, movements };
      await enqueueCountEvents(
        ctx,
        orgId,
        userId,
        count.id,
        "posted",
        movements,
      );
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

export class VoidStockCount {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    countId: string,
  ): Promise<StockCountResult> {
    return this.uow.run(async (ctx) => {
      const counts = ctx.counts;
      if (!counts) throw new Error("Stock count port is not configured");
      const count = await counts.findById(orgId, countId);
      if (!count) throw new NotFoundError("Stock count");
      if (count.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void stock count in status ${count.status}`,
        );
      }

      const postedMovements = (
        await ctx.stock.listMovements(orgId, {
          documentType: "stock_count",
          documentId: count.id,
        })
      ).filter((movement) => movement.movementType === "count_variance");
      for (const movement of postedMovements) {
        const balance = await ctx.stock.findBalance({
          orgId,
          productId: movement.productId,
          locationId: movement.locationId,
          lotId: movement.lotId,
        });
        if (Number(balance?.qtyOnHand ?? "0") - Number(movement.qty) < 0) {
          throw new InsufficientStockError(
            "Voiding stock count would create negative stock",
          );
        }
      }

      const inboundLayers = await ctx.costing.listLayersBySourceDocument(
        orgId,
        "stock_count",
        count.id,
      );
      assertLayersFullyOpen(inboundLayers);

      const movements: StockMovement[] = [];
      const voidMovementIdByForwardId = new Map<string, string>();
      const consumeForwardIds: string[] = [];
      for (const posted of postedMovements) {
        const qty = signedQtyForMovement("count_variance_void", posted.qty);
        const balanceKey = {
          orgId,
          productId: posted.productId,
          locationId: posted.locationId,
          lotId: posted.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const voidMovement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "stock_count",
          documentId: count.id,
          documentLineId: posted.documentLineId,
          movementType: "count_variance_void",
          qty,
          unitCost: posted.unitCost,
          totalCost: posted.totalCost
            ? String(-Number(posted.totalCost))
            : null,
        });
        movements.push(voidMovement);
        if (Number(posted.qty) < 0) {
          voidMovementIdByForwardId.set(posted.id, voidMovement.id);
          consumeForwardIds.push(posted.id);
        }
        await ctx.stock.setBalance(
          balanceKey,
          String(Number(balance?.qtyOnHand ?? "0") + Number(qty)),
        );
      }
      await restoreConsumptionsForVoidedMovements(ctx, {
        orgId,
        forwardMovementIds: consumeForwardIds,
        voidMovementIdByForwardId,
      });
      for (const layer of inboundLayers) {
        await ctx.costing.setQtyRemaining(orgId, layer.id, "0");
      }

      const voided = await counts.updateStatus(
        orgId,
        count.id,
        "void",
        new Date(),
      );
      await enqueueCountEvents(
        ctx,
        orgId,
        userId,
        count.id,
        "voided",
        movements,
      );
      return { count: voided, movements };
    });
  }
}

async function enqueueCountEvents(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  userId: string,
  countId: string,
  action: "posted" | "voided",
  movements: StockMovement[],
): Promise<void> {
  await ctx.outbox.enqueue({
    orgId,
    eventType: action === "posted" ? "document.posted" : "document.voided",
    aggregateType: "stock_count",
    aggregateId: countId,
      payload: {
      countId,
      userId,
      ...costingFieldsFromMovements(movements),
    },
  });
  if (movements.length > 0) {
    await ctx.outbox.enqueue({
      orgId,
      eventType: "stock.changed",
      aggregateType: "stock_count",
      aggregateId: countId,
      payload: { countId, movementIds: movements.map(({ id }) => id) },
    });
  }
}

function costingFieldsFromMovements(
  movements: StockMovement[],
): Record<string, string> {
  let inventoryValueDelta = 0;
  let cogsTotal = 0;
  for (const m of movements) {
    const cost = Number(m.totalCost ?? 0);
    if (Number(m.qty) > 0) inventoryValueDelta += Math.abs(cost);
    else if (Number(m.qty) < 0) cogsTotal += Math.abs(cost);
  }
  return costingOutboxFields({
    ...(inventoryValueDelta !== 0
      ? { inventoryValueDelta: String(inventoryValueDelta) }
      : {}),
    ...(cogsTotal !== 0 ? { cogsTotal: String(cogsTotal) } : {}),
  });
}
