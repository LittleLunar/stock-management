import {
  ConflictError,
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  assertCanReceiveTransfer,
  assertCanShipTransfer,
  assertCanVoidTransfer,
  assertLayersFullyOpen,
  assertLotSerialRules,
  assertSerialAvailableForOutbound,
  signedQtyForMovement,
} from "@stock-management/domain";
import type {
  MovementType,
  StockMovement,
  StockTransfer,
} from "@stock-management/domain";
import type {
  CreateStockTransferInput,
  IdempotencyInput,
  UpdateStockTransferInput,
} from "../dto/inputs.js";
import {
  moveLayersForTransferHop,
  restoreConsumptionsForVoidedMovements,
} from "../costing/apply-document-costing.js";
import type {
  StockTransferPort,
  StockTransferWithLines,
} from "../ports/inventory.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export type StockTransferResult = {
  transfer: StockTransfer;
  movements: StockMovement[];
};

export class StockTransferUseCases {
  constructor(private readonly repo: StockTransferPort) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const transfer = await this.repo.findById(orgId, id);
    if (!transfer) throw new NotFoundError("Stock transfer");
    return transfer;
  }

  create(orgId: string, input: CreateStockTransferInput) {
    assertDistinctLocations(input.fromLocationId, input.toLocationId);
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateStockTransferInput) {
    const transfer = await this.get(orgId, id);
    if (transfer.status !== "draft") {
      throw new InvalidStateError("Only draft stock transfers can be updated");
    }
    assertDistinctLocations(
      input.fromLocationId ?? transfer.fromLocationId,
      input.toLocationId ?? transfer.toLocationId,
    );
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Stock transfer");
    return updated;
  }
}

const SHIP_OPERATION = "ship-stock-transfer";
const RECEIVE_OPERATION = "receive-stock-transfer";

export class ShipStockTransfer {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    transferId: string,
    idempotency?: IdempotencyInput,
  ): Promise<StockTransferResult> {
    return this.uow.run(async (ctx) => {
      const transfers = ctx.transfers;
      if (!transfers) throw new Error("Stock transfer port is not configured");
      const replay = await findReplay(ctx, orgId, SHIP_OPERATION, idempotency);
      if (replay) return replay;

      const transfer = await transfers.findById(orgId, transferId);
      if (!transfer) throw new NotFoundError("Stock transfer");
      assertCanShipTransfer(transfer);
      assertDistinctLocations(transfer.fromLocationId, transfer.toLocationId);
      if (!ctx.locations) throw new Error("Location lookup is not configured");
      const transit = await ctx.locations.findById(
        orgId,
        transfer.transitLocationId,
      );
      if (!transit || transit.type !== "transit") {
        throw new ConflictError(
          "Transfer transit location must be type transit",
        );
      }
      await validateTransferLines(
        ctx,
        orgId,
        transfer.fromLocationId,
        transfer.lines,
      );

      const movements = await moveTransferLines(
        ctx,
        orgId,
        transfer,
        transfer.fromLocationId,
        transfer.transitLocationId,
        "transfer_out",
        "transfer_in",
      );
      await updateTransferSerialLocations(
        ctx,
        orgId,
        transfer.lines,
        transfer.transitLocationId,
      );
      const shipped = await transfers.updateStatus(
        orgId,
        transfer.id,
        "in_transit",
        new Date(),
      );
      const result = { transfer: shipped, movements };
      await enqueueTransferEvents(
        ctx,
        orgId,
        userId,
        transfer.id,
        "shipped",
        movements,
      );
      await saveReplay(ctx, orgId, SHIP_OPERATION, idempotency, result);
      return result;
    });
  }
}

