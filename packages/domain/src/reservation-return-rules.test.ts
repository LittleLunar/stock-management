import { describe, expect, it } from "vitest";
import {
  InsufficientAvailabilityError,
  InvalidStateError,
} from "./errors.js";
import {
  assertCanCommitReservation,
  assertCanPostCustomerReturn,
  assertCanPostSupplierReturn,
  assertCanReleaseReservation,
  assertCanReserve,
  assertReservationOpen,
  availableQty,
  effectiveReservedQty,
  isReservationExpired,
  serialStatusAfterCustomerReturn,
  serialStatusAfterSupplierReturn,
  signedQtyForMovement,
} from "./inventory-rules.js";

describe("availableQty", () => {
  it("returns onHand minus reserved", () => {
    expect(availableQty("10", "3")).toBe("7");
  });

  it("floors at zero when reserved exceeds onHand", () => {
    expect(availableQty("5", "8")).toBe("0");
  });
});

describe("effectiveReservedQty", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");

  it("sums only open non-expired reservations", () => {
    expect(
      effectiveReservedQty(
        [
          { status: "open", qty: "2", expiresAt: null },
          {
            status: "open",
            qty: "3",
            expiresAt: new Date("2026-07-26T13:00:00.000Z"),
          },
          {
            status: "open",
            qty: "4",
            expiresAt: new Date("2026-07-26T11:00:00.000Z"),
          },
          { status: "committed", qty: "5", expiresAt: null },
          { status: "released", qty: "6", expiresAt: null },
        ],
        now,
      ),
    ).toBe("5");
  });

  it("treats expiresAt equal to now as expired", () => {
    expect(
      effectiveReservedQty(
        [{ status: "open", qty: "4", expiresAt: now }],
        now,
      ),
    ).toBe("0");
  });
});

describe("assertCanReserve", () => {
  it("allows reserve when qty is within available", () => {
    expect(() => assertCanReserve("10", "10")).not.toThrow();
  });

  it("throws InsufficientAvailabilityError when qty exceeds available", () => {
    expect(() => assertCanReserve("5", "6")).toThrow(
      InsufficientAvailabilityError,
    );
  });

  it("rejects non-positive reserve qty", () => {
    expect(() => assertCanReserve("5", "0")).toThrow(InvalidStateError);
  });
});

describe("isReservationExpired", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");

  it("is false when expiresAt is null", () => {
    expect(isReservationExpired({ expiresAt: null }, now)).toBe(false);
  });

  it("is true when expiresAt is at or before now", () => {
    expect(
      isReservationExpired(
        { expiresAt: new Date("2026-07-26T12:00:00.000Z") },
        now,
      ),
    ).toBe(true);
  });

  it("is false when expiresAt is in the future", () => {
    expect(
      isReservationExpired(
        { expiresAt: new Date("2026-07-26T13:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });
});

describe("reservation state guards", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");

  it("assertReservationOpen allows open only", () => {
    expect(() => assertReservationOpen({ status: "open" })).not.toThrow();
    expect(() => assertReservationOpen({ status: "committed" })).toThrow(
      InvalidStateError,
    );
    expect(() => assertReservationOpen({ status: "released" })).toThrow(
      InvalidStateError,
    );
  });

  it("assertCanCommitReservation requires open and not expired", () => {
    expect(() =>
      assertCanCommitReservation({ status: "open", expiresAt: null }, now),
    ).not.toThrow();

    expect(() =>
      assertCanCommitReservation(
        {
          status: "open",
          expiresAt: new Date("2026-07-26T11:00:00.000Z"),
        },
        now,
      ),
    ).toThrow(InvalidStateError);

    expect(() =>
      assertCanCommitReservation(
        { status: "committed", expiresAt: null },
        now,
      ),
    ).toThrow(InvalidStateError);
  });

  it("assertCanReleaseReservation allows open including expired", () => {
    expect(() =>
      assertCanReleaseReservation({ status: "open", expiresAt: null }, now),
    ).not.toThrow();
    expect(() =>
      assertCanReleaseReservation(
        {
          status: "open",
          expiresAt: new Date("2026-07-26T11:00:00.000Z"),
        },
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertCanReleaseReservation(
        { status: "released", expiresAt: null },
        now,
      ),
    ).toThrow(InvalidStateError);
  });
});

describe("return posting rules", () => {
  it("allows posting draft supplier and customer returns only", () => {
    expect(() =>
      assertCanPostSupplierReturn({ status: "draft" }),
    ).not.toThrow();
    expect(() =>
      assertCanPostCustomerReturn({ status: "draft" }),
    ).not.toThrow();
    expect(() =>
      assertCanPostSupplierReturn({ status: "posted" }),
    ).toThrow(InvalidStateError);
    expect(() =>
      assertCanPostCustomerReturn({ status: "posted" }),
    ).toThrow(InvalidStateError);
  });
});

describe("return serial statuses", () => {
  it("supplier return sets serial to returned", () => {
    expect(serialStatusAfterSupplierReturn()).toBe("returned");
  });

  it("customer return sets serial to in_stock", () => {
    expect(serialStatusAfterCustomerReturn()).toBe("in_stock");
  });
});

describe("return movement signed quantities", () => {
  it.each([
    ["supplier_return", "5", "-5"],
    ["supplier_return_void", "5", "5"],
    ["customer_return", "5", "5"],
    ["customer_return_void", "5", "-5"],
  ] as const)(
    "returns %s quantity with the correct sign",
    (type, qty, expected) => {
      expect(signedQtyForMovement(type, qty)).toBe(expected);
    },
  );
});
