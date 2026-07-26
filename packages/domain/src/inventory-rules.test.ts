import { describe, expect, it } from "vitest";
import {
  InvalidStateError,
  OverReceiveError,
  TrackingRequiredError,
} from "./errors.js";
import {
  assertCanPostAdjustment,
  assertCanPostCount,
  assertCanPostIssue,
  assertCanPostReceipt,
  assertCanReceiveTransfer,
  assertCanShipTransfer,
  assertCanSubmitPo,
  assertCanVoidTransfer,
  assertLotSerialRules,
  assertNoOverReceive,
  assertSerialAvailableForOutbound,
  assertSignedAdjustmentQty,
  countVariance,
  signedQtyForMovement,
} from "./inventory-rules.js";
import { ISSUE_TYPES } from "./types.js";

describe("assertCanSubmitPo", () => {
  it("allows submit from draft", () => {
    expect(() => assertCanSubmitPo({ status: "draft" })).not.toThrow();
  });

  it("throws InvalidStateError when submitting cancelled PO", () => {
    expect(() => assertCanSubmitPo({ status: "cancelled" })).toThrow(
      InvalidStateError,
    );
  });
});

describe("assertCanPostReceipt", () => {
  it("allows post from draft", () => {
    expect(() => assertCanPostReceipt({ status: "draft" })).not.toThrow();
  });

  it("throws InvalidStateError when posting non-draft receipt", () => {
    expect(() => assertCanPostReceipt({ status: "posted" })).toThrow(
      InvalidStateError,
    );
  });
});

describe("assertLotSerialRules", () => {
  it("throws TrackingRequiredError when trackLot but no lotId", () => {
    expect(() =>
      assertLotSerialRules(
        { trackLot: true, trackSerial: false },
        { lotId: null, serialNumbers: [] },
      ),
    ).toThrow(TrackingRequiredError);
  });

  it("throws TrackingRequiredError when trackSerial but no serials", () => {
    expect(() =>
      assertLotSerialRules(
        { trackLot: false, trackSerial: true },
        { lotId: null, serialNumbers: [] },
      ),
    ).toThrow(TrackingRequiredError);
  });

  it("passes when tracking requirements are satisfied", () => {
    expect(() =>
      assertLotSerialRules(
        { trackLot: true, trackSerial: true },
        { lotId: "lot-1", serialNumbers: ["SN-001"] },
      ),
    ).not.toThrow();
  });
});

describe("assertSerialAvailableForOutbound", () => {
  it("allows an in-stock serial at the source location", () => {
    expect(() =>
      assertSerialAvailableForOutbound(
        { status: "in_stock", locationId: "location-1" },
        "location-1",
      ),
    ).not.toThrow();
  });

  it("rejects a serial that is not in stock", () => {
    expect(() =>
      assertSerialAvailableForOutbound(
        { status: "issued", locationId: "location-1" },
        "location-1",
      ),
    ).toThrow(InvalidStateError);
  });

  it("rejects a serial outside the source location", () => {
    expect(() =>
      assertSerialAvailableForOutbound(
        { status: "in_stock", locationId: "location-2" },
        "location-1",
      ),
    ).toThrow(InvalidStateError);
  });
});

describe("assertNoOverReceive", () => {
  it("allows receive within ordered quantity", () => {
    expect(() => assertNoOverReceive("10", "6", "4")).not.toThrow();
  });

  it("throws OverReceiveError when cumulative receive exceeds ordered", () => {
    expect(() => assertNoOverReceive("10", "8", "3")).toThrow(OverReceiveError);
  });
});

describe("signedQtyForMovement", () => {
  it("returns positive qty for receipt", () => {
    expect(signedQtyForMovement("receipt", "5")).toBe("5");
  });

  it("returns negative qty for receipt_void", () => {
    expect(signedQtyForMovement("receipt_void", "5")).toBe("-5");
  });

  it.each([
    ["issue", "5", "-5"],
    ["issue_void", "5", "5"],
    ["transfer_out", "5", "-5"],
    ["transfer_out_void", "5", "5"],
    ["transfer_in", "5", "5"],
    ["transfer_in_void", "5", "-5"],
    ["adjustment", "-5", "-5"],
    ["adjustment_void", "-5", "5"],
    ["count_variance", "5", "5"],
    ["count_variance_void", "5", "-5"],
  ] as const)(
    "returns %s quantity with the correct sign",
    (type, qty, expected) => {
      expect(signedQtyForMovement(type, qty)).toBe(expected);
    },
  );
});

describe("transfer state rules", () => {
  it("throws InvalidStateError when shipping a non-draft transfer", () => {
    expect(() => assertCanShipTransfer({ status: "in_transit" })).toThrow(
      InvalidStateError,
    );
  });

  it("allows receiving only an in-transit transfer", () => {
    expect(() =>
      assertCanReceiveTransfer({ status: "in_transit" }),
    ).not.toThrow();
    expect(() => assertCanReceiveTransfer({ status: "draft" })).toThrow(
      InvalidStateError,
    );
  });

  it("throws InvalidStateError when voiding a received transfer", () => {
    expect(() => assertCanVoidTransfer({ status: "received" })).toThrow(
      InvalidStateError,
    );
  });

  it.each(["draft", "in_transit"] as const)("allows void from %s", (status) => {
    expect(() => assertCanVoidTransfer({ status })).not.toThrow();
  });
});

describe("outbound document posting rules", () => {
  it.each([
    ["issue", assertCanPostIssue],
    ["count", assertCanPostCount],
  ] as const)("allows posting a draft %s only", (_name, assertion) => {
    expect(() => assertion({ status: "draft" })).not.toThrow();
    expect(() => assertion({ status: "posted" })).toThrow(InvalidStateError);
  });

  it("allows posting a draft adjustment when policy not required", () => {
    expect(() =>
      assertCanPostAdjustment({ status: "draft" }, { required: false }),
    ).not.toThrow();
    expect(() =>
      assertCanPostAdjustment({ status: "posted" }, { required: false }),
    ).toThrow(InvalidStateError);
  });
});

describe("countVariance", () => {
  it("returns counted minus expected as a signed quantity", () => {
    expect(countVariance("10", "7")).toBe("-3");
    expect(countVariance("7", "10")).toBe("3");
  });
});

describe("assertSignedAdjustmentQty", () => {
  it("rejects zero", () => {
    expect(() => assertSignedAdjustmentQty("0")).toThrow(InvalidStateError);
  });

  it.each(["2.5", "-2.5"])("allows non-zero signed quantity %s", (qty) => {
    expect(() => assertSignedAdjustmentQty(qty)).not.toThrow();
  });
});

describe("issue types", () => {
  it("provides the locked issue classifications", () => {
    expect(ISSUE_TYPES).toEqual(["consume", "sample", "write_off", "other"]);
  });
});
