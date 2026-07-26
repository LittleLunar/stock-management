import { describe, expect, it } from "vitest";
import {
  AllocationMismatchError,
  InvalidStateError,
  LayerInUseError,
} from "@stock-management/domain";
import { createFakeCosting } from "../costing/fake-costing.js";
import type {
  CreateLandedCostInput,
  LandedCostDocument,
  LandedCostPort,
  UpdateLandedCostInput,
} from "../ports/landed-cost.js";
import type {
  CostRevaluation,
  CostRevaluationPort,
  CreateCostRevaluationInput,
  UpdateCostRevaluationInput,
} from "../ports/revaluation.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import {
  LandedCostUseCases,
  PostLandedCost,
  VoidLandedCost,
} from "./landed-cost.js";
import {
  CostRevaluationUseCases,
  PostCostRevaluation,
  VoidCostRevaluation,
} from "./cost-revaluation.js";

const ORG = "org-1";
const USER = "user-1";
const BRANCH = "branch-1";
const PRODUCT = "product-1";
const LOCATION = "loc-1";

function createMemoryLandedCosts(): LandedCostPort & {
  docs: Map<string, LandedCostDocument>;
} {
  const docs = new Map<string, LandedCostDocument>();
  let seq = 0;
  return {
    docs,
    async create(orgId, input: CreateLandedCostInput) {
      const id = `lc-${++seq}`;
      const now = new Date();
      const doc: LandedCostDocument = {
        id,
        orgId,
        branchId: input.branchId,
        supplierId: input.supplierId ?? null,
        costType: input.costType,
        totalAmount: input.totalAmount,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line, index) => ({
          id: `lcl-${seq}-${index + 1}`,
          orgId,
          landedCostDocumentId: id,
          lineNumber: index + 1,
          goodsReceiptLineId: line.goodsReceiptLineId ?? null,
          costLayerId: line.costLayerId ?? null,
          amount: line.amount,
        })),
      };
      docs.set(id, doc);
      return doc;
    },
    async findById(orgId, id) {
      const doc = docs.get(id);
      return doc?.orgId === orgId ? structuredClone(doc) : null;
    },
    async list(orgId) {
      return [...docs.values()]
        .filter((d) => d.orgId === orgId)
        .map((d) => structuredClone(d));
    },
    async update(orgId, id, input: UpdateLandedCostInput) {
      const current = docs.get(id);
      if (!current || current.orgId !== orgId) return null as never;
      const updated: LandedCostDocument = {
        ...current,
        supplierId:
          input.supplierId !== undefined ? input.supplierId : current.supplierId,
        costType: input.costType ?? current.costType,
        totalAmount: input.totalAmount ?? current.totalAmount,
        lines: input.lines
          ? input.lines.map((line, index) => ({
              id: `lcl-${id}-${index + 1}`,
              orgId,
              landedCostDocumentId: id,
              lineNumber: index + 1,
              goodsReceiptLineId: line.goodsReceiptLineId ?? null,
              costLayerId: line.costLayerId ?? null,
              amount: line.amount,
            }))
          : current.lines,
        updatedAt: new Date(),
      };
      docs.set(id, updated);
      return structuredClone(updated);
    },
    async updateStatus(orgId, id, status, at) {
      const current = docs.get(id);
      if (!current || current.orgId !== orgId) throw new Error("missing");
      const updated: LandedCostDocument = {
        ...current,
        status,
        postedAt: status === "posted" ? at : current.postedAt,
        voidedAt: status === "void" ? at : current.voidedAt,
        updatedAt: at,
      };
      docs.set(id, updated);
      return structuredClone(updated);
    },
  };
}

function createMemoryRevaluations(): CostRevaluationPort & {
  docs: Map<string, CostRevaluation>;
} {
  const docs = new Map<string, CostRevaluation>();
  let seq = 0;
  return {
    docs,
    async create(orgId, input: CreateCostRevaluationInput) {
      const id = `rv-${++seq}`;
      const now = new Date();
      const doc: CostRevaluation = {
        id,
        orgId,
        branchId: input.branchId,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line, index) => ({
          id: `rvl-${seq}-${index + 1}`,
          orgId,
          costRevaluationId: id,
          lineNumber: index + 1,
          costLayerId: line.costLayerId,
          newUnitCost: line.newUnitCost,
        })),
      };
      docs.set(id, doc);
      return doc;
    },
    async findById(orgId, id) {
      const doc = docs.get(id);
      return doc?.orgId === orgId ? structuredClone(doc) : null;
    },
    async list(orgId) {
      return [...docs.values()]
        .filter((d) => d.orgId === orgId)
        .map((d) => structuredClone(d));
    },
    async update(orgId, id, input: UpdateCostRevaluationInput) {
      const current = docs.get(id);
      if (!current || current.orgId !== orgId) return null as never;
      const updated: CostRevaluation = {
        ...current,
        reasonCode: input.reasonCode ?? current.reasonCode,
        reasonNote:
          input.reasonNote !== undefined ? input.reasonNote : current.reasonNote,
        lines: input.lines
          ? input.lines.map((line, index) => ({
              id: `rvl-${id}-${index + 1}`,
              orgId,
              costRevaluationId: id,
              lineNumber: index + 1,
              costLayerId: line.costLayerId,
              newUnitCost: line.newUnitCost,
            }))
          : current.lines,
        updatedAt: new Date(),
      };
      docs.set(id, updated);
      return structuredClone(updated);
    },
    async updateStatus(orgId, id, status, at) {
      const current = docs.get(id);
      if (!current || current.orgId !== orgId) throw new Error("missing");
      const updated: CostRevaluation = {
        ...current,
        status,
        postedAt: status === "posted" ? at : current.postedAt,
        voidedAt: status === "void" ? at : current.voidedAt,
        updatedAt: at,
      };
      docs.set(id, updated);
      return structuredClone(updated);
    },
  };
}

