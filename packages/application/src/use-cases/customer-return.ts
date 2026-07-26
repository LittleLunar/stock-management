import {
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  assertCanPostCustomerReturn,
  assertLotSerialRules,
  serialStatusAfterCustomerReturn,
  signedQtyForMovement,
} from "@stock-management/domain";
import type {
  CustomerReturn,
  Serial,
  StockMovement,
} from "@stock-management/domain";
import type {
  CreateCustomerReturnInput,
  IdempotencyInput,
  UpdateCustomerReturnInput,
} from "../dto/inputs.js";
import type { CustomerReturnPort } from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";

export type CustomerReturnResult = {
  doc: CustomerReturn;
  movements: StockMovement[];
};

export class CustomerReturnUseCases {
  constructor(private readonly repo: CustomerReturnPort) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const doc = await this.repo.findById(orgId, id);
    if (!doc) throw new NotFoundError("Customer return");
    return doc;
  }

  create(orgId: string, input: CreateCustomerReturnInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateCustomerReturnInput) {
    const doc = await this.get(orgId, id);
    if (doc.status !== "draft") {
      throw new InvalidStateError("Only draft customer returns can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Customer return");
    return updated;
  }
}

const POST_OPERATION = "post-customer-return";

export class PostCustomerReturn {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    returnId: string,
    idempotency?: IdempotencyInput,
  ): Promise<CustomerReturnResult> {
    return this.uow.run(async (ctx) => {
      const returns = requireCustomerReturns(ctx);

      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          POST_OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as CustomerReturnResult;
      }

      const doc = await returns.findById(orgId, returnId);
      if (!doc) throw new NotFoundError("Customer return");
      assertCanPostCustomerReturn(doc);

      for (const line of doc.lines) {
        const product = await ctx.products.findById(orgId, line.productId);
        if (!product) throw new NotFoundError("Product");
        assertLotSerialRules(product, {
          lotId: line.lotId,
          serialNumbers: line.serialNumbers,
        });
      }

      const movements: StockMovement[] = [];
      for (const line of doc.lines) {
        for (const serialNumber of line.serialNumbers) {
          await ctx.serials.upsert({
            orgId,
            productId: line.productId,
            lotId: line.lotId,
            locationId: doc.locationId,
            serialNumber,
          });
          await setSerialStatus(
            ctx,
            orgId,
            line.productId,
            serialNumber,
            serialStatusAfterCustomerReturn(),
          );
        }

        const qty = signedQtyForMovement("customer_return", line.qty);
        const balanceKey = {
          orgId,
          productId: line.productId,
          locationId: doc.locationId,
          lotId: line.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        movements.push(
          await ctx.stock.insertMovement({
            ...balanceKey,
            documentType: "customer_return",
            documentId: doc.id,
            documentLineId: line.id,
            movementType: "customer_return",
            qty,
          }),
        );
        await ctx.stock.setBalance(
          balanceKey,
          String(Number(balance?.qtyOnHand ?? "0") + Number(qty)),
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
        "customer_return",
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

export class VoidCustomerReturn {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    returnId: string,
  ): Promise<CustomerReturnResult> {
    return this.uow.run(async (ctx) => {
      const returns = requireCustomerReturns(ctx);
      const doc = await returns.findById(orgId, returnId);
      if (!doc) throw new NotFoundError("Customer return");
      if (doc.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void customer return in status ${doc.status}`,
        );
      }

      const postedMovements = (
        await ctx.stock.listMovements(orgId, {
          documentType: "customer_return",
          documentId: doc.id,
        })
      ).filter((movement) => movement.movementType === "customer_return");

      const movements: StockMovement[] = [];
      for (const posted of postedMovements) {
        const qty = signedQtyForMovement("customer_return_void", posted.qty);
        const balanceKey = {
          orgId,
          productId: posted.productId,
          locationId: posted.locationId,
          lotId: posted.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const nextQty = String(Number(balance?.qtyOnHand ?? "0") + Number(qty));
        if (Number(nextQty) < 0) {
          throw new InsufficientStockError(
            "Voiding customer return would create negative stock",
          );
        }
        movements.push(
          await ctx.stock.insertMovement({
            ...balanceKey,
            documentType: "customer_return",
            documentId: doc.id,
            documentLineId: posted.documentLineId,
            movementType: "customer_return_void",
            qty,
          }),
        );
        await ctx.stock.setBalance(balanceKey, nextQty);
      }
      for (const line of doc.lines) {
        for (const serialNumber of line.serialNumbers) {
          await setSerialStatus(ctx, orgId, line.productId, serialNumber, "issued");
        }
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
        "customer_return",
        "voided",
        movements,
      );
      return { doc: voided, movements };
    });
  }
}

function requireCustomerReturns(ctx: UowContext): CustomerReturnPort {
  if (!ctx.customerReturns) {
    throw new Error("Customer return port is not configured");
  }
  return ctx.customerReturns;
}

async function setSerialStatus(
  ctx: UowContext,
  orgId: string,
  productId: string,
  serialNumber: string,
  status: Serial["status"],
): Promise<void> {
  if (!ctx.serials.findByNumber || !ctx.serials.updateStatus) {
    throw new Error("Serial status updates are not configured");
  }
  const serial = await ctx.serials.findByNumber(orgId, productId, serialNumber);
  if (!serial) throw new NotFoundError("Serial");
  await ctx.serials.updateStatus(orgId, serial.id, status);
}

async function enqueueReturnEvents(
  ctx: UowContext,
  orgId: string,
  userId: string,
  returnId: string,
  aggregateType: string,
  action: "posted" | "voided",
  movements: StockMovement[],
): Promise<void> {
  await ctx.outbox.enqueue({
    orgId,
    eventType: action === "posted" ? "document.posted" : "document.voided",
    aggregateType,
    aggregateId: returnId,
    payload: { returnId, userId },
  });
  await ctx.outbox.enqueue({
    orgId,
    eventType: "stock.changed",
    aggregateType,
    aggregateId: returnId,
    payload: { returnId, movementIds: movements.map(({ id }) => id) },
  });
}
