import { describe, expect, it } from "vitest";
import {
  InvalidStateError,
  OverReceiveError,
  TrackingRequiredError,
} from "./errors.js";
import {
  assertCanPostReceipt,
  assertCanSubmitPo,
  assertLotSerialRules,
  assertNoOverReceive,
  signedQtyForMovement,
} from "./inventory-rules.js";

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

describe("assertNoOverReceive", () => {
  it("allows receive within ordered quantity", () => {
    expect(() => assertNoOverReceive("10", "6", "4")).not.toThrow();
  });

  it("throws OverReceiveError when cumulative receive exceeds ordered", () => {
    expect(() => assertNoOverReceive("10", "8", "3")).toThrow(
      OverReceiveError,
    );
  });
});

describe("signedQtyForMovement", () => {
  it("returns positive qty for receipt", () => {
    expect(signedQtyForMovement("receipt", "5")).toBe("5");
  });

  it("returns negative qty for receipt_void", () => {
    expect(signedQtyForMovement("receipt_void", "5")).toBe("-5");
  });
});