function makeUow(partial: Partial<UowContext>): UnitOfWork {
  return {
    run: (fn) =>
      fn({
        po: {} as UowContext["po"],
        gr: {} as UowContext["gr"],
        products: {} as UowContext["products"],
        stock: {} as UowContext["stock"],
        lots: {} as UowContext["lots"],
        serials: {} as UowContext["serials"],
        costing: createFakeCosting(),
        outbox: { enqueue: async () => {} },
        idempotency: {
          find: async () => null,
          save: async () => {},
        },
        ...partial,
      } as UowContext),
  };
}

describe("landed cost", () => {
  it("posts and increases unit cost; void restores", async () => {
    const costing = createFakeCosting();
    const layer = await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOCATION,
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
    const landedCosts = createMemoryLandedCosts();
    const uow = makeUow({ costing, landedCosts });
    const crud = new LandedCostUseCases(landedCosts);
    const doc = await crud.create(ORG, {
      branchId: BRANCH,
      costType: "freight",
      totalAmount: "10",
      lines: [{ costLayerId: layer.id, amount: "10" }],
    });

    await new PostLandedCost(uow).execute(ORG, USER, doc.id);
    expect((await costing.getLayer(ORG, layer.id))?.unitCost).toBe("12");

    await new VoidLandedCost(uow).execute(ORG, USER, doc.id);
    expect((await costing.getLayer(ORG, layer.id))?.unitCost).toBe("10");
    expect((await landedCosts.findById(ORG, doc.id))?.status).toBe("void");
  });

  it("rejects allocation mismatch", async () => {
    const costing = createFakeCosting();
    const layer = await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOCATION,
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
    const landedCosts = createMemoryLandedCosts();
    const uow = makeUow({ costing, landedCosts });
    const doc = await landedCosts.create(ORG, {
      branchId: BRANCH,
      costType: "duty",
      totalAmount: "100",
      lines: [{ costLayerId: layer.id, amount: "10" }],
    });
    await expect(
      new PostLandedCost(uow).execute(ORG, USER, doc.id),
    ).rejects.toBeInstanceOf(AllocationMismatchError);
  });

  it("rejects fully consumed layer", async () => {
    const costing = createFakeCosting();
    const layer = await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOCATION,
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      originalUnitCost: "10",
      qtyOriginal: "5",
      qtyRemaining: "0",
    });
    const landedCosts = createMemoryLandedCosts();
    const uow = makeUow({ costing, landedCosts });
    const doc = await landedCosts.create(ORG, {
      branchId: BRANCH,
      costType: "other",
      totalAmount: "5",
      lines: [{ costLayerId: layer.id, amount: "5" }],
    });
    await expect(
      new PostLandedCost(uow).execute(ORG, USER, doc.id),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("rejects void when a later adjustment exists", async () => {
    const costing = createFakeCosting();
    const layer = await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOCATION,
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
    const landedCosts = createMemoryLandedCosts();
    const uow = makeUow({ costing, landedCosts });
    const doc = await landedCosts.create(ORG, {
      branchId: BRANCH,
      costType: "freight",
      totalAmount: "10",
      lines: [{ costLayerId: layer.id, amount: "10" }],
    });
    await new PostLandedCost(uow).execute(ORG, USER, doc.id);
    await costing.insertValueAdjustment({
      orgId: ORG,
      costLayerId: layer.id,
      effectiveAt: new Date("2026-12-01"),
      oldUnitCost: "12",
      newUnitCost: "13",
      amount: "5",
      sourceDocumentType: "cost_revaluation",
      sourceDocumentId: "other",
      sourceDocumentLineId: null,
    });
    await expect(
      new VoidLandedCost(uow).execute(ORG, USER, doc.id),
    ).rejects.toBeInstanceOf(LayerInUseError);
  });
});

describe("cost revaluation", () => {
  it("posts new unit cost and voids restore", async () => {
    const costing = createFakeCosting();
    const layer = await costing.insertLayer({
      orgId: ORG,
      productId: PRODUCT,
      locationId: LOCATION,
      lotId: null,
      sourceDocumentType: "goods_receipt",
      sourceDocumentId: "gr-1",
      sourceDocumentLineId: "grl-1",
      sourceMovementId: "m-1",
      receivedAt: new Date("2026-01-01"),
      unitCost: "10",
      originalUnitCost: "10",
      qtyOriginal: "4",
      qtyRemaining: "4",
    });
    const revaluations = createMemoryRevaluations();
    const uow = makeUow({ costing, revaluations });
    const crud = new CostRevaluationUseCases(revaluations);
    const doc = await crud.create(ORG, {
      branchId: BRANCH,
      reasonCode: "write_down",
      lines: [{ costLayerId: layer.id, newUnitCost: "7" }],
    });
    await new PostCostRevaluation(uow).execute(ORG, USER, doc.id);
    expect((await costing.getLayer(ORG, layer.id))?.unitCost).toBe("7");
    await new VoidCostRevaluation(uow).execute(ORG, USER, doc.id);
    expect((await costing.getLayer(ORG, layer.id))?.unitCost).toBe("10");
  });
});
