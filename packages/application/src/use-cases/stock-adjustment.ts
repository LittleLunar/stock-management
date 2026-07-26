import {
  ConflictError,
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  assertCanPostAdjustment,
  assertLayersFullyOpen,
  assertLotSerialRules,
  assertSerialAvailableForOutbound,
  assertSignedAdjustmentQty,
  signedQtyForMovement,
} from "@stock-management/domain";
import type { StockAdjustment, StockMovement } from "@stock-management/domain";
import type {
  CreateStockAdjustmentInput,
  IdempotencyInput,
  UpdateStockAdjustmentInput,
} from "../dto/inputs.js";
import {
  consumeFifoForMovement,
  createLayerForMovement,
  restoreConsumptionsForVoidedMovements,
} from "../costing/apply-document-costing.js";
import { costingOutboxFields } from "../costing/outbox-cost-fields.js";
import type { StockAdjustmentPort } from "../ports/inventory.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export type StockAdjustmentResult = {
  adjustment: StockAdjustment;
  movements: StockMovement[];
};

export class StockAdjustmentUseCases {
  constructor(private readonly repo: StockAdjustmentPort) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const adjustment = await this.repo.findById(orgId, id);
    if (!adjustment) throw new NotFoundError("Stock adjustment");
    return adjustment;
  }

  create(orgId: string, input: CreateStockAdjustmentInput) {
    for (const line of input.lines) assertSignedAdjustmentQty(line.qty);
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateStockAdjustmentInput) {
    const adjustment = await this.get(orgId, id);
    if (adjustment.status !== "draft") {
      throw new InvalidStateError(
        "Only draft stock adjustments can be updated",
      );
    }
    for (const line of input.lines ?? []) assertSignedAdjustmentQty(line.qty);
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Stock adjustment");
    return updated;
  }
}

const POST_OPERATION = "post-stock-adjustment";

