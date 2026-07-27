import {
  ConflictError,
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  assertCanPostSupplierReturn,
  assertLotSerialRules,
  assertSerialAvailableForOutbound,
  serialStatusAfterSupplierReturn,
  signedQtyForMovement,
} from "@stock-management/domain";
import type {
  Serial,
  StockMovement,
  SupplierReturn,
} from "@stock-management/domain";
import type {
  CreateSupplierReturnInput,
  IdempotencyInput,
  UpdateSupplierReturnInput,
} from "../dto/inputs.js";
import {
  consumeFifoForMovement,
  restoreConsumptionsForVoidedMovements,
} from "../costing/apply-document-costing.js";
import { costingOutboxFields } from "../costing/outbox-cost-fields.js";
import type { BranchListFilter } from "../access/list-scope.js";
import type { SupplierReturnPort } from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";

export type SupplierReturnResult = {
  doc: SupplierReturn;
  movements: StockMovement[];
};

export class SupplierReturnUseCases {
  constructor(private readonly repo: SupplierReturnPort) {}

  list(orgId: string, filter?: BranchListFilter) {
    return this.repo.list(orgId, filter);
  }

  async get(orgId: string, id: string) {
    const doc = await this.repo.findById(orgId, id);
    if (!doc) throw new NotFoundError("Supplier return");
    return doc;
  }

