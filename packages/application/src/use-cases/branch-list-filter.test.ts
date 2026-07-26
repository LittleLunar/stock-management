import { describe, expect, it } from "vitest";
import { canPerform } from "@stock-management/domain";
import type { PurchaseOrder, StockTransfer } from "@stock-management/domain";
import { listFilterFromContext } from "../access/list-scope.js";
import type {
  PurchaseOrderPort,
  StockTransferPort,
} from "../ports/inventory.js";
import { PurchaseOrderUseCases } from "./purchase-order.js";
import { StockTransferUseCases } from "./stock-transfer.js";

describe("listFilterFromContext", () => {
  it("HQ consolidated → all", () => {
    expect(listFilterFromContext({ activeBranchId: null })).toEqual({
      kind: "all",
    });
  });
  it("active branch → branch filter", () => {
    expect(listFilterFromContext({ activeBranchId: "b1" })).toEqual({
      kind: "branch",
      branchId: "b1",
    });
  });
});

describe("PurchaseOrderUseCases.list filter", () => {
  it("passes filter to port", async () => {
    const seen: unknown[] = [];
    const repo = {
      list: async (_org: string, filter?: unknown) => {
        seen.push(filter);
        return [] as PurchaseOrder[];
      },
    } as unknown as PurchaseOrderPort;
    const uc = new PurchaseOrderUseCases(repo);
    await uc.list("org-1", { kind: "branch", branchId: "b1" });
    expect(seen[0]).toEqual({ kind: "branch", branchId: "b1" });
  });
});

describe("StockTransferUseCases.list filter", () => {
  it("passes filter to port", async () => {
    const seen: unknown[] = [];
    const repo = {
      list: async (_org: string, filter?: unknown) => {
        seen.push(filter);
        return [] as StockTransfer[];
      },
    } as unknown as StockTransferPort;
    const uc = new StockTransferUseCases(repo);
    await uc.list("org-1", { kind: "branch", branchId: "b1" });
    expect(seen[0]).toEqual({ kind: "branch", branchId: "b1" });
  });
});

describe("canPerform write gate", () => {
  it("warehouse cannot po.write", () => {
    expect(canPerform("warehouse", "po.write")).toBe(false);
  });
});
