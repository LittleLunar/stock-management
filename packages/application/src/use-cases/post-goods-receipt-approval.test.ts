import { describe, expect, it } from "vitest";
import { InvalidStateError } from "@stock-management/domain";
import { ApprovalPolicyUseCases } from "./approval-policy.js";
import { createFakeApprovalPolicyPort } from "./approval-policy.harness.js";
import { PostGoodsReceipt } from "./post-goods-receipt.js";
import { makeFake } from "./post-goods-receipt.harness.js";

describe("PostGoodsReceipt PO approval gate", () => {
  it("blocks GR when policy required and PO is submitted", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "purchase_order", true);
    const fake = makeFake({ poStatus: "submitted" });
    const useCase = new PostGoodsReceipt(fake.uow, policies);

    await expect(
      useCase.execute("org-1", "user-1", "gr-1"),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      useCase.execute("org-1", "user-1", "gr-1"),
    ).rejects.toThrow(/must be approved before goods receipt/i);
  });

  it("allows GR when policy required and PO is approved", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "purchase_order", true);
    const fake = makeFake({ poStatus: "approved" });
    const useCase = new PostGoodsReceipt(fake.uow, policies);

    const result = await useCase.execute("org-1", "user-1", "gr-1");
    expect(result.receipt.status).toBe("posted");
  });

  it("allows GR on submitted when policy not required", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "purchase_order", false);
    const fake = makeFake({ poStatus: "submitted" });
    const useCase = new PostGoodsReceipt(fake.uow, policies);

    const result = await useCase.execute("org-1", "user-1", "gr-1");
    expect(result.receipt.status).toBe("posted");
  });

  it("keeps approved PO when GR posts with zero effective receive", async () => {
    const policies = new ApprovalPolicyUseCases(createFakeApprovalPolicyPort());
    await policies.upsert("org-1", "purchase_order", true);
    const fake = makeFake({ poStatus: "approved", receivingQty: "0" });
    const useCase = new PostGoodsReceipt(fake.uow, policies);

    const result = await useCase.execute("org-1", "user-1", "gr-1");
    expect(result.receipt.status).toBe("posted");
    expect(fake.getPo().status).toBe("approved");
  });
});
