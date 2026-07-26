import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  PostStockAdjustment,
  StockAdjustmentUseCases,
  VoidStockAdjustment,
  type IdempotencyRecord,
  type StockAdjustmentWithLines,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  Product,
  StockAdjustment,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import { stockAdjustmentsRoutes } from "./stock-adjustments.routes.js";
import { contextPlugin } from "../plugins/context.js";
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
  const adjustments = new Map<string, StockAdjustmentWithLines>();
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

  const adjustmentRepo: NonNullable<UowContext["adjustments"]> = {
    async list(orgId) {
      return [...adjustments.values()].filter(
        (adjustment) => adjustment.orgId === orgId,
      );
    },
    async findById(orgId, id) {
      const adjustment = adjustments.get(id);
      return adjustment?.orgId === orgId ? adjustment : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const adjustment: StockAdjustmentWithLines = {
        id,
        orgId,
        branchId: input.branchId,
        locationId: input.locationId,
        documentNumber: input.documentNumber ?? null,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: line.id ?? randomUUID(),
          orgId,
          stockAdjustmentId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      adjustments.set(id, adjustment);
      return adjustment;
    },
    async update(orgId, id, input) {
      const current = await adjustmentRepo.findById(orgId, id);
      if (!current) return null;
      const updated: StockAdjustmentWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            stockAdjustmentId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })) ?? current.lines,
        updatedAt: now,
      };
      adjustments.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await adjustmentRepo.findById(orgId, id);
      if (!current) throw new Error("Stock adjustment not found");
      const updated: StockAdjustmentWithLines = {
        ...current,
        status,
        postedAt: status === "posted" ? occurredAt : current.postedAt,
        voidedAt: status === "void" ? occurredAt : current.voidedAt,
        updatedAt: occurredAt,
      };
      adjustments.set(id, updated);
      return updated;
    },
  };

  const ctx = {
    adjustments: adjustmentRepo,
    products: {
      async findById(_orgId: string, id: string) {
        return id === product.id ? product : null;
      },
    },
    stock: {
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
      async insertMovement(
        input: Omit<StockMovement, "id" | "createdAt"> & {
          createdAt?: Date;
        },
      ) {
        const movement: StockMovement = {
          ...input,
          id: `movement-${++movementSequence}`,
          createdAt: input.createdAt ?? now,
        };
        movements.push(movement);
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
            (!filters?.documentId ||
              movement.documentId === filters.documentId),
        );
      },
    },
    serials: {
      async upsert() {
        throw new Error("Unexpected serial upsert");
      },
      async list() {
        return [];
      },
    },
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
    stockAdjustments: new StockAdjustmentUseCases(adjustmentRepo),
    postStockAdjustment: new PostStockAdjustment(uow),
    voidStockAdjustment: new VoidStockAdjustment(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    await app.register(stockAdjustmentsRoutes(useCases), { prefix: "/api/v1" });
    return app;
  }

  return {
    buildApp,
    getBalance: () => balance,
    getMovements: () => movements,
  };
}

const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };
const draftPayload = (qty = "-3") => ({
  branchId: BRANCH_ID,
  locationId: LOCATION_ID,
  documentNumber: "ADJ-1001",
  reasonCode: "cycle-check",
  reasonNote: "Cycle count correction",
  lines: [{ productId: PRODUCT_ID, qty, lineNumber: 1 }],
});

describe("stock adjustment routes", () => {
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
    qty = "-3",
  ): Promise<StockAdjustmentWithLines> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/stock-adjustments",
      headers,
      payload: draftPayload(qty),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<StockAdjustmentWithLines>();
  }

  it("supports CRUD, post, and void for a stock adjustment", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/stock-adjustments/${created.id}`,
      headers,
      payload: { reasonNote: "Damaged goods" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/stock-adjustments",
      headers,
    });
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/stock-adjustments/${created.id}`,
      headers,
    });
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/stock-adjustments/${created.id}/post`,
      headers,
    });
    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/stock-adjustments/${created.id}/void`,
      headers,
    });

    expect(update.statusCode).toBe(200);
    expect(update.json<StockAdjustmentWithLines>().reasonNote).toBe(
      "Damaged goods",
    );
    expect(list.json<StockAdjustment[]>()).toHaveLength(1);
    expect(get.json<StockAdjustmentWithLines>()).toMatchObject({
      id: created.id,
    });
    expect(post.statusCode).toBe(200);
    expect(voidResponse.statusCode).toBe(200);
    expect(
      voidResponse.json<{ adjustment: StockAdjustment }>().adjustment.status,
    ).toBe("void");
    expect(harness.getBalance().qtyOnHand).toBe("10");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["adjustment", "adjustment_void"]);
  });

  it("returns 400 when a negative adjustment exceeds on-hand", async () => {
    const { app, harness } = await setup("2");
    const created = await createDraft(app, "-3");

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/stock-adjustments/${created.id}/post`,
      headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "INSUFFICIENT_STOCK" },
    });
    expect(harness.getBalance().qtyOnHand).toBe("2");
    expect(harness.getMovements()).toHaveLength(0);
  });
});