export class ReceiveStockTransfer {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    transferId: string,
    idempotency?: IdempotencyInput,
  ): Promise<StockTransferResult> {
    return this.uow.run(async (ctx) => {
      const transfers = ctx.transfers;
      if (!transfers) throw new Error("Stock transfer port is not configured");
      const replay = await findReplay(
        ctx,
        orgId,
        RECEIVE_OPERATION,
        idempotency,
      );
      if (replay) return replay;

      const transfer = await transfers.findById(orgId, transferId);
      if (!transfer) throw new NotFoundError("Stock transfer");
      assertCanReceiveTransfer(transfer);
      await validateTransferSerialsAtLocation(
        ctx,
        orgId,
        transfer.lines,
        transfer.transitLocationId,
      );
      await validateAvailableStock(
        ctx,
        orgId,
        transfer.transitLocationId,
        transfer.lines,
      );
      const movements = await moveTransferLines(
        ctx,
        orgId,
        transfer,
        transfer.transitLocationId,
        transfer.toLocationId,
        "transfer_out",
        "transfer_in",
      );
      await updateTransferSerialLocations(
        ctx,
        orgId,
        transfer.lines,
        transfer.toLocationId,
      );
      const received = await transfers.updateStatus(
        orgId,
        transfer.id,
        "received",
        new Date(),
      );
      const result = { transfer: received, movements };
      await enqueueTransferEvents(
        ctx,
        orgId,
        userId,
        transfer.id,
        "received",
        movements,
      );
      await saveReplay(ctx, orgId, RECEIVE_OPERATION, idempotency, result);
      return result;
    });
  }
}

export class VoidStockTransfer {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    transferId: string,
  ): Promise<StockTransferResult> {
    return this.uow.run(async (ctx) => {
      const transfers = ctx.transfers;
      if (!transfers) throw new Error("Stock transfer port is not configured");
      const transfer = await transfers.findById(orgId, transferId);
      if (!transfer) throw new NotFoundError("Stock transfer");
      assertCanVoidTransfer(transfer);

      if (transfer.status === "in_transit") {
        await validateTransferSerialsAtLocation(
          ctx,
          orgId,
          transfer.lines,
          transfer.transitLocationId,
        );
      }
      const movements =
        transfer.status === "in_transit"
          ? await voidTransferShipCostAndQty(ctx, orgId, transfer)
          : [];
      if (transfer.status === "in_transit") {
        await updateTransferSerialLocations(
          ctx,
          orgId,
          transfer.lines,
          transfer.fromLocationId,
        );
      }
      const voided = await transfers.updateStatus(
        orgId,
        transfer.id,
        "void",
        new Date(),
      );
      await enqueueTransferEvents(
        ctx,
        orgId,
        userId,
        transfer.id,
        "voided",
        movements,
      );
      return { transfer: voided, movements };
    });
  }
}

function assertDistinctLocations(
  fromLocationId: string,
  toLocationId: string,
): void {
  if (fromLocationId === toLocationId) {
    throw new ConflictError("Transfer source and destination must differ");
  }
}

type TransferLines = StockTransferWithLines["lines"];

async function validateTransferLines(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  locationId: string,
  lines: TransferLines,
): Promise<void> {
  for (const line of lines) {
    const product = await ctx.products.findById(orgId, line.productId);
    if (!product) throw new NotFoundError("Product");
    assertLotSerialRules(product, {
      lotId: line.lotId,
      serialNumbers: line.serialNumbers,
    });
    await assertTransferSerialsAvailable(
      ctx,
      orgId,
      line.productId,
      line.lotId,
      line.serialNumbers,
      locationId,
    );
  }
  await validateAvailableStock(ctx, orgId, locationId, lines);
}

async function assertTransferSerialsAvailable(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
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
    const serial = await ctx.serials.findByNumber(
      orgId,
      productId,
      serialNumber,
    );
    if (!serial || (lotId !== null && serial.lotId !== lotId)) {
      throw new ConflictError(`Serial ${serialNumber} is not available`);
    }
    assertSerialAvailableForOutbound(serial, sourceLocationId);
  }
}

