import {
  LayerInUseError,
  MissingUnitCostError,
  OverReceiveError,
  UnsupportedCostingMethodError,
} from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import { PostGoodsReceipt } from "./post-goods-receipt.js";
import { VoidGoodsReceipt } from "./void-goods-receipt.js";
import {
  createPermissivePoApprovalPolicies,
  makeFake,
} from "./post-goods-receipt.harness.js";

describe("PostGoodsReceipt", () => {
  it("increases stock balance when a draft receipt is posted", async () => {
    const fake = makeFake();
    const policies = await createPermissivePoApprovalPolicies();
    const useCase = new PostGoodsReceipt(fake.uow, policies);

    const result = await useCase.execute("org-1", "user-1", "gr-1");

    expect(fake.getBalance()?.qtyOnHand).toBe("3");
    expect(fake.getReceipt().status).toBe("posted");
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.qty).toBe("3");
  });

  it("creates a cost layer and stamps movement cost on post", async () => {
    const { uow } = makeFake("3");
    const policies = await createPermissivePoApprovalPolicies();
    const result = await new PostGoodsReceipt(uow, policies).execute(
      "org-1",
      "user-1",
      "gr-1",
    );
    expect(result.movements[0]?.unitCost).toBe("10");
    expect(result.movements[0]?.totalCost).toBe("30");
    const layers = await uow.run((ctx) =>
      ctx.costing.listOpenLayers("org-1", { productId: "product-1" }),
    );
    expect(layers).toHaveLength(1);
    expect(layers[0]?.qtyRemaining).toBe("3");
    expect(layers[0]?.unitCost).toBe("10");
  });

  it("rejects post when unit cost missing and no PO cost", async () => {
    const { uow } = makeFake({
      lineUnitCost: null,
      poUnitCost: null,
      withPo: false,
    });
    const policies = await createPermissivePoApprovalPolicies();
    await expect(
      new PostGoodsReceipt(uow, policies).execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(MissingUnitCostError);
  });

  it("rejects post when product costing method is avg", async () => {
    const { uow } = makeFake({ costingMethod: "avg" });
    const policies = await createPermissivePoApprovalPolicies();
    await expect(
      new PostGoodsReceipt(uow, policies).execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(UnsupportedCostingMethodError);
  });

  it("returns the prior result for the same external idempotency key", async () => {
    const fake = makeFake();
    const policies = await createPermissivePoApprovalPolicies();
    const useCase = new PostGoodsReceipt(fake.uow, policies);
    const key = { externalSystem: "wms", externalId: "receipt-42" };

    const first = await useCase.execute("org-1", "user-1", "gr-1", key);
    const second = await useCase.execute("org-1", "user-1", "gr-1", key);

    expect(second).toEqual(first);
    expect(fake.getMovements()).toHaveLength(1);
    expect(fake.getBalance()?.qtyOnHand).toBe("3");
  });

  it("rejects receiving more than the purchase order quantity", async () => {
    const fake = makeFake("6");
    const policies = await createPermissivePoApprovalPolicies();
    const useCase = new PostGoodsReceipt(fake.uow, policies);

    await expect(
      useCase.execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(OverReceiveError);
    expect(fake.getBalance()).toBeNull();
    expect(fake.getMovements()).toHaveLength(0);
  });
});

describe("VoidGoodsReceipt", () => {
  it("reverses receipt movements and restores the stock balance", async () => {
    const fake = makeFake();
    const policies = await createPermissivePoApprovalPolicies();
    await new PostGoodsReceipt(fake.uow, policies).execute(
      "org-1",
      "user-1",
      "gr-1",
    );

    const result = await new VoidGoodsReceipt(fake.uow).execute(
      "org-1",
      "user-1",
      "gr-1",
    );

    expect(fake.getBalance()?.qtyOnHand).toBe("0");
    expect(fake.getReceipt().status).toBe("void");
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.movementType).toBe("receipt_void");
    expect(result.movements[0]?.qty).toBe("-3");
  });

  it("void closes open layers", async () => {
    const { uow } = makeFake("3");
    const policies = await createPermissivePoApprovalPolicies();
    await new PostGoodsReceipt(uow, policies).execute("org-1", "user-1", "gr-1");
    await new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    const open = await uow.run((ctx) =>
      ctx.costing.listOpenLayers("org-1", { productId: "product-1" }),
    );
    expect(open).toHaveLength(0);
  });

  it("enriches GR void outbox with inventoryValueDelta", async () => {
    const { uow, outbox } = makeFake("3");
    const policies = await createPermissivePoApprovalPolicies();
    await new PostGoodsReceipt(uow, policies).execute("org-1", "user-1", "gr-1");
    await new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1");
    const voidEvt = outbox.find(
      (e) =>
        e.eventType === "document.voided" && e.aggregateType === "goods_receipt",
    );
    expect(voidEvt?.payload.inventoryValueDelta).toBe("30");
  });

  it("includes branchId on document.posted outbox payload", async () => {
    const { uow, outbox } = makeFake("3");
    const policies = await createPermissivePoApprovalPolicies();
    await new PostGoodsReceipt(uow, policies).execute("org-1", "user-1", "gr-1");
    const posted = outbox.find(
      (e) =>
        e.eventType === "document.posted" && e.aggregateType === "goods_receipt",
    );
    expect(posted?.payload.branchId).toBe("branch-1");
  });

  it("void rejects when layer partially consumed", async () => {
    const { uow, partiallyConsumeLayer } = makeFake("3");
    const policies = await createPermissivePoApprovalPolicies();
    await new PostGoodsReceipt(uow, policies).execute("org-1", "user-1", "gr-1");
    partiallyConsumeLayer("gr-line-1", "1");
    await expect(
      new VoidGoodsReceipt(uow).execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(LayerInUseError);
  });
});
