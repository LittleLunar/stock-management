import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  PostStockIssue,
  StockIssueUseCases,
  VoidStockIssue,
  type IdempotencyRecord,
  type StockIssueWithLines,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  Product,
  StockBalance,
  StockIssue,
  StockMovement,
} from "@stock-management/domain";
import { stockIssuesRoutes } from "./stock-issues.routes.js";
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
  const issues = new Map<string, StockIssueWithLines>();
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

  const issueRepo: NonNullable<UowContext["issues"]> = {
    async list(orgId) {
      return [...issues.values()].filter((issue) => issue.orgId === orgId);
    },
    async findById(orgId, id) {
      const issue = issues.get(id);
      return issue?.orgId === orgId ? issue : null;
    },
    async create(orgId, input) {
      const id = randomUUID();
      const issue: StockIssueWithLines = {
        id,
        orgId,
        branchId: input.branchId,
        locationId: input.locationId,
        documentNumber: input.documentNumber ?? null,
        issueType: input.issueType,
        reasonNote: input.reasonNote ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: line.id ?? randomUUID(),
          orgId,
          stockIssueId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      issues.set(id, issue);
      return issue;
    },
    async update(orgId, id, input) {
      const current = await issueRepo.findById(orgId, id);
      if (!current) return null;
      const updated: StockIssueWithLines = {
        ...current,
        ...input,
        lines:
          input.lines?.map((line) => ({
            id: line.id ?? randomUUID(),
            orgId,
            stockIssueId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })) ?? current.lines,
        updatedAt: now,
      };
      issues.set(id, updated);
      return updated;
    },
    async updateStatus(orgId, id, status, occurredAt) {
      const current = await issueRepo.findById(orgId, id);
      if (!current) throw new Error("Stock issue not found");
      const updated: StockIssueWithLines = {
        ...current,
        status,
        postedAt: status === "posted" ? occurredAt : current.postedAt,
        voidedAt: status === "void" ? occurredAt : current.voidedAt,
        updatedAt: occurredAt,
      };
      issues.set(id, updated);
      return updated;
    },
  };

  const ctx = {
    issues: issueRepo,
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
    stockIssues: new StockIssueUseCases(issueRepo),
    postStockIssue: new PostStockIssue(uow),
    voidStockIssue: new VoidStockIssue(uow),
  };

  async function buildApp() {
    const app = Fastify();
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    await app.register(stockIssuesRoutes(useCases), { prefix: "/api/v1" });
    return app;
  }

  return {
    buildApp,
    getBalance: () => balance,
    getMovements: () => movements,
  };
}

const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };
const draftPayload = (qty = "3") => ({
  branchId: BRANCH_ID,
  locationId: LOCATION_ID,
  documentNumber: "ISS-1001",
  issueType: "consume",
  reasonNote: "Internal consumption",
  lines: [{ productId: PRODUCT_ID, qty, lineNumber: 1 }],
});

describe("stock issue routes", () => {
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
    qty = "3",
  ): Promise<StockIssueWithLines> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/stock-issues",
      headers,
      payload: draftPayload(qty),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<StockIssueWithLines>();
  }

  it("supports CRUD, post, and void for a stock issue", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/stock-issues/${created.id}`,
      headers,
      payload: { reasonNote: "Damaged sample" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/stock-issues",
      headers,
    });
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/stock-issues/${created.id}`,
      headers,
    });
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/stock-issues/${created.id}/post`,
      headers,
    });
    const voidResponse = await app.inject({
      method: "POST",
      url: `/api/v1/stock-issues/${created.id}/void`,
      headers,
    });

    expect(update.statusCode).toBe(200);
    expect(update.json<StockIssueWithLines>().reasonNote).toBe(
      "Damaged sample",
    );
    expect(list.json<StockIssue[]>()).toHaveLength(1);
    expect(get.json<StockIssueWithLines>()).toMatchObject({ id: created.id });
    expect(post.statusCode).toBe(200);
    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json<{ issue: StockIssue }>().issue.status).toBe(
      "void",
    );
    expect(harness.getBalance().qtyOnHand).toBe("10");
    expect(
      harness.getMovements().map((movement) => movement.movementType),
    ).toEqual(["issue", "issue_void"]);
  });

  it("returns 400 when posting would create negative stock", async () => {
    const { app, harness } = await setup("2");
    const created = await createDraft(app, "3");

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/stock-issues/${created.id}/post`,
      headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "INSUFFICIENT_STOCK" },
    });
    expect(harness.getBalance().qtyOnHand).toBe("2");
    expect(harness.getMovements()).toHaveLength(0);
  });

  it("returns the same result when a post idempotency key is replayed", async () => {
    const { app, harness } = await setup();
    const created = await createDraft(app);

    const first = await app.inject({
      method: "POST",
      url: `/api/v1/stock-issues/${created.id}/post`,
      headers,
      payload: { external_system: "wms", external_id: "issue-42" },
    });
    const replay = await app.inject({
      method: "POST",
      url: `/api/v1/stock-issues/${created.id}/post`,
      headers: {
        ...headers,
        "x-external-system": "wms",
        "x-external-id": "issue-42",
      },
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(harness.getMovements()).toHaveLength(1);
    expect(harness.getBalance().qtyOnHand).toBe("7");
  });
});