async function validateTransferSerialsAtLocation(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  lines: TransferLines,
  locationId: string,
): Promise<void> {
  for (const line of lines) {
    await assertTransferSerialsAvailable(
      ctx,
      orgId,
      line.productId,
      line.lotId,
      line.serialNumbers,
      locationId,
    );
  }
}

async function updateTransferSerialLocations(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  lines: TransferLines,
  locationId: string,
): Promise<void> {
  if (!lines.some((line) => line.serialNumbers.length > 0)) return;
  if (!ctx.serials.findByNumber || !ctx.serials.updateLocation) {
    throw new Error("Serial location updates are not configured");
  }
  for (const line of lines) {
    for (const serialNumber of line.serialNumbers) {
      const serial = await ctx.serials.findByNumber(
        orgId,
        line.productId,
        serialNumber,
      );
      if (!serial) throw new NotFoundError("Serial");
      await ctx.serials.updateLocation(orgId, serial.id, locationId);
    }
  }
}

async function validateAvailableStock(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  locationId: string,
  lines: TransferLines,
): Promise<void> {
  for (const line of lines) {
    const balance = await ctx.stock.findBalance({
      orgId,
      productId: line.productId,
      locationId,
      lotId: line.lotId,
    });
    if (Number(balance?.qtyOnHand ?? "0") < Number(line.qty)) {
      throw new InsufficientStockError(
        "Stock transfer would create negative stock",
      );
    }
  }
}

async function moveTransferLines(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  transfer: NonNullable<Awaited<ReturnType<StockTransferPort["findById"]>>>,
  fromLocationId: string,
  toLocationId: string,
  fromMovementType: MovementType,
  toMovementType: MovementType,
): Promise<StockMovement[]> {
  const movements: StockMovement[] = [];
  for (const line of transfer.lines) {
    const fromQty = signedQtyForMovement(fromMovementType, line.qty);
    const toQty = signedQtyForMovement(toMovementType, line.qty);
    const outMovement = await applyMovement(
      ctx,
      orgId,
      transfer.id,
      line.id,
      line.productId,
      fromLocationId,
      line.lotId,
      fromMovementType,
      fromQty,
    );
    const inMovement = await applyMovement(
      ctx,
      orgId,
      transfer.id,
      line.id,
      line.productId,
      toLocationId,
      line.lotId,
      toMovementType,
      toQty,
    );
    const costs = await moveLayersForTransferHop(ctx, {
      orgId,
      productId: line.productId,
      lotId: line.lotId,
      qty: line.qty,
      fromLocationId,
      toLocationId,
      outMovementId: outMovement.id,
      inMovementId: inMovement.id,
      sourceDocumentType: "stock_transfer",
      sourceDocumentId: transfer.id,
      sourceDocumentLineId: line.id,
    });
    const stampedOut = await ctx.stock.updateMovementCosts(
      orgId,
      outMovement.id,
      costs.unitCost,
      String(-Math.abs(Number(costs.totalCost))),
    );
    const stampedIn = await ctx.stock.updateMovementCosts(
      orgId,
      inMovement.id,
      costs.unitCost,
      costs.totalCost,
    );
    movements.push(stampedOut, stampedIn);
  }
  return movements;
}

