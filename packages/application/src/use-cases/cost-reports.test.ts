import { describe, expect, it } from "vitest";
import type { Location } from "@stock-management/domain";
import { createFakeCosting } from "../costing/fake-costing.js";
import type { LocationLookupPort } from "../ports/inventory.js";
import { CogsReportUseCases, type CogsSourceRow } from "./cogs-report.js";
import { ValuationReportUseCases } from "./valuation-report.js";

const ORG = "org-1";
const BRANCH = "branch-1";
const LOC = "loc-1";
const PRODUCT = "p-1";

function fakeLocations(): LocationLookupPort {
  const loc: Location = {
    id: LOC,
    orgId: ORG,
    branchId: BRANCH,
    name: "Main",
    type: "storage",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    async findById(orgId, id) {
      return orgId === ORG && id === LOC ? loc : null;
    },
    async list(orgId, branchId) {
      if (orgId !== ORG) return [];
      if (branchId && branchId !== BRANCH) return [];
      return [loc];
    },
  };
}

describe("ValuationReportUseCases", () => {
  it("values current open layers", async () => {
    const costing = createFakeCosting();
    await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOC,
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      originalUnitCost: "10",
      qtyOriginal: "5",
      qtyRemaining: "5",
    });
    const report = new ValuationReportUseCases(costing, fakeLocations());
    const result = await report.listValuation(ORG, {});
    expect(result.totalValue).toBe("50");
    expect(result.rows[0]).toMatchObject({
      productId: PRODUCT,
      qty: "5",
      unitCost: "10",
      value: "50",
      branchId: BRANCH,
    });
  });

  it("reconstructs as-of after partial consume and reval", async () => {
    const costing = createFakeCosting();
    const layer = await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOC,
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      originalUnitCost: "10",
      qtyOriginal: "10",
      qtyRemaining: "4",
    });
    await costing.insertConsumption({
      orgId: ORG,
      costLayerId: layer.id,
      movementId: "m-issue",
      qty: "6",
      unitCost: "10",
      totalCost: "60",
      isReversal: false,
    });
    // backdate consumption
    costing.consumptions[0]!.createdAt = new Date("2026-02-01");
    await costing.insertValueAdjustment({
      orgId: ORG,
      costLayerId: layer.id,
      effectiveAt: new Date("2026-03-01"),
      oldUnitCost: "10",
      newUnitCost: "12",
      amount: "8",
      sourceDocumentType: "cost_revaluation",
      sourceDocumentId: "rv-1",
      sourceDocumentLineId: "rvl-1",
    });
    await costing.updateLayerUnitCost(ORG, layer.id, "12");

    const report = new ValuationReportUseCases(costing, fakeLocations());
    const beforeReval = await report.listValuation(ORG, {
      asOf: new Date("2026-02-15"),
    });
    expect(beforeReval.rows[0]).toMatchObject({
      qty: "4",
      unitCost: "10",
      value: "40",
    });

    const afterReval = await report.listValuation(ORG, {
      asOf: new Date("2026-03-15"),
    });
    expect(afterReval.rows[0]).toMatchObject({
      qty: "4",
      unitCost: "12",
      value: "48",
    });
  });
});

describe("CogsReportUseCases", () => {
  it("sums posted outbound COGS and excludes transfers and voided docs", async () => {
    const rows: CogsSourceRow[] = [
      {
        branchId: BRANCH,
        movementType: "issue",
        documentType: "stock_issue",
        totalCost: "30",
        createdAt: new Date("2026-06-01"),
        documentStatus: "posted",
      },
      {
        branchId: BRANCH,
        movementType: "transfer_out",
        documentType: "stock_transfer",
        totalCost: "99",
        createdAt: new Date("2026-06-01"),
        documentStatus: "posted",
      },
      {
        branchId: BRANCH,
        movementType: "issue",
        documentType: "stock_issue",
        totalCost: "20",
        createdAt: new Date("2026-06-02"),
        documentStatus: "void",
      },
      {
        branchId: BRANCH,
        movementType: "supplier_return",
        documentType: "supplier_return",
        totalCost: "5",
        createdAt: new Date("2026-06-03"),
        documentStatus: "posted",
      },
    ];
    const report = new CogsReportUseCases({
      async listOutboundMovements() {
        return rows;
      },
    });
    const result = await report.listCogs(ORG, {
      from: new Date("2026-05-01"),
      to: new Date("2026-07-01"),
    });
    expect(result.totalCogs).toBe("35");
    expect(result.rows).toHaveLength(2);
  });
});
