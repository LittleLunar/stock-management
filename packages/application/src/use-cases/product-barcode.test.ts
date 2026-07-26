import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@stock-management/domain";
import { ProductUseCases } from "./product.js";

describe("ProductUseCases.findByBarcode", () => {
  it("returns product with barcodes", async () => {
    const repo = {
      list: vi.fn(),
      findById: vi.fn(),
      listBarcodes: vi.fn(async () => [
        {
          id: "bc1",
          orgId: "o",
          productId: "p1",
          barcode: "012345",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      create: vi.fn(),
      update: vi.fn(),
      findByBarcode: vi.fn(async () => ({
        id: "p1",
        orgId: "o",
        sku: "SKU-1",
        name: "Widget",
        uom: "EA",
        categoryId: null,
        trackLot: false,
        trackSerial: false,
        trackExpiry: false,
        costingMethod: "fifo" as const,
        reorderMin: null,
        reorderMax: null,
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };
    const uc = new ProductUseCases(repo);
    const result = await uc.findByBarcode("o", "012345");
    expect(result.id).toBe("p1");
    expect(result.barcodes[0]!.barcode).toBe("012345");
  });

  it("throws NotFoundError when missing", async () => {
    const uc = new ProductUseCases({
      list: vi.fn(),
      findById: vi.fn(),
      listBarcodes: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findByBarcode: vi.fn(async () => null),
    });
    await expect(uc.findByBarcode("o", "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
