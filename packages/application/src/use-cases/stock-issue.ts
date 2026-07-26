import {
  ConflictError,
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
  assertCanPostIssue,
  assertLotSerialRules,
  assertSerialAvailableForOutbound,
  signedQtyForMovement,
} from "@stock-management/domain";
import type { StockIssue, StockMovement } from "@stock-management/domain";
import type {
  CreateStockIssueInput,
  IdempotencyInput,
  UpdateStockIssueInput,
} from "../dto/inputs.js";
import {
  consumeFifoForMovement,
  restoreConsumptionsForVoidedMovements,
} from "../costing/apply-document-costing.js";
import { costingOutboxFields } from "../costing/outbox-cost-fields.js";
import type { StockIssuePort } from "../ports/inventory.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export type StockIssueResult = {
  issue: StockIssue;
  movements: StockMovement[];
};

export class StockIssueUseCases {
  constructor(private readonly repo: StockIssuePort) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const issue = await this.repo.findById(orgId, id);
    if (!issue) throw new NotFoundError("Stock issue");
    return issue;
  }

  create(orgId: string, input: CreateStockIssueInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateStockIssueInput) {
    const issue = await this.get(orgId, id);
    if (issue.status !== "draft") {
      throw new InvalidStateError("Only draft stock issues can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Stock issue");
    return updated;
  }
}

const POST_OPERATION = "post-stock-issue";

export async function postStockIssueInCtx(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  userId: string,
  issueId: string,
  idempotency?: IdempotencyInput,
): Promise<StockIssueResult> {
  const issues = ctx.issues;
  if (!issues) throw new Error("Stock issue port is not configured");

  if (idempotency) {
    const existing = await ctx.idempotency.find(
      orgId,
      POST_OPERATION,
      idempotency.externalSystem,
      idempotency.externalId,
    );
    if (existing) return existing.result as StockIssueResult;
  }

  const issue = await issues.findById(orgId, issueId);
  if (!issue) throw new NotFoundError("Stock issue");
  assertCanPostIssue(issue);

  for (const line of issue.lines) {
    const product = await ctx.products.findById(orgId, line.productId);
    if (!product) throw new NotFoundError("Product");
    assertLotSerialRules(product, {
      lotId: line.lotId,
      serialNumbers: line.serialNumbers,
    });
    await assertSerialsAvailable(
      ctx.serials,
      orgId,
      line.productId,
      line.lotId,
      line.serialNumbers,
      issue.locationId,
    );

    const balance = await ctx.stock.findBalance({
      orgId,
      productId: line.productId,
      locationId: issue.locationId,
      lotId: line.lotId,
    });
    if (Number(balance?.qtyOnHand ?? "0") < Number(line.qty)) {
      throw new InsufficientStockError(
        "Posting stock issue would create negative stock",
      );
    }
  }

  const movements: StockMovement[] = [];
  for (const line of issue.lines) {
    const qty = signedQtyForMovement("issue", line.qty);
    const balanceKey = {
      orgId,
      productId: line.productId,
      locationId: issue.locationId,
      lotId: line.lotId,
    };
    const balance = await ctx.stock.findBalance(balanceKey);
    const movement = await ctx.stock.insertMovement({
      ...balanceKey,
      documentType: "stock_issue",
      documentId: issue.id,
      documentLineId: line.id,
      movementType: "issue",
      qty,
    });
    const costs = await consumeFifoForMovement(ctx, {
      orgId,
      productId: line.productId,
      locationId: issue.locationId,
      lotId: line.lotId,
      qty: line.qty,
      movementId: movement.id,
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
      ctx.serials,
      orgId,
      line.productId,
      line.serialNumbers,
      "issued",
    );
  }

  const postedIssue = await issues.updateStatus(
    orgId,
    issue.id,
    "posted",
    new Date(),
  );
  const result = { issue: postedIssue, movements };
  await enqueueIssueEvents(ctx, orgId, userId, issue.id, "posted", movements);
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
}

export class PostStockIssue {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    issueId: string,
    idempotency?: IdempotencyInput,
  ): Promise<StockIssueResult> {
    return this.uow.run((ctx) =>
      postStockIssueInCtx(ctx, orgId, userId, issueId, idempotency),
    );
  }
}