export class PostStockAdjustment {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    adjustmentId: string,
    idempotency?: IdempotencyInput,
  ): Promise<StockAdjustmentResult> {
    return this.uow.run(async (ctx) => {
      const adjustments = ctx.adjustments;
      if (!adjustments)
        throw new Error("Stock adjustment port is not configured");
      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          POST_OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as StockAdjustmentResult;
      }

      const adjustment = await adjustments.findById(orgId, adjustmentId);
      if (!adjustment) throw new NotFoundError("Stock adjustment");
      assertCanPostAdjustment(adjustment);

      const serialTrackedProductIds = new Set<string>();
      for (const line of adjustment.lines) {
        assertSignedAdjustmentQty(line.qty);
        const product = await ctx.products.findById(orgId, line.productId);
        if (!product) throw new NotFoundError("Product");
        if (product.trackSerial) serialTrackedProductIds.add(product.id);
        assertLotSerialRules(product, {
          lotId: line.lotId,
          serialNumbers: line.serialNumbers,
        });
        if (
          serialTrackedProductIds.has(line.productId) &&
          Number(line.qty) < 0
        ) {
          await assertAdjustmentSerialsAvailable(
            ctx,
            orgId,
            line.productId,
            line.lotId,
            line.serialNumbers,
            adjustment.locationId,
          );
        }
        const balance = await ctx.stock.findBalance({
          orgId,
          productId: line.productId,
          locationId: adjustment.locationId,
          lotId: line.lotId,
        });
        if (Number(balance?.qtyOnHand ?? "0") + Number(line.qty) < 0) {
          throw new InsufficientStockError(
            "Posting stock adjustment would create negative stock",
          );
        }
      }

      const movements: StockMovement[] = [];
      for (const line of adjustment.lines) {
        const qty = signedQtyForMovement("adjustment", line.qty);
        const balanceKey = {
          orgId,
          productId: line.productId,
          locationId: adjustment.locationId,
          lotId: line.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const movement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "stock_adjustment",
          documentId: adjustment.id,
          documentLineId: line.id,
          movementType: "adjustment",
          qty,
        });
        const absQty = String(Math.abs(Number(line.qty)));
        const costs =
          Number(line.qty) > 0
            ? await createLayerForMovement(ctx, {
                orgId,
                productId: line.productId,
                locationId: adjustment.locationId,
                lotId: line.lotId,
                qty: absQty,
                unitCost: line.unitCost ?? "",
                movementId: movement.id,
                sourceDocumentType: "stock_adjustment",
                sourceDocumentId: adjustment.id,
                sourceDocumentLineId: line.id,
              })
            : await consumeFifoForMovement(ctx, {
                orgId,
                productId: line.productId,
                locationId: adjustment.locationId,
                lotId: line.lotId,
                qty: absQty,
                movementId: movement.id,
              });
        movements.push(
          await ctx.stock.updateMovementCosts(
            orgId,
            movement.id,
            costs.unitCost,
            Number(line.qty) < 0
              ? String(-Math.abs(Number(costs.totalCost)))
              : costs.totalCost,
          ),
        );
        await ctx.stock.setBalance(
          balanceKey,
          String(Number(balance?.qtyOnHand ?? "0") + Number(qty)),
        );
        if (
          serialTrackedProductIds.has(line.productId) &&
          Number(line.qty) < 0
        ) {
          await updateAdjustmentSerialStatuses(
            ctx,
            orgId,
            line.productId,
            line.serialNumbers,
            "issued",
          );
        } else if (serialTrackedProductIds.has(line.productId)) {
          for (const serialNumber of line.serialNumbers) {
            await ctx.serials.upsert({
              orgId,
              productId: line.productId,
              lotId: line.lotId,
              locationId: adjustment.locationId,
              serialNumber,
            });
          }
        }
      }

      const posted = await adjustments.updateStatus(
        orgId,
        adjustment.id,
        "posted",
        new Date(),
      );
      const result = { adjustment: posted, movements };
      await enqueueAdjustmentEvents(
        ctx,
        orgId,
        userId,
        adjustment.id,
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

export class VoidStockAdjustment {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    adjustmentId: string,
  ): Promise<StockAdjustmentResult> {
    return this.uow.run(async (ctx) => {
      const adjustments = ctx.adjustments;
      if (!adjustments)
        throw new Error("Stock adjustment port is not configured");
      const adjustment = await adjustments.findById(orgId, adjustmentId);
      if (!adjustment) throw new NotFoundError("Stock adjustment");
      if (adjustment.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void stock adjustment in status ${adjustment.status}`,
        );
      }

      const postedMovements = (
        await ctx.stock.listMovements(orgId, {
          documentType: "stock_adjustment",
          documentId: adjustment.id,
        })
      ).filter((movement) => movement.movementType === "adjustment");
      for (const movement of postedMovements) {
        const balance = await ctx.stock.findBalance({
          orgId,
          productId: movement.productId,
          locationId: movement.locationId,
          lotId: movement.lotId,
        });
        if (Number(balance?.qtyOnHand ?? "0") - Number(movement.qty) < 0) {
          throw new InsufficientStockError(
            "Voiding stock adjustment would create negative stock",
          );
        }
      }

      const inboundLayers = await ctx.costing.listLayersBySourceDocument(
        orgId,
        "stock_adjustment",
        adjustment.id,
      );
      assertLayersFullyOpen(inboundLayers);

      const movements: StockMovement[] = [];
      const voidMovementIdByForwardId = new Map<string, string>();
      const consumeForwardIds: string[] = [];
      for (const postedMovement of postedMovements) {
        const qty = signedQtyForMovement("adjustment_void", postedMovement.qty);
        const balanceKey = {
          orgId,
          productId: postedMovement.productId,
          locationId: postedMovement.locationId,
          lotId: postedMovement.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const voidMovement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "stock_adjustment",
          documentId: adjustment.id,
          documentLineId: postedMovement.documentLineId,
          movementType: "adjustment_void",
          qty,
          unitCost: postedMovement.unitCost,
          totalCost: postedMovement.totalCost
            ? String(-Number(postedMovement.totalCost))
            : null,
        });
        movements.push(voidMovement);
        if (Number(postedMovement.qty) < 0) {
          voidMovementIdByForwardId.set(postedMovement.id, voidMovement.id);
          consumeForwardIds.push(postedMovement.id);
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

      const voided = await adjustments.updateStatus(
        orgId,
        adjustment.id,
        "void",
        new Date(),
      );
      await enqueueAdjustmentEvents(
        ctx,
        orgId,
        userId,
        adjustment.id,
        "voided",
        movements,
      );
      return { adjustment: voided, movements };
    });
  }
}

async function assertAdjustmentSerialsAvailable(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  productId: string,
  lotId: string | null,
  serialNumbers: string[],
  locationId: string,
): Promise<void> {
  if (serialNumbers.length === 0) return;
  if (!ctx.serials.findByNumber) {
    throw new Error("Serial lookup is not configured");
  }
  for (const serialNumber of serialNumbers) {
    const serial = await ctx.serials.findByNumber(
      orgId,
      productId,
      serialNumber,
    );
    if (!serial || (lotId !== null && serial.lotId !== lotId)) {
      throw new ConflictError(`Serial ${serialNumber} is not available`);
    }
    assertSerialAvailableForOutbound(serial, locationId);
  }
}

async function updateAdjustmentSerialStatuses(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  productId: string,
  serialNumbers: string[],
  status: "issued",
): Promise<void> {
  if (serialNumbers.length === 0) return;
  if (!ctx.serials.findByNumber || !ctx.serials.updateStatus) {
    throw new Error("Serial status updates are not configured");
  }
  for (const serialNumber of serialNumbers) {
    const serial = await ctx.serials.findByNumber(
      orgId,
      productId,
      serialNumber,
    );
    if (!serial) throw new NotFoundError("Serial");
    await ctx.serials.updateStatus(orgId, serial.id, status);
  }
}

async function enqueueAdjustmentEvents(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  userId: string,
  adjustmentId: string,
  action: "posted" | "voided",
  movements: StockMovement[],
): Promise<void> {
  await ctx.outbox.enqueue({
    orgId,
    eventType: action === "posted" ? "document.posted" : "document.voided",
    aggregateType: "stock_adjustment",
    aggregateId: adjustmentId,
      payload: {
      adjustmentId,
      userId,
      ...costingFieldsFromMovements(movements),
    },
  });
  await ctx.outbox.enqueue({
    orgId,
    eventType: "stock.changed",
    aggregateType: "stock_adjustment",
    aggregateId: adjustmentId,
    payload: { adjustmentId, movementIds: movements.map(({ id }) => id) },
  });
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
