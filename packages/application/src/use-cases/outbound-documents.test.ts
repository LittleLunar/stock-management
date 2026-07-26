import type {
  Product,
  StockAdjustment,
  StockBalance,
  StockCount,
  StockIssue,
  StockMovement,
  StockTransfer,
} from "@stock-management/domain";
import { InsufficientStockError } from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type {
  StockAdjustmentWithLines,
  StockCountWithLines,
  StockIssueWithLines,
  StockTransferWithLines,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import {
  PostStockAdjustment,
  VoidStockAdjustment,
} from "./stock-adjustment.js";
import {
  PostStockCount,
  StockCountUseCases,
  VoidStockCount,
} from "./stock-count.js";
import {
  PostStockIssue,
  StockIssueUseCases,
  VoidStockIssue,
} from "./stock-issue.js";
import {
  ReceiveStockTransfer,
  ShipStockTransfer,
  StockTransferUseCases,
  VoidStockTransfer,
} from "./stock-transfer.js";

const now = new Date("2026-07-26T00:00:00.000Z");
const orgId = "org-1";
const userId = "user-1";
const productId = "product-1";
const fromLocationId = "location-from";
const transitLocationId = "location-transit";
const toLocationId = "location-to";

type FakeOptions = {
  issueQty?: string;
  adjustmentQty?: string;
  countedQty?: string;
  onHand?: string;
};

function makeFake(options: FakeOptions = {}) {
  const product: Product = {
    id: productId,
    orgId,
    sku: "SKU-1",
    name: "Widget",
    uom: "each",
    categoryId: null,
    trackLot: false,
    trackSerial: false,
    trackExpiry: false,
    costingMethod: "fifo",
    reorderMin: null,
    reorderMax: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  let issue: StockIssueWithLines = {
    id: "issue-1",
    orgId,
    branchId: "branch-1",
    locationId: fromLocationId,
    documentNumber: "ISS-1",
    issueType: "consume",
    reasonNote: null,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    postedAt: null,
    voidedAt: null,
    lines: [
      {
        id: "issue-line-1",
        orgId,
        stockIssueId: "issue-1",
        productId,
        qty: options.issueQty ?? "3",
        lotId: null,
        lineNumber: 1,
        serialNumbers: [],
      },
    ],
  };
  let transfer: StockTransferWithLines = {
    id: "transfer-1",
    orgId,
    fromLocationId,
    toLocationId,
    transitLocationId,
    documentNumber: "TRF-1",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    shippedAt: null,
    receivedAt: null,
    voidedAt: null,
    lines: [
      {
        id: "transfer-line-1",
        orgId,
        stockTransferId: "transfer-1",
        productId,
        qty: "4",
        lotId: null,
        lineNumber: 1,
        serialNumbers: [],
      },
    ],
  };
  let adjustment: StockAdjustmentWithLines = {
    id: "adjustment-1",
    orgId,
    branchId: "branch-1",
    locationId: fromLocationId,
    documentNumber: "ADJ-1",
    reasonCode: "cycle-check",
    reasonNote: null,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    postedAt: null,
    voidedAt: null,
    lines: [
      {
        id: "adjustment-line-1",
        orgId,
        stockAdjustmentId: "adjustment-1",
        productId,
        qty: options.adjustmentQty ?? "2",
        lotId: null,
        lineNumber: 1,
        serialNumbers: [],
      },
    ],
  };
  let count: StockCountWithLines = {
    id: "count-1",
    orgId,
    branchId: "branch-1",
    locationId: fromLocationId,
    documentNumber: "CNT-1",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    postedAt: null,
    voidedAt: null,
    lines: [
      {
        id: "count-line-1",
        orgId,
        stockCountId: "count-1",
        productId,
        lotId: null,
        expectedQty: options.onHand ?? "10",
        countedQty: options.countedQty ?? "7",
        lineNumber: 1,
      },
    ],
  };

  const balances = new Map<string, StockBalance>();
  const movements: StockMovement[] = [];
  let movementSequence = 0;
  const key = (locationId: string, lotId: string | null = null) =>
    `${productId}:${locationId}:${lotId ?? ""}`;

  const seedBalance = (locationId: string, qtyOnHand: string) => {
    balances.set(key(locationId), {
      id: `balance-${locationId}`,
      orgId,
      productId,
      locationId,
      lotId: null,
      qtyOnHand,
      qtyReserved: "0",
      updatedAt: now,
    });
  };
  seedBalance(fromLocationId, options.onHand ?? "10");
  seedBalance(transitLocationId, "0");
  seedBalance(toLocationId, "0");

  const ctx = {
    issues: {
      async list() {
        return [issue];
      },
      async findById(_orgId: string, id: string) {
        return id === issue.id ? issue : null;
      },
      async create() {
        return issue;
      },
      async update() {
        return issue;
      },
      async updateStatus(
        _orgId: string,
        _id: string,
        status: StockIssue["status"],
        occurredAt: Date,
      ) {
        issue = {
          ...issue,
          status,
          postedAt: status === "posted" ? occurredAt : issue.postedAt,
          voidedAt: status === "void" ? occurredAt : issue.voidedAt,
        };
        return issue;
      },
    },
    transfers: {
      async list() {
        return [transfer];
      },
      async findById(_orgId: string, id: string) {
        return id === transfer.id ? transfer : null;
      },
      async create() {
        return transfer;
      },
      async update() {
        return transfer;
      },
      async updateStatus(
        _orgId: string,
        _id: string,
        status: StockTransfer["status"],
        occurredAt: Date,
      ) {
        transfer = {
          ...transfer,
          status,
          shippedAt: status === "in_transit" ? occurredAt : transfer.shippedAt,
          receivedAt: status === "received" ? occurredAt : transfer.receivedAt,
          voidedAt: status === "void" ? occurredAt : transfer.voidedAt,
        };
        return transfer;
      },
    },
    adjustments: {
      async list() {
        return [adjustment];
      },
      async findById(_orgId: string, id: string) {
        return id === adjustment.id ? adjustment : null;
      },
      async create() {
        return adjustment;
      },
      async update() {
        return adjustment;
      },
      async updateStatus(
        _orgId: string,
        _id: string,
        status: StockAdjustment["status"],
        occurredAt: Date,
      ) {
        adjustment = {
          ...adjustment,
          status,
          postedAt: status === "posted" ? occurredAt : adjustment.postedAt,
          voidedAt: status === "void" ? occurredAt : adjustment.voidedAt,
        };
        return adjustment;
      },
    },
    counts: {
      async list() {
        return [count];
      },
      async findById(_orgId: string, id: string) {
        return id === count.id ? count : null;
      },
      async create(
        _orgId: string,
        input: { lines: StockCountWithLines["lines"] },
      ) {
        count = { ...count, lines: input.lines };
        return count;
      },
      async update(
        _orgId: string,
        _id: string,
        input: { lines?: StockCountWithLines["lines"] },
      ) {
        count = { ...count, lines: input.lines ?? count.lines };
        return count;
      },
      async updateStatus(
        _orgId: string,
        _id: string,
        status: StockCount["status"],
        occurredAt: Date,
      ) {
        count = {
          ...count,
          status,
          postedAt: status === "posted" ? occurredAt : count.postedAt,
          voidedAt: status === "void" ? occurredAt : count.voidedAt,
        };
        return count;
      },
    },
    products: {
      async findById() {
        return product;
      },
    },
    locations: {
      async findById(_orgId: string, id: string) {
        return {
          id,
          orgId,
          branchId: "branch-1",
          code: id,
          name: id,
          type:
            id === transitLocationId
              ? ("transit" as const)
              : ("storage" as const),
          status: "active" as const,
          createdAt: now,
          updatedAt: now,
        };
      },
    },
    stock: {
      async findBalance(balanceKey: {
        productId: string;
        locationId: string;
        lotId: string | null;
      }) {
        return (
          balances.get(
            `${balanceKey.productId}:${balanceKey.locationId}:${balanceKey.lotId ?? ""}`,
          ) ?? null
        );
      },
      async setBalance(
        balanceKey: {
          orgId: string;
          productId: string;
          locationId: string;
          lotId: string | null;
        },
        qtyOnHand: string,
      ) {
        const balance: StockBalance = {
          id: `balance-${balanceKey.locationId}`,
          ...balanceKey,
          qtyOnHand,
          qtyReserved: "0",
          updatedAt: now,
        };
        balances.set(
          `${balanceKey.productId}:${balanceKey.locationId}:${balanceKey.lotId ?? ""}`,
          balance,
        );
        return balance;
      },
      async insertMovement(input: Omit<StockMovement, "id" | "createdAt">) {
        const movement: StockMovement = {
          ...input,
          id: `movement-${++movementSequence}`,
          createdAt: now,
        };
        movements.push(movement);
        return movement;
      },
      async listBalances() {
        return [...balances.values()];
      },
      async listMovements(
        _orgId: string,
        filters?: { documentType?: string; documentId?: string },
      ) {
        return movements.filter(
          (movement) =>
            (!filters?.documentType ||
              movement.documentType === filters.documentType) &&
            (!filters?.documentId ||
              movement.documentId === filters.documentId),
        );
      },
    },
    lots: {
      async upsert() {
        throw new Error("Unexpected lot upsert");
      },
      async list() {
        return [];
      },
    },
    serials: {
      async upsert() {
        throw new Error("Unexpected serial upsert");
      },
      async findByNumber() {
        return null;
      },
      async updateStatus() {
        throw new Error("Unexpected serial status update");
      },
      async list() {
        return [];
      },
    },
    outbox: { async enqueue() {} },
    idempotency: {
      async find() {
        return null;
      },
      async save() {},
    },
  } as unknown as UowContext;

  const uow: UnitOfWork = {
    run(fn) {
      return fn(ctx);
    },
  };

  return {
    uow,
    ctx,
    getBalance: (locationId: string) =>
      balances.get(key(locationId))?.qtyOnHand ?? "0",
    getIssue: () => issue,
    getTransfer: () => transfer,
    getAdjustment: () => adjustment,
    getCount: () => count,
    getMovements: () => movements,
  };
}

describe("stock issue use cases", () => {
  it("posts an issue by decreasing stock and voids it by restoring stock", async () => {
    const fake = makeFake();

    const posted = await new PostStockIssue(fake.uow).execute(
      orgId,
      userId,
      "issue-1",
    );

    expect(fake.getBalance(fromLocationId)).toBe("7");
    expect(fake.getIssue().status).toBe("posted");
    expect(posted.movements.map((movement) => movement.movementType)).toEqual([
      "issue",
    ]);

    const voided = await new VoidStockIssue(fake.uow).execute(
      orgId,
      userId,
      "issue-1",
    );

    expect(fake.getBalance(fromLocationId)).toBe("10");
    expect(fake.getIssue().status).toBe("void");
    expect(voided.movements.map((movement) => movement.movementType)).toEqual([
      "issue_void",
    ]);
  });

  it("rejects updates after an issue leaves draft", async () => {
    const fake = makeFake();
    await new PostStockIssue(fake.uow).execute(orgId, userId, "issue-1");
    const drafts = new StockIssueUseCases(fake.ctx.issues);

    await expect(
      drafts.update(orgId, "issue-1", { reasonNote: "too late" }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("stock transfer use cases", () => {
  it("ships from source to transit and receives from transit to destination", async () => {
    const fake = makeFake();

    await new ShipStockTransfer(fake.uow).execute(orgId, userId, "transfer-1");

    expect(fake.getBalance(fromLocationId)).toBe("6");
    expect(fake.getBalance(transitLocationId)).toBe("4");
    expect(fake.getTransfer().status).toBe("in_transit");

    await new ReceiveStockTransfer(fake.uow).execute(
      orgId,
      userId,
      "transfer-1",
    );

    expect(fake.getBalance(transitLocationId)).toBe("0");
    expect(fake.getBalance(toLocationId)).toBe("4");
    expect(fake.getTransfer().status).toBe("received");
    expect(
      fake.getMovements().map((movement) => movement.movementType),
    ).toEqual(["transfer_out", "transfer_in", "transfer_out", "transfer_in"]);
  });

  it("voids an in-transit transfer by restoring source stock", async () => {
    const fake = makeFake();
    await new ShipStockTransfer(fake.uow).execute(orgId, userId, "transfer-1");

    await new VoidStockTransfer(fake.uow).execute(orgId, userId, "transfer-1");

    expect(fake.getBalance(fromLocationId)).toBe("10");
    expect(fake.getBalance(transitLocationId)).toBe("0");
    expect(fake.getTransfer().status).toBe("void");
    expect(fake.getMovements().at(-1)?.movementType).toBe("transfer_out_void");
  });

  it("supports draft list, get, create, and update operations", async () => {
    const fake = makeFake();
    const drafts = new StockTransferUseCases(fake.ctx.transfers);

    await expect(drafts.list(orgId)).resolves.toHaveLength(1);
    await expect(drafts.get(orgId, "transfer-1")).resolves.toMatchObject({
      status: "draft",
    });
    await expect(
      drafts.create(orgId, {
        fromLocationId,
        toLocationId,
        transitLocationId,
        lines: [{ productId, qty: "4", lineNumber: 1 }],
      }),
    ).resolves.toMatchObject({ id: "transfer-1" });
    await expect(
      drafts.update(orgId, "transfer-1", { documentNumber: "TRF-2" }),
    ).resolves.toMatchObject({ id: "transfer-1" });
  });
});

describe("stock adjustment use cases", () => {
  it.each([
    { adjustmentQty: "2", expectedBalance: "12" },
    { adjustmentQty: "-3", expectedBalance: "7" },
  ])(
    "posts a signed adjustment of $adjustmentQty",
    async ({ adjustmentQty, expectedBalance }) => {
      const fake = makeFake({ adjustmentQty });

      await new PostStockAdjustment(fake.uow).execute(
        orgId,
        userId,
        "adjustment-1",
      );

      expect(fake.getBalance(fromLocationId)).toBe(expectedBalance);
      expect(fake.getAdjustment().status).toBe("posted");
      expect(fake.getMovements()[0]?.qty).toBe(adjustmentQty);
    },
  );

  it("rejects a decrease that would create negative stock", async () => {
    const fake = makeFake({ adjustmentQty: "-11" });

    await expect(
      new PostStockAdjustment(fake.uow).execute(orgId, userId, "adjustment-1"),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(fake.getBalance(fromLocationId)).toBe("10");
    expect(fake.getMovements()).toHaveLength(0);
  });

  it("voids an adjustment with an opposite signed movement", async () => {
    const fake = makeFake({ adjustmentQty: "-3" });
    await new PostStockAdjustment(fake.uow).execute(
      orgId,
      userId,
      "adjustment-1",
    );

    const result = await new VoidStockAdjustment(fake.uow).execute(
      orgId,
      userId,
      "adjustment-1",
    );

    expect(fake.getBalance(fromLocationId)).toBe("10");
    expect(result.movements[0]).toMatchObject({
      movementType: "adjustment_void",
      qty: "3",
    });
  });
});

describe("stock count use cases", () => {
  it("posts only the variance movement and voids it with a reversal", async () => {
    const fake = makeFake({ countedQty: "7" });

    const posted = await new PostStockCount(fake.uow).execute(
      orgId,
      userId,
      "count-1",
    );

    expect(fake.getBalance(fromLocationId)).toBe("7");
    expect(posted.movements).toHaveLength(1);
    expect(posted.movements[0]).toMatchObject({
      movementType: "count_variance",
      qty: "-3",
    });

    const voided = await new VoidStockCount(fake.uow).execute(
      orgId,
      userId,
      "count-1",
    );

    expect(fake.getBalance(fromLocationId)).toBe("10");
    expect(voided.movements[0]).toMatchObject({
      movementType: "count_variance_void",
      qty: "3",
    });
  });

  it("posts zero variance without creating a movement", async () => {
    const fake = makeFake({ countedQty: "10" });

    const result = await new PostStockCount(fake.uow).execute(
      orgId,
      userId,
      "count-1",
    );

    expect(fake.getCount().status).toBe("posted");
    expect(result.movements).toHaveLength(0);
    expect(fake.getMovements()).toHaveLength(0);
  });

  it("snapshots expected quantity when a count draft is created", async () => {
    const fake = makeFake({ onHand: "12" });
    const drafts = new StockCountUseCases(fake.ctx.counts, fake.ctx.stock);

    const created = await drafts.create(orgId, {
      branchId: "branch-1",
      locationId: fromLocationId,
      lines: [{ productId, countedQty: "10", lineNumber: 1 }],
    });

    expect(created.lines[0]?.expectedQty).toBe("12");
  });
});
