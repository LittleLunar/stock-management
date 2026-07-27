import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  PostStockCount,
  StockCountUseCases,
  VoidStockCount,
  createFakeCosting,
  type IdempotencyRecord,
  type StockCountWithLines,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  Product,
  StockBalance,
  StockCount,
  StockMovement,
} from "@stock-management/domain";
import { stockCountsRoutes } from "./stock-counts.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const BRANCH_ID = "00000000-0000-4000-8000-000000000003";
const LOCATION_ID = "00000000-0000-4000-8000-000000000004";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000005";
const now = new Date("2026-07-26T00:00:00.000Z");

function makeHarness(onHand = "10") {
  const product: Product = {
    id: PRODUCT_ID,
    orgId: ORG_ID,
    sku: "SKU-1",
    name: "Widget",
    uom: "EA",
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
  const counts = new Map<string, StockCountWithLines>();
  const movements: StockMovement[] = [];
  const idempotency = new Map<string, IdempotencyRecord>();
  let balance: StockBalance = {
    id: randomUUID(),
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: null,
    qtyOnHand: onHand,
    qtyReserved: "0",
    updatedAt: now,
  };
  let movementSequence = 0;
  const costing = createFakeCosting();
  void costing.insertLayer({
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: null,
    sourceDocumentType: "goods_receipt",
    sourceDocumentId: "gr-seed",
    sourceDocumentLineId: "grl-seed",
    sourceMovementId: "m-seed",
    receivedAt: new Date("2026-01-01"),
    unitCost: "10",
    qtyOriginal: onHand,
    qtyRemaining: onHand,
  });

  const countRepo: NonNullable<UowContext["counts"]> = {
    async list(orgId) {
      return [...counts.values()].filter((count) => count.orgId === orgId);
    },
    async findById(orgId, id) {
      const count = counts.get(id);
      return count?.orgId === orgId ? count : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const count: StockCountWithLines = {
        id,
        orgId,
        branchId: input.branchId,
        locationId: input.locationId,
        documentNumber: input.documentNumber ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: line.id ?? randomUUID(),
          orgId,
          stockCountId: id,
          productId: line.productId,
          lotId: line.lotId ?? null,
          expectedQty: line.expectedQty,
          countedQty: line.countedQty,
          unitCost: line.unitCost ?? null,
          lineNumber: line.lineNumber,
        })),
      };
      counts.set(id, count);
      return count;
    },
    async update(orgId, id, input) {
      const current = await countRepo.findById(orgId, id);
      if (!current) return null;
      const updated: StockCountWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            stockCountId: id,
            productId: line.productId,
            lotId: line.lotId ?? null,
            expectedQty: line.expectedQty,
            countedQty: line.countedQty,
            unitCost: line.unitCost ?? null,
            lineNumber: line.lineNumber,
          })) ?? current.lines,
        updatedAt: now,
      };
      counts.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await countRepo.findById(orgId, id);
      if (!current) throw new Error("Stock count not found");
      const updated: StockCountWithLines = {
        ...current,
        status,
        postedAt: status === "posted" ? occurredAt : current.postedAt,
        voidedAt: status === "void" ? occurredAt : current.voidedAt,
        updatedAt: occurredAt,
      };
      counts.set(id, updated);
      return updated;
    },
  };

  const stock = {
    async findBalance() {
      return balance;
    },
    async setBalance(
      key: Pick<StockBalance, "orgId" | "productId" | "locationId" | "lotId">,
      qtyOnHand: string,
    ) {
      balance = { ...balance, ...key, qtyOnHand, updatedAt: now };
      return balance;
    },
    async setQtyReserved(
      key: Pick<StockBalance, "orgId" | "productId" | "locationId" | "lotId">,
      qtyReserved: string,
    ) {
      balance = { ...balance, ...key, qtyReserved, updatedAt: now };
      return balance;
    },
    async insertMovement(
      input: Omit<StockMovement, "id" | "createdAt"> & {
        createdAt?: Date;
        unitCost?: string | null;
        totalCost?: string | null;
      },
    ) {
      const movement: StockMovement = {
        ...input,
        id: `movement-${++movementSequence}`,
        createdAt: input.createdAt ?? now,
        unitCost: input.unitCost ?? null,
        totalCost: input.totalCost ?? null,
      };
      movements.push(movement);
      return movement;
    },
    async updateMovementCosts(
      _orgId: string,
      movementId: string,
      unitCost: string,
      totalCost: string,
    ) {
      const movement = movements.find((candidate) => candidate.id === movementId);
      if (!movement) throw new Error("Movement not found");
      movement.unitCost = unitCost;
      movement.totalCost = totalCost;
      return movement;
    },
    async listBalances() {
      return [balance];
    },
    async listMovements(
      _orgId: string,
      filters?: { documentType?: string; documentId?: string },
    ) {
      return movements.filter(
        (movement) =>
          (!filters?.documentType ||
            movement.documentType === filters.documentType) &&
          (!filters?.documentId || movement.documentId === filters.documentId),
      );
    },
  };

  const ctx = {
    counts: countRepo,
    products: {
      async findById(_orgId: string, id: string) {
        return id === product.id ? product : null;
      },
    },
    stock,
    serials: {
      async upsert() {
        throw new Error("Unexpected serial upsert");
      },
      async list() {
        return [];
      },
    },
    costing,
    outbox: { async enqueue() {} },
    idempotency: {
      async find(
        orgId: string,
        operation: string,
        externalSystem: string,
        externalId: string,
      ) {
        return (
          idempotency.get(
            `${orgId}:${operation}:${externalSystem}:${externalId}`,
          ) ?? null
        );
      },
      async save(record: IdempotencyRecord) {
        idempotency.set(
          `${record.orgId}:${record.operation}:${record.externalSystem}:${record.externalId}`,
          record,
        );
      },
    },
  } as unknown as UowContext;
  const uow: UnitOfWork = { run: (fn) => fn(ctx) };
  const useCases = {
    stockCounts: new StockCountUseCases(countRepo, stock),
    postStockCount: new PostStockCount(uow),
    voidStockCount: new VoidStockCount(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(stockCountsRoutes(useCases), { prefix: "/api/v1" });
    return app;
  }

  return {
    buildApp,
    getBalance: () => balance,
    setBalance: (qtyOnHand: string) => {
      balance = { ...balance, qtyOnHand, updatedAt: now };
    },
    getMovements: () => movements,
  };
}

