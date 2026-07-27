import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  PostSupplierReturn,
  SupplierReturnUseCases,
  VoidSupplierReturn,
  createFakeCosting,
  type IdempotencyRecord,
  type SupplierReturnWithLines,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  Product,
  Serial,
  StockBalance,
  StockMovement,
  SupplierReturn,
} from "@stock-management/domain";
import { supplierReturnsRoutes } from "./supplier-returns.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SUPPLIER_ID = "00000000-0000-4000-8000-000000000003";
const BRANCH_ID = "00000000-0000-4000-8000-000000000004";
const LOCATION_ID = "00000000-0000-4000-8000-000000000005";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000006";
const now = new Date("2026-07-26T00:00:00.000Z");

function makeHarness(options?: {
  onHand?: string;
  trackSerial?: boolean;
  serialNumber?: string;
}) {
  const trackSerial = options?.trackSerial ?? false;
  const serialNumber = options?.serialNumber ?? "S1";
  const product: Product = {
    id: PRODUCT_ID,
    orgId: ORG_ID,
    sku: "SKU-1",
    name: "Widget",
    uom: "EA",
    categoryId: null,
    trackLot: false,
    trackSerial,
    trackExpiry: false,
    costingMethod: "fifo",
    reorderMin: null,
    reorderMax: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const docs = new Map<string, SupplierReturnWithLines>();
  const movements: StockMovement[] = [];
  const idempotency = new Map<string, IdempotencyRecord>();
  const serialsByNumber = new Map<string, Serial>();
  let balance: StockBalance = {
    id: randomUUID(),
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: null,
    qtyOnHand: options?.onHand ?? "10",
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
    qtyOriginal: options?.onHand ?? "10",
    qtyRemaining: options?.onHand ?? "10",
  });

  if (trackSerial) {
    serialsByNumber.set(serialNumber, {
      id: randomUUID(),
      orgId: ORG_ID,
      productId: PRODUCT_ID,
      lotId: null,
      locationId: LOCATION_ID,
      serialNumber,
      status: "in_stock",
      createdAt: now,
      updatedAt: now,
    });
  }

  const supplierReturns: NonNullable<UowContext["supplierReturns"]> = {
    async list(orgId) {
      return [...docs.values()].filter((doc) => doc.orgId === orgId);
    },
    async findById(orgId, id) {
      const doc = docs.get(id);
      return doc?.orgId === orgId ? doc : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const doc: SupplierReturnWithLines = {
        id,
        orgId,
        branchId: input.branchId,
        locationId: input.locationId,
        supplierId: input.supplierId,
        goodsReceiptId: input.goodsReceiptId ?? null,
        documentNumber: input.documentNumber ?? null,
        status: "draft",
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: line.id ?? randomUUID(),
          orgId,
          supplierReturnId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          goodsReceiptLineId: line.goodsReceiptLineId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      docs.set(id, doc);
      return doc;
    },
    async update(orgId, id, input) {
      const current = await supplierReturns.findById(orgId, id);
      if (!current) return null;
      const updated: SupplierReturnWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            supplierReturnId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            goodsReceiptLineId: line.goodsReceiptLineId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })) ?? current.lines,
        updatedAt: now,
      };
      docs.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await supplierReturns.findById(orgId, id);
      if (!current) throw new Error("Supplier return not found");
      const updated: SupplierReturnWithLines = {
        ...current,
        status,
        postedAt: status === "posted" ? occurredAt : current.postedAt,
        voidedAt: status === "void" ? occurredAt : current.voidedAt,
        updatedAt: occurredAt,
      };
      docs.set(id, updated);
      return updated;
    },
  };

  const ctx = {
    supplierReturns,
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
            (!filters?.documentId ||
              movement.documentId === filters.documentId),
        );
      },
    },
    serials: {
      async upsert() {
        throw new Error("Unexpected serial upsert");
      },
      async findByNumber(
        orgId: string,
        productId: string,
        number: string,
      ) {
        const serial = serialsByNumber.get(number);
        if (
          !serial ||
          serial.orgId !== orgId ||
          serial.productId !== productId
        ) {
          return null;
        }
        return serial;
      },
      async updateStatus(orgId: string, id: string, status: Serial["status"]) {
        for (const [number, serial] of serialsByNumber) {
          if (serial.orgId === orgId && serial.id === id) {
            const updated = { ...serial, status, updatedAt: now };
            serialsByNumber.set(number, updated);
            return updated;
          }
        }
        throw new Error("Serial not found");
      },
      async list() {
        return [...serialsByNumber.values()];
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
    supplierReturns: new SupplierReturnUseCases(supplierReturns),
    postSupplierReturn: new PostSupplierReturn(uow),
    voidSupplierReturn: new VoidSupplierReturn(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(supplierReturnsRoutes(useCases), { prefix: "/api/v1" });
    return app;
  }

  return {
    buildApp,
    getBalance: () => balance,
    getMovements: () => movements,
    getSerial: (number: string) => serialsByNumber.get(number) ?? null,
  };
}

const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };
const draftPayload = (qty = "3", serialNumbers?: string[]) => ({
  branchId: BRANCH_ID,
  locationId: LOCATION_ID,
  supplierId: SUPPLIER_ID,
  documentNumber: "SR-1001",
  lines: [
    {
      productId: PRODUCT_ID,
      qty,
      lineNumber: 1,
      ...(serialNumbers ? { serialNumbers } : {}),
    },
  ],
});

