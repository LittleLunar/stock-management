import { describe, expect, it } from "vitest";
import {
  assertLotSellable,
  isLotExpired,
  isQuarantineReleasePath,
  pickFefoLot,
} from "./fefo.js";
import {
  LocationQuarantinedError,
  LotExpiredError,
  LotQuarantinedError,
} from "./errors.js";

const today = new Date("2026-07-26T12:00:00.000Z");
const storage = { id: "loc-1", type: "storage" as const };
const quarantineLoc = { id: "loc-q", type: "quarantine" as const };

describe("isLotExpired", () => {
  it("false when no expiry", () => {
    expect(isLotExpired(null, today)).toBe(false);
  });
  it("false when expiry is today", () => {
    expect(isLotExpired(new Date("2026-07-26T00:00:00.000Z"), today)).toBe(
      false,
    );
  });
  it("true when expiry before today", () => {
    expect(isLotExpired(new Date("2026-07-25T00:00:00.000Z"), today)).toBe(
      true,
    );
  });
});

describe("isQuarantineReleasePath", () => {
  it("never for issue or reservation_commit", () => {
    expect(
      isQuarantineReleasePath({
        operation: "issue",
        fromLocationType: "quarantine",
        toLocationType: "storage",
      }),
    ).toBe(false);
    expect(
      isQuarantineReleasePath({
        operation: "reservation_commit",
        fromLocationType: "quarantine",
      }),
    ).toBe(false);
  });
  it("true for transfer quarantine → storage", () => {
    expect(
      isQuarantineReleasePath({
        operation: "transfer_ship",
        fromLocationType: "quarantine",
        toLocationType: "storage",
      }),
    ).toBe(true);
  });
  it("false for transfer quarantine → quarantine", () => {
    expect(
      isQuarantineReleasePath({
        operation: "transfer_ship",
        fromLocationType: "quarantine",
        toLocationType: "quarantine",
      }),
    ).toBe(false);
  });
  it("true for adjustment at quarantine", () => {
    expect(
      isQuarantineReleasePath({
        operation: "adjustment",
        fromLocationType: "quarantine",
      }),
    ).toBe(true);
  });
});

describe("assertLotSellable", () => {
  const activeLot = {
    id: "lot-1",
    expiryDate: new Date("2026-08-01T00:00:00.000Z"),
    status: "active" as const,
  };

  it("allows active non-expired at storage", () => {
    expect(() =>
      assertLotSellable(activeLot, storage, today),
    ).not.toThrow();
  });

  it("blocks expired lot", () => {
    expect(() =>
      assertLotSellable(
        { ...activeLot, expiryDate: new Date("2026-07-01T00:00:00.000Z") },
        storage,
        today,
      ),
    ).toThrow(LotExpiredError);
  });

  it("blocks quarantined lot", () => {
    expect(() =>
      assertLotSellable(
        { ...activeLot, status: "quarantine" },
        storage,
        today,
      ),
    ).toThrow(LotQuarantinedError);
  });

  it("blocks quarantine location", () => {
    expect(() =>
      assertLotSellable(activeLot, quarantineLoc, today),
    ).toThrow(LocationQuarantinedError);
  });

  it("allows expired on quarantine release", () => {
    expect(() =>
      assertLotSellable(
        {
          ...activeLot,
          expiryDate: new Date("2026-07-01T00:00:00.000Z"),
          status: "quarantine",
        },
        quarantineLoc,
        today,
        { isQuarantineRelease: true },
      ),
    ).not.toThrow();
  });
});

describe("pickFefoLot", () => {
  it("picks earliest expiry among sellable", () => {
    const id = pickFefoLot(
      [
        {
          id: "late",
          expiryDate: new Date("2026-09-01T00:00:00.000Z"),
          status: "active",
        },
        {
          id: "early",
          expiryDate: new Date("2026-08-01T00:00:00.000Z"),
          status: "active",
        },
        {
          id: "expired",
          expiryDate: new Date("2026-07-01T00:00:00.000Z"),
          status: "active",
        },
      ],
      storage,
      today,
    );
    expect(id).toBe("early");
  });

  it("returns null when none sellable", () => {
    expect(
      pickFefoLot(
        [
          {
            id: "q",
            expiryDate: new Date("2026-08-01T00:00:00.000Z"),
            status: "quarantine",
          },
        ],
        storage,
        today,
      ),
    ).toBeNull();
  });

  it("sorts null expiry after dated lots", () => {
    const id = pickFefoLot(
      [
        { id: "none", expiryDate: null, status: "active" },
        {
          id: "dated",
          expiryDate: new Date("2026-08-01T00:00:00.000Z"),
          status: "active",
        },
      ],
      storage,
      today,
    );
    expect(id).toBe("dated");
  });
});
