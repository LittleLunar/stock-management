import { describe, expect, it } from "vitest";
import {
  InvalidStateError,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from "@stock-management/domain";
import type { PurchaseOrderPort } from "../ports/inventory.js";
import { PurchaseOrderUseCases } from "./purchase-order.js";

const now = new Date("2026-07-26T12:00:00.000Z");

function createPoPort(initial: PurchaseOrder): PurchaseOrderPort {
  let current: PurchaseOrder & { lines: PurchaseOrderLine[] } = {
    ...initial,
    lines: [],
  };
  return {
    async list() {
      return [current];
    },
    async findById(_orgId, id) {
      return id === current.id ? current : null;
    },
    async findLineById() {
      return null;
    },
    async create() {
      return current;
    },
    async update() {
      return current;
    },
    async updateLineReceivedQty() {
      throw new Error("not used");
    },
    async updateStatus(_orgId, id, status) {
      if (id !== current.id) throw new Error("missing");
      current = { ...current, status, updatedAt: now };
      return current;
    },
  };
}

describe("PurchaseOrderUseCases.approve", () => {
  it("approve moves submitted → approved", async () => {
    const po: PurchaseOrder = {
      id: "po-1",
      orgId: "org-1",
      supplierId: "sup-1",
      branchId: "branch-1",
      status: "submitted",
      documentNumber: "PO-1",
      expectedDate: null,
      createdAt: now,
      updatedAt: now,
    };
    const uc = new PurchaseOrderUseCases(createPoPort(po));
    const approved = await uc.approve("org-1", "po-1");
    expect(approved.status).toBe("approved");
  });

  it("approve rejects draft", async () => {
    const po: PurchaseOrder = {
      id: "po-1",
      orgId: "org-1",
      supplierId: "sup-1",
      branchId: "branch-1",
      status: "draft",
      documentNumber: "PO-1",
      expectedDate: null,
      createdAt: now,
      updatedAt: now,
    };
    const uc = new PurchaseOrderUseCases(createPoPort(po));
    await expect(uc.approve("org-1", "po-1")).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });
});
