import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  CustomerReturnUseCases,
  PostCustomerReturn,
  VoidCustomerReturn,
  type CustomerReturnWithLines,
  type IdempotencyRecord,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  CustomerReturn,
  Product,
  Serial,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import { customerReturnsRoutes } from "./customer-returns.routes.js";
import { contextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000003";
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
  const serialNumber = options?.serialNumber ?? "C1";
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

  const docs = new Map<string, CustomerReturnWithLines>();
  const movements: StockMovement[] = [];
  const idempotency = new Map<string, IdempotencyRecord>();
  const serialsByNumber = new Map<string, Serial>();
  let balance: StockBalance = {
    id: randomUUID(),
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: null,
    qtyOnHand: options?.onHand ?? "4",
    qtyReserved: "0",
    updatedAt: now,
  };
  let movementSequence = 0;

  if (trackSerial) {
    serialsByNumber.set(serialNumber, {
      id: randomUUID(),
      orgId: ORG_ID,
      productId: PRODUCT_ID,
      lotId: null,
      locationId: null,
      serialNumber,
      status: "issued",
      createdAt: now,
      updatedAt: now,
    });
  }

  const customerReturns: NonNullable<UowContext["customerReturns"]> = {
    async list(orgId) {
      return [...docs.values()].filter((doc) => doc.orgId === orgId);
    },
    async findById(orgId, id) {
      const doc = docs.get(id);
      return doc?.orgId === orgId ? doc : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const doc: CustomerReturnWithLines = {
        id,
        orgId,
        branchId: input.branchId,
        locationId: input.locationId,
        customerId: input.customerId,
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
          customerReturnId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      docs.set(id, doc);
      return doc;
    },
    async update(orgId, id, input) {
      const current = await customerReturns.findById(orgId, id);
      if (!current) return null;
      const updated: CustomerReturnWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            customerReturnId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })) ?? current.lines,
        updatedAt: now,
      };
      docs.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await customerReturns.findById(orgId, id);
      if (!current) throw new Error("Customer return not found");
      const updated: CustomerReturnWithLines = {
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
    customerReturns,
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
      async upsert(input: {
        orgId: string;
        productId: string;
        lotId: string | null;
        locationId: string | null;
        serialNumber: string;
      }) {
        const existing = serialsByNumber.get(input.serialNumber);
        const serial: Serial = {
          id: existing?.id ?? randomUUID(),
          orgId: input.orgId,
          productId: input.productId,
          lotId: input.lotId,
          locationId: input.locationId,
          serialNumber: input.serialNumber,
          status: "in_stock",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        serialsByNumber.set(input.serialNumber, serial);
        return serial;
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
    customerReturns: new CustomerReturnUseCases(customerReturns),
    postCustomerReturn: new PostCustomerReturn(uow),
    voidCustomerReturn: new VoidCustomerReturn(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    await app.register(customerReturnsRoutes(useCases), { prefix: "/api/v1" });
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
const draftPayload = (qty = "2", serialNumbers?: string[]) => ({
  branchId: BRANCH_ID,
  locationId: LOCATION_ID,
  customerId: CUSTOMER_ID,
  documentNumber: "CR-1001",
  lines: [
    {
      productId: PRODUCT_ID,
      qty,
      lineNumber: 1,
      ...(serialNumbers ? { serialNumbers } : {}),
    },
  ],
});

describe("customer return routes", () => {
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
    qty = "2",
    serialNumbers?: string[],
  ): Promise<CustomerReturnWithLines> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/customer-returns",
      headers,
      payload: draftPayload(qty, serialNumbers),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<CustomerReturnWithLines>();
  }

  it("supports CRUD, post, and void for a customer return", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/customer-returns/${created.id}`,
      headers,
      payload: { documentNumber: "CR-UPDATED" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/customer-returns",
      headers,
    });
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/customer-returns/${created.id}`,
      headers,
    });
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/customer-returns/${created.id}/post`,
      headers,
    });
    expect(post.statusCode, post.body).toBe(200);
    expect(harness.getBalance().qtyOnHand).toBe("6");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["customer_return"]);

    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/customer-returns/${created.id}/void`,
      headers,
    });

    expect(update.statusCode).toBe(200);
    expect(update.json<CustomerReturnWithLines>().documentNumber).toBe(
      "CR-UPDATED",
    );
    expect(list.json<CustomerReturn[]>()).toHaveLength(1);
    expect(get.json<CustomerReturnWithLines>()).toMatchObject({
      id: created.id,
    });
    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json<{ doc: CustomerReturn }>().doc.status).toBe(
      "void",
    );
    expect(harness.getBalance().qtyOnHand).toBe("4");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["customer_return", "customer_return_void"]);
  });

  it("sets serial status to in_stock on post and issued on void", async () => {
    const { app, harness } = await setup({
      trackSerial: true,
      serialNumber: "C1",
    });
    const created = await createDraft(app, "1", ["C1"]);

    const post = await app.inject({
      method: "POST",
      url: `/api/v1/customer-returns/${created.id}/post`,
      headers,
    });
    expect(post.statusCode, post.body).toBe(200);
    expect(harness.getBalance().qtyOnHand).toBe("5");
    expect(harness.getSerial("C1")?.status).toBe("in_stock");
    expect(harness.getSerial("C1")?.locationId).toBe(LOCATION_ID);

    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/customer-returns/${created.id}/void`,
      headers,
    });
    expect(voidResponse.statusCode, voidResponse.body).toBe(200);
    expect(harness.getBalance().qtyOnHand).toBe("4");
    expect(harness.getSerial("C1")?.status).toBe("issued");
  });
});
