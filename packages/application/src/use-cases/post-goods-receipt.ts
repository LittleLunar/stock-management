import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
  assertCanPostReceipt,
  assertFifoCostingMethod,
  assertLotSerialRules,
  assertNoOverReceive,
  resolveReceiptUnitCost,
  signedQtyForMovement,
  totalCost,
} from "@stock-management/domain";
import type {
  GoodsReceipt,
  PurchaseOrderLine,
  StockMovement,
} from "@stock-management/domain";
import type { IdempotencyInput } from "../dto/inputs.js";
import type { GoodsReceiptLineDetails } from "../ports/inventory.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

const OPERATION = "post-goods-receipt";

export type PostGoodsReceiptResult = {
  receipt: GoodsReceipt;
  movements: StockMovement[];
};

function addQty(left: string, right: string): string {
  return String(Number(left) + Number(right));
}

export class PostGoodsReceipt {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    receiptId: string,
    idempotency?: IdempotencyInput,
  ): Promise<PostGoodsReceiptResult> {
    return this.uow.run(async (ctx) => {
      if (idempotency) {
        const existing = await ctx.idempotency.find(
          orgId,
          OPERATION,
          idempotency.externalSystem,
          idempotency.externalId,
        );
        if (existing) return existing.result as PostGoodsReceiptResult;
      }

      const receipt = await ctx.gr.findById(orgId, receiptId);
      if (!receipt) throw new NotFoundError("Goods receipt");
      assertCanPostReceipt(receipt);

      const poLineReceipts = new Map<
        string,
        { line: PurchaseOrderLine; receivingQty: string }
      >();

      for (const line of receipt.lines) {
        const product = await ctx.products.findById(orgId, line.productId);
        if (!product) throw new NotFoundError("Product");

        assertLotSerialRules(product, {
          lotId: line.lotId ?? line.lotCode,
          serialNumbers: line.serialNumbers,
        });

        if (line.purchaseOrderLineId) {
          const poLine = await ctx.po.findLineById(orgId, line.purchaseOrderLineId);
          if (!poLine) throw new NotFoundError("Purchase order line");
          this.assertPoLineMatchesReceipt(receipt, line, poLine);

          const accumulated = poLineReceipts.get(poLine.id)?.receivingQty ?? "0";
          const receivingQty = addQty(accumulated, line.qty);
          assertNoOverReceive(poLine.orderedQty, poLine.receivedQty, receivingQty);
          poLineReceipts.set(poLine.id, { line: poLine, receivingQty });
        }
      }

      const movements: StockMovement[] = [];
      const receivedAt = new Date();
      for (const line of receipt.lines) {
        const product = await ctx.products.findById(orgId, line.productId);
        if (!product) throw new NotFoundError("Product");
        assertFifoCostingMethod(product.costingMethod);

        const poLine = line.purchaseOrderLineId
          ? await ctx.po.findLineById(orgId, line.purchaseOrderLineId)
          : null;
        const unitCost = resolveReceiptUnitCost(line.unitCost, poLine?.unitCost);
        const lineTotalCost = totalCost(unitCost, line.qty);

        const lotId = await this.resolveLotId(ctx, orgId, line);
        for (const serialNumber of line.serialNumbers) {
          await ctx.serials.upsert({
            orgId,
            productId: line.productId,
            lotId,
            serialNumber,
          });
        }

        const qty = signedQtyForMovement("receipt", line.qty);
        const movement = await ctx.stock.insertMovement({
          orgId,
          productId: line.productId,
          locationId: receipt.locationId,
          lotId,
          documentType: "goods_receipt",
          documentId: receipt.id,
          documentLineId: line.id,
          movementType: "receipt",
          qty,
          unitCost,
          totalCost: lineTotalCost,
        });
        movements.push(movement);

        await ctx.costing.insertLayer({
          orgId,
          productId: line.productId,
          locationId: receipt.locationId,
          lotId,
          sourceDocumentType: "goods_receipt",
          sourceDocumentId: receipt.id,
          sourceDocumentLineId: line.id,
          sourceMovementId: movement.id,
          receivedAt,
          unitCost,
          qtyOriginal: line.qty,
          qtyRemaining: line.qty,
        });

        const balanceKey = {
          orgId,
          productId: line.productId,
          locationId: receipt.locationId,
          lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const nextQty = addQty(balance?.qtyOnHand ?? "0", qty);
        if (Number(nextQty) < 0) {
          throw new InsufficientStockError("Posting would create negative stock");
        }
        await ctx.stock.setBalance(balanceKey, nextQty);
      }

      for (const { line, receivingQty } of poLineReceipts.values()) {
        await ctx.po.updateLineReceivedQty(
          orgId,
          line.id,
          addQty(line.receivedQty, receivingQty),
        );
      }
      await this.updatePurchaseOrderStatus(ctx, orgId, receipt.purchaseOrderId);

      const postedAt = new Date();
      const postedReceipt = await ctx.gr.updateStatus(
        orgId,
        receipt.id,
        "posted",
        postedAt,
      );
      const result = { receipt: postedReceipt, movements };

      await ctx.outbox.enqueue({
        orgId,
        eventType: "document.posted",
        aggregateType: "goods_receipt",
        aggregateId: receipt.id,
        payload: { receiptId: receipt.id, userId },
      });
      await ctx.outbox.enqueue({
        orgId,
        eventType: "stock.changed",
        aggregateType: "goods_receipt",
        aggregateId: receipt.id,
        payload: {
          receiptId: receipt.id,
          movementIds: movements.map((movement) => movement.id),
        },
      });

      if (idempotency) {
        await ctx.idempotency.save({
          orgId,
          operation: OPERATION,
          externalSystem: idempotency.externalSystem,
          externalId: idempotency.externalId,
          result,
        });
      }

      return result;
    });
  }

  private assertPoLineMatchesReceipt(
    receipt: GoodsReceipt,
    line: GoodsReceiptLineDetails,
    poLine: PurchaseOrderLine,
  ): void {
    if (
      !receipt.purchaseOrderId ||
      poLine.purchaseOrderId !== receipt.purchaseOrderId ||
      poLine.productId !== line.productId
    ) {
      throw new ConflictError("Goods receipt line does not match its purchase order");
    }
  }

  private async resolveLotId(
    ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
    orgId: string,
    line: GoodsReceiptLineDetails,
  ): Promise<string | null> {
    if (!line.lotId && !line.lotCode) return null;
    const lot = await ctx.lots.upsert({
      orgId,
      productId: line.productId,
      lotId: line.lotId,
      lotCode: line.lotCode,
      expiryDate: line.expiryDate,
    });
    if (line.lotId !== lot.id) {
      await ctx.gr.setLineLotId(orgId, line.id, lot.id);
    }
    return lot.id;
  }

  private async updatePurchaseOrderStatus(
    ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
    orgId: string,
    purchaseOrderId: string | null,
  ): Promise<void> {
    if (!purchaseOrderId) return;
    const po = await ctx.po.findById(orgId, purchaseOrderId);
    if (!po) throw new NotFoundError("Purchase order");

    const fullyReceived = po.lines.every(
      (line) => Number(line.receivedQty) >= Number(line.orderedQty),
    );
    const partiallyReceived = po.lines.some((line) => Number(line.receivedQty) > 0);
    await ctx.po.updateStatus(
      orgId,
      po.id,
      fullyReceived ? "received" : partiallyReceived ? "partially_received" : "submitted",
    );
  }
}
