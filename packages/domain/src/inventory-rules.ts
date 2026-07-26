import type {
  GoodsReceipt,
  Product,
  PurchaseOrder,
  StockAdjustment,
  StockCount,
  StockIssue,
  StockTransfer,
} from "./entities.js";
import type { DocumentStatus, MovementType } from "./types.js";
import {
  InvalidStateError,
  OverReceiveError,
  TrackingRequiredError,
} from "./errors.js";

export type ReceiptLineTracking = {
  lotId?: string | null;
  serialNumbers?: string[];
};

export type ProductTrackingFlags = Pick<Product, "trackLot" | "trackSerial">;

function parseQty(qty: string): number {
  const value = Number(qty);
  if (!Number.isFinite(value)) {
    throw new InvalidStateError(`Invalid quantity: ${qty}`);
  }
  return value;
}

function formatQty(value: number): string {
  return String(value);
}

export function assertCanSubmitPo(po: Pick<PurchaseOrder, "status">): void {
  if (po.status !== "draft") {
    throw new InvalidStateError(
      `Cannot submit purchase order in status ${po.status}`,
    );
  }
}

export function assertCanPostReceipt(
  receipt: Pick<GoodsReceipt, "status">,
): void {
  if (receipt.status !== "draft") {
    throw new InvalidStateError(
      `Cannot post goods receipt in status ${receipt.status}`,
    );
  }
}

function assertDraftDocument(
  status: DocumentStatus,
  documentName: string,
): void {
  if (status !== "draft") {
    throw new InvalidStateError(
      `Cannot post ${documentName} in status ${status}`,
    );
  }
}

export function assertCanPostIssue(issue: Pick<StockIssue, "status">): void {
  assertDraftDocument(issue.status, "stock issue");
}

export function assertCanPostAdjustment(
  adjustment: Pick<StockAdjustment, "status">,
): void {
  assertDraftDocument(adjustment.status, "stock adjustment");
}

export function assertCanPostCount(count: Pick<StockCount, "status">): void {
  assertDraftDocument(count.status, "stock count");
}

export function assertCanShipTransfer(
  transfer: Pick<StockTransfer, "status">,
): void {
  if (transfer.status !== "draft") {
    throw new InvalidStateError(
      `Cannot ship stock transfer in status ${transfer.status}`,
    );
  }
}

export function assertCanReceiveTransfer(
  transfer: Pick<StockTransfer, "status">,
): void {
  if (transfer.status !== "in_transit") {
    throw new InvalidStateError(
      `Cannot receive stock transfer in status ${transfer.status}`,
    );
  }
}

export function assertCanVoidTransfer(
  transfer: Pick<StockTransfer, "status">,
): void {
  if (transfer.status !== "draft" && transfer.status !== "in_transit") {
    throw new InvalidStateError(
      `Cannot void stock transfer in status ${transfer.status}`,
    );
  }
}

export function assertLotSerialRules(
  product: ProductTrackingFlags,
  line: ReceiptLineTracking,
): void {
  if (product.trackLot && !line.lotId) {
    throw new TrackingRequiredError("Lot is required for this product");
  }

  if (product.trackSerial) {
    const serialNumbers = line.serialNumbers ?? [];
    if (serialNumbers.length === 0) {
      throw new TrackingRequiredError(
        "Serial number(s) required for this product",
      );
    }
  }
}

export function assertNoOverReceive(
  orderedQty: string,
  alreadyReceivedQty: string,
  receivingQty: string,
): void {
  const ordered = parseQty(orderedQty);
  const alreadyReceived = parseQty(alreadyReceivedQty);
  const receiving = parseQty(receivingQty);

  if (alreadyReceived + receiving > ordered) {
    throw new OverReceiveError(
      `Receive quantity ${receivingQty} would exceed remaining ordered quantity`,
    );
  }
}

export function countVariance(expectedQty: string, countedQty: string): string {
  return formatQty(parseQty(countedQty) - parseQty(expectedQty));
}

export function assertSignedAdjustmentQty(qty: string): void {
  if (parseQty(qty) === 0) {
    throw new InvalidStateError("Adjustment quantity must be non-zero");
  }
}

export function signedQtyForMovement(
  movementType: MovementType,
  qty: string,
): string {
  const parsedQty = parseQty(qty);
  const absoluteQty = Math.abs(parsedQty);

  if (
    movementType === "receipt" ||
    movementType === "issue_void" ||
    movementType === "transfer_out_void" ||
    movementType === "transfer_in"
  ) {
    return formatQty(absoluteQty);
  }

  if (
    movementType === "receipt_void" ||
    movementType === "issue" ||
    movementType === "transfer_out" ||
    movementType === "transfer_in_void"
  ) {
    return formatQty(-absoluteQty);
  }

  if (movementType === "adjustment" || movementType === "count_variance") {
    return formatQty(parsedQty);
  }

  return formatQty(-parsedQty);
}
