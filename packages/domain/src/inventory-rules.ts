import type { GoodsReceipt, Product, PurchaseOrder } from "./entities.js";
import type { MovementType } from "./types.js";
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

export function signedQtyForMovement(
  movementType: MovementType,
  qty: string,
): string {
  const absoluteQty = Math.abs(parseQty(qty));

  if (movementType === "receipt") {
    return formatQty(absoluteQty);
  }

  if (movementType === "receipt_void") {
    return formatQty(-absoluteQty);
  }

  throw new InvalidStateError(`Unsupported movement type: ${movementType}`);
}
