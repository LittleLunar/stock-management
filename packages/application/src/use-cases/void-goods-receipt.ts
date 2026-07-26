import {
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  signedQtyForMovement,
} from "@stock-management/domain";
import type { GoodsReceipt, StockMovement } from "@stock-management/domain";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export type VoidGoodsReceiptResult = {
  receipt: GoodsReceipt;
  movements: StockMovement[];
};

function addQty(left: string, right: string): string {
  return String(Number(left) + Number(right));
}

export class VoidGoodsReceipt {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    receiptId: string,
  ): Promise<VoidGoodsReceiptResult> {
    return this.uow.run(async (ctx) => {
      const receipt = await ctx.gr.findById(orgId, receiptId);
      if (!receipt) throw new NotFoundError("Goods receipt");
      if (receipt.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void goods receipt in status ${receipt.status}`,
        );
      }

      const postedMovements = (
        await ctx.stock.listMovements(orgId, {
          documentType: "goods_receipt",
          documentId: receipt.id,
        })
      ).filter((movement) => movement.movementType === "receipt");

      const movements: StockMovement[] = [];
      for (const postedMovement of postedMovements) {
        const qty = signedQtyForMovement("receipt_void", postedMovement.qty);
        const balanceKey = {
          orgId,
          productId: postedMovement.productId,
          locationId: postedMovement.locationId,
          lotId: postedMovement.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const nextQty = addQty(balance?.qtyOnHand ?? "0", qty);
        if (Number(nextQty) < 0) {
          throw new InsufficientStockError(
            "Voiding goods receipt would create negative stock",
          );
        }

        movements.push(
          await ctx.stock.insertMovement({
            orgId,
            productId: postedMovement.productId,
            locationId: postedMovement.locationId,
            lotId: postedMovement.lotId,
            documentType: "goods_receipt",
            documentId: receipt.id,
            documentLineId: postedMovement.documentLineId,
            movementType: "receipt_void",
            qty,
          }),
        );
        await ctx.stock.setBalance(balanceKey, nextQty);
      }

      for (const line of receipt.lines) {
        if (!line.purchaseOrderLineId) continue;
        const poLine = await ctx.po.findLineById(orgId, line.purchaseOrderLineId);
        if (!poLine) throw new NotFoundError("Purchase order line");
        await ctx.po.updateLineReceivedQty(
          orgId,
          poLine.id,
          addQty(poLine.receivedQty, signedQtyForMovement("receipt_void", line.qty)),
        );
      }
      await this.restorePurchaseOrderStatus(ctx, orgId, receipt.purchaseOrderId);

      const voidedReceipt = await ctx.gr.updateStatus(
        orgId,
        receipt.id,
        "void",
        new Date(),
      );
      await ctx.outbox.enqueue({
        orgId,
        eventType: "document.voided",
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

      return { receipt: voidedReceipt, movements };
    });
  }

  private async restorePurchaseOrderStatus(
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
