import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProductUseCases,
  type CreateProductInput,
  type ProductRepository,
  type UpdateProductInput,
} from "@stock-management/application";
import type { Product, ProductBarcode } from "@stock-management/domain";
import { productsRoutes } from "./products.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000010";
const now = new Date("2026-07-26T00:00:00.000Z");
const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };

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

const barcode: ProductBarcode = {
  id: "00000000-0000-4000-8000-000000000020",
  orgId: ORG_ID,
  productId: PRODUCT_ID,
  barcode: "012345",
  createdAt: now,
  updatedAt: now,
};

function createRepo(
  products: Product[] = [],
  barcodes: ProductBarcode[] = [],
): ProductRepository {
  return {
    async list(orgId) {
      return products.filter((row) => row.orgId === orgId);
    },
    async findById(orgId, id) {
      return products.find((row) => row.orgId === orgId && row.id === id) ?? null;
    },
    async findByBarcode(orgId, code) {
      const match = barcodes.find(
        (row) => row.orgId === orgId && row.barcode === code,
      );
      if (!match) return null;
      return (
        products.find(
          (row) => row.orgId === orgId && row.id === match.productId,
        ) ?? null
      );
    },
    async listBarcodes(orgId, productId) {
      return barcodes.filter(
        (row) => row.orgId === orgId && row.productId === productId,
      );
    },
    async create(_orgId: string, _input: CreateProductInput) {
      throw new Error("not implemented");
    },
    async update(_orgId: string, _id: string, _input: UpdateProductInput) {
      throw new Error("not implemented");
    },
  };
}

async function buildApp(repo: ProductRepository) {
  const app = Fastify();
  registerErrorHandler(app);
  await app.register(requestIdPlugin);
  await app.register(createTestContextPlugin());
  await app.register(productsRoutes(new ProductUseCases(repo)), {
    prefix: "/api/v1",
  });
  return app;
}

describe("products barcode routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  afterEach(async () => {
    await app.close();
  });

  it("GET /products/by-barcode/:code returns product with barcodes", async () => {
    app = await buildApp(createRepo([product], [barcode]));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products/by-barcode/012345",
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: PRODUCT_ID,
        sku: "SKU-1",
        barcodes: [expect.objectContaining({ barcode: "012345" })],
      }),
    );
  });

  it("GET /products/by-barcode/:code returns 404 when missing", async () => {
    app = await buildApp(createRepo([product], [barcode]));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products/by-barcode/missing",
      headers,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "NOT_FOUND" }),
      }),
    );
  });

  it("decodes URI-encoded barcode codes", async () => {
    const encodedBarcode: ProductBarcode = {
      ...barcode,
      barcode: "ABC/123",
    };
    app = await buildApp(createRepo([product], [encodedBarcode]));

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/products/by-barcode/${encodeURIComponent("ABC/123")}`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: PRODUCT_ID,
        barcodes: [expect.objectContaining({ barcode: "ABC/123" })],
      }),
    );
  });
});
