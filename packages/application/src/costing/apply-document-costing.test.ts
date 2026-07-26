import { describe, expect, it } from "vitest";
import type { Product } from "@stock-management/domain";
import type { ProductLookupPort } from "../ports/inventory.js";
import { createFakeCosting } from "./fake-costing.js";
import {
  consumeFifoForMovement,
  createLayerForMovement,
  moveLayersForTransferHop,
  restoreConsumptionsForVoidedMovements,
} from "./apply-document-costing.js";

const product: Product = {
  id: "product-1",
  orgId: "org-1",
  sku: "SKU",
  name: "Product",
  categoryId: null,
  uom: "ea",
  trackLot: false,
  trackSerial: false,
  trackExpiry: false,
  costingMethod: "fifo",
  reorderMin: null,
  reorderMax: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const products: ProductLookupPort = {
  async findById(orgId, id) {
    return orgId === "org-1" && id === "product-1" ? product : null;
  },
};

describe("consumeFifoForMovement", () => {
  it("consumes multi-layer FIFO and updates remaining", async () => {
    const costing = createFakeCosting();
    await costing.insertLayer({
      id: "a",
      orgId: "org-1",
      productId: "product-1",
      locationId: "loc-1",
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      qtyOriginal: "2",
      qtyRemaining: "2",
    });
    await costing.insertLayer({
      id: "b",
      orgId: "org-1",
      productId: "product-1",
      locationId: "loc-1",
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-2",
      sourceDocumentLineId: "grl-2",
      sourceMovementId: "m-2",
      receivedAt: new Date("2026-01-02"),
      unitCost: "12",
      qtyOriginal: "5",
      qtyRemaining: "5",
    });

    const result = await consumeFifoForMovement(
      { costing, products },
      {
        orgId: "org-1",
        productId: "product-1",
        locationId: "loc-1",
        lotId: null,
        qty: "3",
        movementId: "issue-m-1",
      },
    );

    expect(result.totalCost).toBe("32");
    expect(result.unitCost).toBe(String(32 / 3));
    expect(costing.layers.find((l) => l.id === "a")?.qtyRemaining).toBe("0");
    expect(costing.layers.find((l) => l.id === "b")?.qtyRemaining).toBe("4");
    expect(costing.consumptions).toHaveLength(2);
  });
});

describe("moveLayersForTransferHop", () => {
  it("preserves receivedAt and unitCost at destination", async () => {
    const costing = createFakeCosting();
    const receivedAt = new Date("2026-01-01");
    await costing.insertLayer({
      id: "src",
      orgId: "org-1",
      productId: "product-1",
      locationId: "from",
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt,
      unitCost: "10",
      qtyOriginal: "5",
      qtyRemaining: "5",
    });

    const result = await moveLayersForTransferHop(
      { costing, products },
      {
        orgId: "org-1",
        productId: "product-1",
        lotId: null,
        qty: "2",
        fromLocationId: "from",
        toLocationId: "transit",
        outMovementId: "out-1",
        inMovementId: "in-1",
        sourceDocumentType: "stock_transfer",
        sourceDocumentId: "tr-1",
        sourceDocumentLineId: "trl-1",
      },
    );

    expect(result.totalCost).toBe("20");
    expect(costing.layers.find((l) => l.id === "src")?.qtyRemaining).toBe("3");
    const dest = costing.layers.find((l) => l.locationId === "transit");
    expect(dest?.unitCost).toBe("10");
    expect(dest?.receivedAt).toEqual(receivedAt);
    expect(dest?.qtyRemaining).toBe("2");
  });
});

describe("restoreConsumptionsForVoidedMovements", () => {
  it("restores qty remaining and inserts reversal consumptions", async () => {
    const costing = createFakeCosting();
    await costing.insertLayer({
      id: "a",
      orgId: "org-1",
      productId: "product-1",
      locationId: "loc-1",
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      qtyOriginal: "5",
      qtyRemaining: "5",
    });

    await consumeFifoForMovement(
      { costing, products },
      {
        orgId: "org-1",
        productId: "product-1",
        locationId: "loc-1",
        lotId: null,
        qty: "3",
        movementId: "fwd-1",
      },
    );

    await restoreConsumptionsForVoidedMovements(
      { costing },
      {
        orgId: "org-1",
        forwardMovementIds: ["fwd-1"],
        voidMovementIdByForwardId: new Map([["fwd-1", "void-1"]]),
      },
    );

    expect(costing.layers.find((l) => l.id === "a")?.qtyRemaining).toBe("5");
    expect(costing.consumptions.filter((c) => c.isReversal)).toHaveLength(1);
    expect(costing.consumptions.find((c) => c.isReversal)?.movementId).toBe(
      "void-1",
    );
  });
});

describe("createLayerForMovement", () => {
  it("creates an open layer at location", async () => {
    const costing = createFakeCosting();
    const result = await createLayerForMovement(
      { costing, products },
      {
        orgId: "org-1",
        productId: "product-1",
        locationId: "loc-1",
        lotId: null,
        qty: "4",
        unitCost: "7",
        movementId: "m-adj",
        sourceDocumentType: "stock_adjustment",
        sourceDocumentId: "adj-1",
        sourceDocumentLineId: "adjl-1",
      },
    );
    expect(result).toEqual({ unitCost: "7", totalCost: "28" });
    expect(costing.layers).toHaveLength(1);
    expect(costing.layers[0]?.qtyRemaining).toBe("4");
  });
});
