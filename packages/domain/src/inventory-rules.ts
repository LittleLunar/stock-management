import type {
  ApprovalPolicy,
  CustomerReturn,
  GoodsReceipt,
  Product,
  PurchaseOrder,
  Serial,
  StockAdjustment,
  StockCount,
  StockIssue,
  StockReservation,
  StockTransfer,
  SupplierReturn,
} from "./entities.js";
import type {
  DocumentStatus,
  MovementType,
  SerialStatus,
  TransferPurpose,
} from "./types.js";
import {
  InsufficientAvailabilityError,
  InvalidStateError,
  OverReceiveError,
  TrackingRequiredError,
} from "./errors.js";

/**
 * replenishment requires distinct branches.
 * standard: always ok (same or cross branch).
 */
export function assertTransferPurpose(
  purpose: TransferPurpose,
  fromBranchId: string,
  toBranchId: string,
): void {
  if (purpose === "replenishment" && fromBranchId === toBranchId) {
    throw new InvalidStateError(
      "Replenishment transfers require distinct from and to branches",
    );
  }
}

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

export function assertCanApprovePo(po: Pick<PurchaseOrder, "status">): void {
  if (po.status !== "submitted") {
    throw new InvalidStateError(
      `Cannot approve purchase order in status ${po.status}`,
    );
  }
}

export function assertPoReceivable(
  po: Pick<PurchaseOrder, "status">,
  policy: Pick<ApprovalPolicy, "required">,
): void {
  const allowed = policy.required
    ? (["approved", "partially_received", "received"] as const)
    : (["submitted", "approved", "partially_received", "received"] as const);
  if (!(allowed as readonly string[]).includes(po.status)) {
    throw new InvalidStateError(
      policy.required
        ? `Purchase order must be approved before goods receipt (status ${po.status})`
        : `Cannot receive against purchase order in status ${po.status}`,
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

export function assertCanPostSupplierReturn(
  doc: Pick<SupplierReturn, "status">,
): void {
  assertDraftDocument(doc.status, "supplier return");
}

export function assertCanPostCustomerReturn(
  doc: Pick<CustomerReturn, "status">,
): void {
  assertDraftDocument(doc.status, "customer return");
}

export function assertCanSubmitAdjustment(
  adj: Pick<StockAdjustment, "status">,
): void {
  if (adj.status !== "draft") {
    throw new InvalidStateError(
      `Cannot submit stock adjustment in status ${adj.status}`,
    );
  }
}

export function assertCanApproveAdjustment(
  adj: Pick<StockAdjustment, "status">,
): void {
  if (adj.status !== "pending_approval") {
    throw new InvalidStateError(
      `Cannot approve stock adjustment in status ${adj.status}`,
    );
  }
}

export function assertCanPostAdjustment(
  adj: Pick<StockAdjustment, "status">,
  policy: Pick<ApprovalPolicy, "required">,
): void {
  if (policy.required) {
    if (adj.status !== "approved") {
      throw new InvalidStateError(
        `Cannot post stock adjustment in status ${adj.status}; approval required`,
      );
    }
    return;
  }
  if (adj.status !== "draft" && adj.status !== "approved") {
    throw new InvalidStateError(
      `Cannot post stock adjustment in status ${adj.status}`,
    );
  }
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

export function assertSerialAvailableForOutbound(
  serial: Pick<Serial, "status" | "locationId">,
  sourceLocationId: string,
): void {
  if (serial.status !== "in_stock") {
    throw new InvalidStateError("Serial is not in stock");
  }
  if (serial.locationId !== sourceLocationId) {
    throw new InvalidStateError("Serial is not at the source location");
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
    movementType === "transfer_in" ||
    movementType === "supplier_return_void" ||
    movementType === "customer_return"
  ) {
    return formatQty(absoluteQty);
  }

  if (
    movementType === "receipt_void" ||
    movementType === "issue" ||
    movementType === "transfer_out" ||
    movementType === "transfer_in_void" ||
    movementType === "supplier_return" ||
    movementType === "customer_return_void"
  ) {
    return formatQty(-absoluteQty);
  }

  if (movementType === "adjustment" || movementType === "count_variance") {
    return formatQty(parsedQty);
  }

  return formatQty(-parsedQty);
}

export type ReservationExpiryFields = Pick<StockReservation, "expiresAt">;

export type ReservationAvailabilityFields = Pick<
  StockReservation,
  "status" | "qty" | "expiresAt"
>;

export function isReservationExpired(
  reservation: ReservationExpiryFields,
  now: Date,
): boolean {
  return reservation.expiresAt != null && reservation.expiresAt <= now;
}

export function availableQty(onHand: string, reserved: string): string {
  return formatQty(Math.max(0, parseQty(onHand) - parseQty(reserved)));
}

export function effectiveReservedQty(
  reservations: ReservationAvailabilityFields[],
  now: Date,
): string {
  const total = reservations.reduce((sum, reservation) => {
    if (reservation.status !== "open") {
      return sum;
    }
    if (isReservationExpired(reservation, now)) {
      return sum;
    }
    return sum + parseQty(reservation.qty);
  }, 0);
  return formatQty(total);
}

export function assertCanReserve(available: string, qty: string): void {
  const reserveQty = parseQty(qty);
  if (reserveQty <= 0) {
    throw new InvalidStateError("Reserve quantity must be positive");
  }
  if (reserveQty > parseQty(available)) {
    throw new InsufficientAvailabilityError(
      `Reserve quantity ${qty} exceeds available ${available}`,
    );
  }
}

export function assertReservationOpen(
  reservation: Pick<StockReservation, "status">,
): void {
  if (reservation.status !== "open") {
    throw new InvalidStateError(
      `Reservation must be open (status ${reservation.status})`,
    );
  }
}

export function assertCanCommitReservation(
  reservation: Pick<StockReservation, "status" | "expiresAt">,
  now: Date,
): void {
  assertReservationOpen(reservation);
  if (isReservationExpired(reservation, now)) {
    throw new InvalidStateError(
      "Cannot commit an expired reservation; release it instead",
    );
  }
}

export function assertCanReleaseReservation(
  reservation: Pick<StockReservation, "status">,
  _now?: Date,
): void {
  void _now;
  assertReservationOpen(reservation);
}

export function serialStatusAfterSupplierReturn(): SerialStatus {
  return "returned";
}

export function serialStatusAfterCustomerReturn(): SerialStatus {
  return "in_stock";
}
