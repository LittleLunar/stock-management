import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  PurchaseOrderUseCases,
  type CreatePurchaseOrderInput,
  type PurchaseOrderPort,
  type PurchaseOrderWithLines,
  type UpdatePurchaseOrderInput,
} from "@stock-management/application";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
} from "@stock-management/domain";
import { purchaseOrdersRoutes } from "./purchase-orders.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SUPPLIER_ID = "00000000-0000-4000-8000-000000000003";
const BRANCH_ID = "00000000-0000-4000-8000-000000000004";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000005";

class InMemoryPurchaseOrderRepository implements PurchaseOrderPort {
  private readonly orders = new Map<string, PurchaseOrderWithLines>();

  async list(orgId: string): Promise<PurchaseOrder[]> {
    return [...this.orders.values()].filter((order) => order.orgId === orgId);
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<PurchaseOrderWithLines | null> {
    const order = this.orders.get(id);
    return order?.orgId === orgId ? order : null;
  }

  async findLineById(
    orgId: string,
    id: string,
  ): Promise<PurchaseOrderLine | null> {
    return (
      [...this.orders.values()]
        .filter((order) => order.orgId === orgId)
        .flatMap((order) => order.lines)
        .find((line) => line.id === id) ?? null
    );
  }

  async create(
    orgId: string,
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines> {
    const id = randomUUID();
    const now = new Date();
    const order: PurchaseOrderWithLines = {
      id,
      orgId,
      supplierId: input.supplierId,
      branchId: input.branchId,
      status: "draft",
      documentNumber: input.documentNumber ?? null,
      expectedDate: input.expectedDate ?? null,
      createdAt: now,
      updatedAt: now,
      lines: input.lines.map((line) => ({
        id: line.id ?? randomUUID(),
        orgId,
        purchaseOrderId: id,
        productId: line.productId,
        orderedQty: line.orderedQty,
        receivedQty: "0",
        unitCost: line.unitCost ?? null,
        lineNumber: line.lineNumber,
      })),
    };
    this.orders.set(id, order);
    return order;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines | null> {
    const current = await this.findById(orgId, id);
    if (!current) return null;
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.orders.set(id, updated);
    return updated;
  }

  async updateLineReceivedQty(
    orgId: string,
    lineId: string,
    receivedQty: string,
  ): Promise<PurchaseOrderLine> {
    const line = await this.findLineById(orgId, lineId);
    if (!line) throw new Error("Purchase order line not found");
    line.receivedQty = receivedQty;
    return line;
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: PurchaseOrder["status"],
  ): Promise<PurchaseOrder> {
    const current = await this.findById(orgId, id);
    if (!current) throw new Error("Purchase order not found");
    const updated = { ...current, status, updatedAt: new Date() };
    this.orders.set(id, updated);
    return updated;
  }
}

describe("purchase order routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates and submits a purchase order", async () => {
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(
      purchaseOrdersRoutes(
        new PurchaseOrderUseCases(new InMemoryPurchaseOrderRepository()),
      ),
      { prefix: "/api/v1" },
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/purchase-orders",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
      payload: {
        supplierId: SUPPLIER_ID,
        branchId: BRANCH_ID,
        documentNumber: "PO-1001",
        lines: [
          {
            productId: PRODUCT_ID,
            orderedQty: "5.0000",
            unitCost: "12.5000",
            lineNumber: 1,
          },
        ],
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json<PurchaseOrderWithLines>();
    expect(created).toMatchObject({
      orgId: ORG_ID,
      status: "draft",
      documentNumber: "PO-1001",
      lines: [{ productId: PRODUCT_ID, orderedQty: "5.0000" }],
    });

    const submitResponse = await app.inject({
      method: "POST",
      url: `/api/v1/purchase-orders/${created.id}/submit`,
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });

    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json()).toMatchObject({
      id: created.id,
      orgId: ORG_ID,
      status: "submitted",
    });
  });
});