describe("supplier return routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup(options?: Parameters<typeof makeHarness>[0]) {
    const harness = makeHarness(options);
    const app = await harness.buildApp();
    apps.push(app);
    return { app, harness };
  }

  async function createDraft(
    app: ReturnType<typeof Fastify>,
    qty = "3",
    serialNumbers?: string[],
  ): Promise<SupplierReturnWithLines> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/supplier-returns",
      headers,
      payload: draftPayload(qty, serialNumbers),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<SupplierReturnWithLines>();
  }

  it("supports CRUD, post, and void for a supplier return", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/supplier-returns/${created.id}`,
      headers,
      payload: { documentNumber: "SR-UPDATED" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/supplier-returns",
      headers,
    });
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/supplier-returns/${created.id}`,
      headers,
    });
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/supplier-returns/${created.id}/post`,
      headers,
    });
    expect(post.statusCode, post.body).toBe(200);
    expect(harness.getBalance().qtyOnHand).toBe("7");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["supplier_return"]);

    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/supplier-returns/${created.id}/void`,
      headers,
    });

    expect(update.statusCode).toBe(200);
    expect(update.json<SupplierReturnWithLines>().documentNumber).toBe(
      "SR-UPDATED",
    );
    expect(list.json<SupplierReturn[]>()).toHaveLength(1);
    expect(get.json<SupplierReturnWithLines>()).toMatchObject({
      id: created.id,
    });
    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json<{ doc: SupplierReturn }>().doc.status).toBe(
      "void",
    );
    expect(harness.getBalance().qtyOnHand).toBe("10");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["supplier_return", "supplier_return_void"]);
  });

  it("sets serial status to returned on post and in_stock on void", async () => {
    const { app, harness } = await setup({
      trackSerial: true,
      serialNumber: "S1",
    });
    const created = await createDraft(app, "1", ["S1"]);

    const post = await app.inject({
      method: "POST",
      url: `/api/v1/supplier-returns/${created.id}/post`,
      headers,
    });
    expect(post.statusCode, post.body).toBe(200);
    expect(harness.getBalance().qtyOnHand).toBe("9");
    expect(harness.getSerial("S1")?.status).toBe("returned");

    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/supplier-returns/${created.id}/void`,
      headers,
    });
    expect(voidResponse.statusCode, voidResponse.body).toBe(200);
    expect(harness.getBalance().qtyOnHand).toBe("10");
    expect(harness.getSerial("S1")?.status).toBe("in_stock");
  });

  it("returns 400 when posting would create negative stock", async () => {
    const { app, harness } = await setup({ onHand: "2" });
    const created = await createDraft(app, "3");

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/supplier-returns/${created.id}/post`,
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