export class VoidStockIssue {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    issueId: string,
  ): Promise<StockIssueResult> {
    return this.uow.run(async (ctx) => {
      const issues = ctx.issues;
      if (!issues) throw new Error("Stock issue port is not configured");
      const issue = await issues.findById(orgId, issueId);
      if (!issue) throw new NotFoundError("Stock issue");
      if (issue.status !== "posted") {
        throw new InvalidStateError(
          `Cannot void stock issue in status ${issue.status}`,
        );
      }

      const postedMovements = (
        await ctx.stock.listMovements(orgId, {
          documentType: "stock_issue",
          documentId: issue.id,
        })
      ).filter((movement) => movement.movementType === "issue");
      const movements: StockMovement[] = [];
      const voidMovementIdByForwardId = new Map<string, string>();
      for (const posted of postedMovements) {
        const qty = signedQtyForMovement("issue_void", posted.qty);
        const balanceKey = {
          orgId,
          productId: posted.productId,
          locationId: posted.locationId,
          lotId: posted.lotId,
        };
        const balance = await ctx.stock.findBalance(balanceKey);
        const voidMovement = await ctx.stock.insertMovement({
          ...balanceKey,
          documentType: "stock_issue",
          documentId: issue.id,
          documentLineId: posted.documentLineId,
          movementType: "issue_void",
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
      for (const line of issue.lines) {
        await updateSerialStatuses(
          ctx.serials,
          orgId,
          line.productId,
          line.serialNumbers,
          "in_stock",
        );
      }

      const voidedIssue = await issues.updateStatus(
        orgId,
        issue.id,
        "void",
        new Date(),
      );
      await enqueueIssueEvents(
        ctx,
        orgId,
        userId,
        issue.id,
        "voided",
        movements,
      );
      return { issue: voidedIssue, movements };
    });
  }
}

async function assertSerialsAvailable(
  serials: Parameters<Parameters<UnitOfWork["run"]>[0]>[0]["serials"],
  orgId: string,
  productId: string,
  lotId: string | null,
  serialNumbers: string[],
  sourceLocationId: string,
): Promise<void> {
  if (serialNumbers.length === 0) return;
  if (!serials.findByNumber) {
    throw new Error("Serial lookup is not configured");
  }
  for (const serialNumber of serialNumbers) {
    const serial = await serials.findByNumber(orgId, productId, serialNumber);
    if (!serial || (lotId !== null && serial.lotId !== lotId)) {
      throw new ConflictError(`Serial ${serialNumber} is not available`);
    }
    assertSerialAvailableForOutbound(serial, sourceLocationId);
  }
}

async function updateSerialStatuses(
  serials: Parameters<Parameters<UnitOfWork["run"]>[0]>[0]["serials"],
  orgId: string,
  productId: string,
  serialNumbers: string[],
  status: "in_stock" | "issued",
): Promise<void> {
  if (serialNumbers.length === 0) return;
  if (!serials.findByNumber || !serials.updateStatus) {
    throw new Error("Serial status updates are not configured");
  }
  for (const serialNumber of serialNumbers) {
    const serial = await serials.findByNumber(orgId, productId, serialNumber);
    if (!serial) throw new NotFoundError("Serial");
    await serials.updateStatus(orgId, serial.id, status);
  }
}

async function enqueueIssueEvents(
  ctx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
  orgId: string,
  userId: string,
  issueId: string,
  action: "posted" | "voided",
  movements: StockMovement[],
): Promise<void> {
  await ctx.outbox.enqueue({
    orgId,
    eventType: action === "posted" ? "document.posted" : "document.voided",
    aggregateType: "stock_issue",
    aggregateId: issueId,
    payload: {
      issueId,
      userId,
      ...(action === "posted"
        ? costingOutboxFields({
            cogsTotal: String(
              movements.reduce((sum, m) => sum + Number(m.totalCost ?? 0), 0),
            ),
          })
        : {}),
    },
  });
  await ctx.outbox.enqueue({
    orgId,
    eventType: "stock.changed",
    aggregateType: "stock_issue",
    aggregateId: issueId,
    payload: { issueId, movementIds: movements.map(({ id }) => id) },
  });
}