  create(orgId: string, input: CreateSupplierReturnInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateSupplierReturnInput) {
    const doc = await this.get(orgId, id);
    if (doc.status !== "draft") {
      throw new InvalidStateError("Only draft supplier returns can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Supplier return");
    return updated;
  }
}

const POST_OPERATION = "post-supplier-return";

export class PostSupplierReturn {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    returnId: string,
    idempotency?: IdempotencyInput,
  ): Promise<SupplierReturnResult> {
    return this.uow.run(async (ctx) => {
      const returns = requireSupplierReturns(ctx);

      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          POST_OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as SupplierReturnResult;
      }

      const doc = await returns.findById(orgId, returnId);
      if (!doc) throw new NotFoundError("Supplier return");
      assertCanPostSupplierReturn(doc);

      for (const line of doc.lines) {
        const product = await ctx.products.findById(orgId, line.productId);
        if (!product) throw new NotFoundError("Product");
        assertLotSerialRules(product, {
          lotId: line.lotId,
          serialNumbers: line.serialNumbers,
        });
        await assertSerialsAvailable(
          ctx,
          orgId,
          line.productId,
          line.lotId,
          line.serialNumbers,
          doc.locationId,
        );

        const balance = await ctx.stock.findBalance({
          orgId,
          productId: line.productId,
          locationId: doc.locationId,
          lotId: line.lotId,
        });
        if (Number(balance?.qtyOnHand ?? "0") < Number(line.qty)) {
          throw new InsufficientStockError(
            "Posting supplier return would create negative stock",
          );
        }
      }

      const movements: StockMovement[] = [];
      for (const line of doc.lines) {
        const qty = signedQtyForMovement("supplier_return", line.qty);
        const balanceKey = {
          orgId,
          productId: line.productId,
          locationId: doc.locationId,
          lotId: line.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const movement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "supplier_return",
          documentId: doc.id,
          documentLineId: line.id,
          movementType: "supplier_return",
          qty,
        });
        const costs = await consumeFifoForMovement(ctx, {
          orgId,
          productId: line.productId,
          locationId: doc.locationId,
          lotId: line.lotId,
          qty: line.qty,
          movementId: movement.id,
          preferSourceDocumentLineId: line.goodsReceiptLineId,
        });
        movements.push(
          await ctx.stock.updateMovementCosts(
            orgId,
            movement.id,
            costs.unitCost,
            costs.totalCost,
          ),
        );
        await ctx.stock.setBalance(
          balanceKey,
          String(Number(balance?.qtyOnHand ?? "0") + Number(qty)),
        );
        await updateSerialStatuses(
          ctx,
          orgId,
          line.productId,
          line.serialNumbers,
          serialStatusAfterSupplierReturn(),
        );
      }

      const posted = await returns.updateStatus(
        orgId,
        doc.id,
        "posted",
        new Date(),
      );
      const result = { doc: posted, movements };
      await enqueueReturnEvents(
        ctx,
        orgId,
        userId,
        doc.id,
        "supplier_return",
        "posted",
        movements,
        doc.branchId,
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

export class VoidSupplierReturn {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    returnId: string,
  ): Promise<SupplierReturnResult> {
    return this.uow.run(async (ctx) => {
      const returns = requireSupplierReturns(ctx);
      const doc = await returns.findById(orgId, returnId);
      if (!doc) throw new NotFoundError("Supplier return");
      if (doc.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void supplier return in status ${doc.status}`,
        );
      }

      const postedMovements = (
        await ctx.stock.listMovements(orgId, {
          documentType: "supplier_return",
          documentId: doc.id,
        })
      ).filter((movement) => movement.movementType === "supplier_return");

      const movements: StockMovement[] = [];
      const voidMovementIdByForwardId = new Map<string, string>();
      for (const posted of postedMovements) {
        const qty = signedQtyForMovement("supplier_return_void", posted.qty);
        const balanceKey = {
          orgId,
          productId: posted.productId,
          locationId: posted.locationId,
          lotId: posted.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const voidMovement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "supplier_return",
          documentId: doc.id,
          documentLineId: posted.documentLineId,
          movementType: "supplier_return_void",
          qty,
          unitCost: posted.unitCost,
          totalCost: posted.totalCost
            ? String(-Math.abs(Number(posted.totalCost)))
            : null,
        });
        voidMovementIdByForwardId.set(posted.id, voidMovement.id);
        movements.push(voidMovement);
        await ctx.stock.setBalance(
          balanceKey,
          String(Number(balance?.qtyOnHand ?? "0") + Number(qty)),
        );
      }
      await restoreConsumptionsForVoidedMovements(ctx, {
        orgId,
        forwardMovementIds: postedMovements.map((movement) => movement.id),
        voidMovementIdByForwardId,
      });
      for (const line of doc.lines) {
        await updateSerialStatuses(
          ctx,
          orgId,
          line.productId,
          line.serialNumbers,
          "in_stock",
        );
      }

      const voided = await returns.updateStatus(
        orgId,
        doc.id,
        "void",
        new Date(),
      );
      await enqueueReturnEvents(
        ctx,
        orgId,
        userId,
        doc.id,
        "supplier_return",
        "voided",
        movements,
        doc.branchId,
      );
      return { doc: voided, movements };
    });
  }
}

function requireSupplierReturns(ctx: UowContext): SupplierReturnPort {
  if (!ctx.supplierReturns) {
    throw new Error("Supplier return port is not configured");
  }
  return ctx.supplierReturns;
}

async function assertSerialsAvailable(
  ctx: UowContext,
  orgId: string,
  productId: string,
  lotId: string | null,
  serialNumbers: string[],
  sourceLocationId: string,
): Promise<void> {
  if (serialNumbers.length === 0) return;
  if (!ctx.serials.findByNumber) {
    throw new Error("Serial lookup is not configured");
  }
  for (const serialNumber of serialNumbers) {
    const serial = await ctx.serials.findByNumber(orgId, productId, serialNumber);
    if (!serial || (lotId !== null && serial.lotId !== lotId)) {
      throw new ConflictError(`Serial ${serialNumber} is not available`);
    }
    assertSerialAvailableForOutbound(serial, sourceLocationId);
  }
}

async function updateSerialStatuses(
  ctx: UowContext,
  orgId: string,
  productId: string,
  serialNumbers: string[],
  status: Serial["status"],
): Promise<void> {
  if (serialNumbers.length === 0) return;
  if (!ctx.serials.findByNumber || !ctx.serials.updateStatus) {
    throw new Error("Serial status updates are not configured");
  }
  for (const serialNumber of serialNumbers) {
    const serial = await ctx.serials.findByNumber(orgId, productId, serialNumber);
    if (!serial) throw new NotFoundError("Serial");
    await ctx.serials.updateStatus(orgId, serial.id, status);
  }
}

async function enqueueReturnEvents(
  ctx: UowContext,
  orgId: string,
  userId: string,
  returnId: string,
  aggregateType: string,
  action: "posted" | "voided",
  movements: StockMovement[],
  branchId: string,
): Promise<void> {
  await ctx.outbox.enqueue({
    orgId,
    eventType: action === "posted" ? "document.posted" : "document.voided",
    aggregateType,
    aggregateId: returnId,
      payload: {
      returnId,
      userId,
      branchId,
      ...costingOutboxFields({
        cogsTotal: String(
          movements.reduce(
            (sum, m) => sum + Math.abs(Number(m.totalCost ?? 0)),
            0,
          ),
        ),
      }),
    },
  });
  await ctx.outbox.enqueue({
    orgId,
    eventType: "stock.changed",
    aggregateType,
    aggregateId: returnId,
    payload: { returnId, movementIds: movements.map(({ id }) => id) },
  });
}