const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };
const draftPayload = (countedQty: string | null = "10") => ({
  branchId: BRANCH_ID,
  locationId: LOCATION_ID,
  documentNumber: "CNT-1001",
  lines: [{ productId: PRODUCT_ID, countedQty, lineNumber: 1 }],
});

describe("stock count routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup(onHand = "10") {
    const harness = makeHarness(onHand);
    const app = await harness.buildApp();
    apps.push(app);
    return { app, harness };
  }

  async function createDraft(
    app: ReturnType<typeof Fastify>,
    countedQty: string | null = "10",
  ): Promise<StockCountWithLines> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/stock-counts",
      headers,
      payload: draftPayload(countedQty),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<StockCountWithLines>();
  }

  it("supports CRUD, post, and void for a stock count", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app, "7");

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/stock-counts/${created.id}`,
      headers,
      payload: { documentNumber: "CNT-2002" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/stock-counts",
      headers,
    });
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/stock-counts/${created.id}`,
      headers,
    });
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/stock-counts/${created.id}/post`,
      headers,
    });
    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/stock-counts/${created.id}/void`,
      headers,
    });

    expect(update.statusCode).toBe(200);
    expect(update.json<StockCountWithLines>().documentNumber).toBe("CNT-2002");
    expect(list.json<StockCount[]>()).toHaveLength(1);
    expect(get.json<StockCountWithLines>()).toMatchObject({ id: created.id });
    expect(post.statusCode).toBe(200);
    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json<{ count: StockCount }>().count.status).toBe(
      "void",
    );
    expect(harness.getBalance().qtyOnHand).toBe("10");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["count_variance", "count_variance_void"]);
  });

  it("snapshots expected qty at create and uses it at post", async () => {
    const { app, harness } = await setup("10");
    const created = await createDraft(app, "8");

    expect(created.lines[0]?.expectedQty).toBe("10");

    // Balance changes after snapshot must not change post variance.
    harness.setBalance("4");

    const post = await app.inject({
      method: "POST",
      url: `/api/v1/stock-counts/${created.id}/post`,
      headers,
    });

    expect(post.statusCode).toBe(200);
    const body = post.json<{
      count: StockCountWithLines;
      movements: StockMovement[];
    }>();
    expect(body.count.lines[0]?.expectedQty).toBe("10");
    expect(body.movements).toHaveLength(1);
    expect(body.movements[0]).toMatchObject({
      movementType: "count_variance",
      qty: "-2",
    });
    expect(harness.getBalance().qtyOnHand).toBe("2");
  });

  it("posts zero variance with no movement", async () => {
    const { app, harness } = await setup("10");
    const created = await createDraft(app, "10");

    const post = await app.inject({
      method: "POST",
      url: `/api/v1/stock-counts/${created.id}/post`,
      headers,
    });

    expect(post.statusCode).toBe(200);
    const body = post.json<{
      count: StockCount;
      movements: StockMovement[];
    }>();
    expect(body.count.status).toBe("posted");
    expect(body.movements).toHaveLength(0);
    expect(harness.getMovements()).toHaveLength(0);
    expect(harness.getBalance().qtyOnHand).toBe("10");
  });
});
