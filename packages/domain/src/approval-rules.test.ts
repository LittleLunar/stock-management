import { describe, expect, it } from "vitest";
import {
  assertCanApproveAdjustment,
  assertCanApprovePo,
  assertCanPostAdjustment,
  assertCanSubmitAdjustment,
  assertPoReceivable,
} from "./inventory-rules.js";
import { InvalidStateError } from "./errors.js";
import { canPerform } from "./access.js";

describe("canPerform document.approve", () => {
  it("allows org_admin and branch_manager only", () => {
    expect(canPerform("org_admin", "document.approve")).toBe(true);
    expect(canPerform("branch_manager", "document.approve")).toBe(true);
    expect(canPerform("warehouse", "document.approve")).toBe(false);
    expect(canPerform("purchasing", "document.approve")).toBe(false);
    expect(canPerform("accountant", "document.approve")).toBe(false);
  });
});

describe("PO approve / receivable", () => {
  it("approve only from submitted", () => {
    expect(() => assertCanApprovePo({ status: "submitted" })).not.toThrow();
    expect(() => assertCanApprovePo({ status: "draft" })).toThrow(
      InvalidStateError,
    );
    expect(() => assertCanApprovePo({ status: "approved" })).toThrow(
      InvalidStateError,
    );
  });

  it("blocks GR on submitted when policy required", () => {
    expect(() =>
      assertPoReceivable({ status: "submitted" }, { required: true }),
    ).toThrow(InvalidStateError);
  });

  it("allows GR on approved when policy required", () => {
    expect(() =>
      assertPoReceivable({ status: "approved" }, { required: true }),
    ).not.toThrow();
  });

  it("allows GR on submitted when policy not required", () => {
    expect(() =>
      assertPoReceivable({ status: "submitted" }, { required: false }),
    ).not.toThrow();
  });
});

describe("adjustment approval lifecycle", () => {
  it("submit from draft only", () => {
    expect(() =>
      assertCanSubmitAdjustment({ status: "draft" }),
    ).not.toThrow();
    expect(() =>
      assertCanSubmitAdjustment({ status: "pending_approval" }),
    ).toThrow(InvalidStateError);
  });

  it("approve from pending_approval only", () => {
    expect(() =>
      assertCanApproveAdjustment({ status: "pending_approval" }),
    ).not.toThrow();
    expect(() =>
      assertCanApproveAdjustment({ status: "draft" }),
    ).toThrow(InvalidStateError);
  });

  it("post requires approved when policy on", () => {
    expect(() =>
      assertCanPostAdjustment({ status: "draft" }, { required: true }),
    ).toThrow(InvalidStateError);
    expect(() =>
      assertCanPostAdjustment({ status: "approved" }, { required: true }),
    ).not.toThrow();
  });

  it("post allows draft when policy off", () => {
    expect(() =>
      assertCanPostAdjustment({ status: "draft" }, { required: false }),
    ).not.toThrow();
  });
});