async function voidTransferShipCostAndQty(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  transfer: StockTransferWithLines,
): Promise<StockMovement[]> {
  const shipMovements = (
    await ctx.stock.listMovements(orgId, {
      documentType: "stock_transfer",
      documentId: transfer.id,
    })
  ).filter(
    (m) =>
      m.movementType === "transfer_out" &&
      m.locationId === transfer.fromLocationId,
  );

  const transitLayers = (
    await ctx.costing.listLayersBySourceDocument(
      orgId,
      "stock_transfer",
      transfer.id,
    )
  ).filter((layer) => layer.locationId === transfer.transitLocationId);
  assertLayersFullyOpen(transitLayers);

  const movements: StockMovement[] = [];
  const voidMovementIdByForwardId = new Map<string, string>();

  for (const line of transfer.lines) {
    const fromQty = signedQtyForMovement("transfer_out_void", line.qty);
    const toQty = signedQtyForMovement("transfer_in_void", line.qty);
    const transitOut = await applyMovement(
      ctx,
      orgId,
      transfer.id,
      line.id,
      line.productId,
      transfer.transitLocationId,
      line.lotId,
      "transfer_in_void",
      toQty,
    );
    const fromIn = await applyMovement(
      ctx,
      orgId,
      transfer.id,
      line.id,
      line.productId,
      transfer.fromLocationId,
      line.lotId,
      "transfer_out_void",
      fromQty,
    );
    const shipOut = shipMovements.find(
      (m) => m.documentLineId === line.id,
    );
    if (shipOut) {
      voidMovementIdByForwardId.set(shipOut.id, fromIn.id);
      const stampedTransit = await ctx.stock.updateMovementCosts(
        orgId,
        transitOut.id,
        shipOut.unitCost ?? "0",
        shipOut.totalCost
          ? String(-Math.abs(Number(shipOut.totalCost)))
          : "0",
      );
      const stampedFrom = await ctx.stock.updateMovementCosts(
        orgId,
        fromIn.id,
        shipOut.unitCost ?? "0",
        shipOut.totalCost
          ? String(Math.abs(Number(shipOut.totalCost)))
          : "0",
      );
      movements.push(stampedTransit, stampedFrom);
    } else {
      movements.push(transitOut, fromIn);
    }
  }

  await restoreConsumptionsForVoidedMovements(ctx, {
    orgId,
    forwardMovementIds: shipMovements.map((m) => m.id),
    voidMovementIdByForwardId,
  });
  for (const layer of transitLayers) {
    await ctx.costing.setQtyRemaining(orgId, layer.id, "0");
  }
  return movements;
}

async function applyMovement(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  transferId: string,
  lineId: string,
  productId: string,
  locationId: string,
  lotId: string | null,
  movementType: MovementType,
  qty: string,
): Promise<StockMovement> {
  const balanceKey = { orgId, productId, locationId, lotId };
  const balance = await ctx.stock.findBalance(balanceKey);
  const nextQty = String(Number(balance?.qtyOnHand ?? "0") + Number(qty));
  if (Number(nextQty) < 0) {
    throw new InsufficientStockError(
      "Stock transfer would create negative stock",
    );
  }
  const movement = await ctx.stock.insertMovement({
    ...balanceKey,
    documentType: "stock_transfer",
    documentId: transferId,
    documentLineId: lineId,
    movementType,
    qty,
  });
  await ctx.stock.setBalance(balanceKey, nextQty);
  return movement;
}

async function findReplay(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  operation: string,
  idempotency?: IdempotencyInput,
): Promise<StockTransferResult | null> {
  if (!idempotency) return null;
  const record = await ctx.idempotency.find(
    orgId,
    operation,
    idempotency.externalSystem,
    idempotency.externalId,
  );
  return record ? (record.result as StockTransferResult) : null;
}

async function saveReplay(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  operation: string,
  idempotency: IdempotencyInput | undefined,
  result: StockTransferResult,
): Promise<void> {
  if (!idempotency) return;
  await ctx.idempotency.save({
    orgId,
    operation,
    externalSystem: idempotency.externalSystem,
    externalId: idempotency.externalId,
    result,
  });
}

async function enqueueTransferEvents(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  userId: string,
  transferId: string,
  action: "shipped" | "received" | "voided",
  movements: StockMovement[],
): Promise<void> {
  await ctx.outbox.enqueue({
    orgId,
    eventType: action === "voided" ? "document.voided" : "document.posted",
    aggregateType: "stock_transfer",
    aggregateId: transferId,
    payload: { transferId, userId, action },
  });
  if (movements.length > 0) {
    await ctx.outbox.enqueue({
      orgId,
      eventType: "stock.changed",
      aggregateType: "stock_transfer",
      aggregateId: transferId,
      payload: { transferId, movementIds: movements.map(({ id }) => id) },
    });
  }
}
