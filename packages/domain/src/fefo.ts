import type { Location, Lot } from "./entities.js";
import type { LocationType } from "./types.js";
import {
  LocationQuarantinedError,
  LotExpiredError,
  LotQuarantinedError,
} from "./errors.js";

export type SellableLot = Pick<Lot, "id" | "expiryDate" | "status">;
export type SellableLocation = Pick<Location, "id" | "type">;

export type SellableAssertOptions = {
  isQuarantineRelease?: boolean;
};

export function calendarDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isLotExpired(
  expiryDate: Date | null,
  today: Date,
): boolean {
  if (expiryDate == null) return false;
  return calendarDate(expiryDate) < calendarDate(today);
}

export type OutboundOperation =
  | "issue"
  | "transfer_ship"
  | "reservation_commit"
  | "adjustment";

export function isQuarantineReleasePath(args: {
  operation: OutboundOperation;
  fromLocationType: LocationType;
  toLocationType?: LocationType;
}): boolean {
  if (args.operation === "issue" || args.operation === "reservation_commit") {
    return false;
  }
  if (args.operation === "transfer_ship") {
    return (
      args.fromLocationType === "quarantine" &&
      args.toLocationType != null &&
      args.toLocationType !== "quarantine"
    );
  }
  // adjustment: decreasing stock at quarantine counts as release
  return args.fromLocationType === "quarantine";
}

/**
 * Hard-block expired / quarantine unless release path.
 * Prefer FEFO is separate (pickFefoLot) — this only enforces hard rules.
 */
export function assertLotSellable(
  lot: SellableLot | null,
  location: SellableLocation,
  today: Date,
  options: SellableAssertOptions = {},
): void {
  const release = options.isQuarantineRelease === true;
  if (!release && location.type === "quarantine") {
    throw new LocationQuarantinedError();
  }
  if (lot == null) return; // non-lot-tracked ok if location ok
  if (!release && lot.status === "quarantine") {
    throw new LotQuarantinedError();
  }
  if (!release && isLotExpired(lot.expiryDate, today)) {
    throw new LotExpiredError();
  }
}

/**
 * Prefer earliest expiry among candidates that pass assertLotSellable.
 * Null expiry sorts after dated lots. Returns null if none sellable.
 */
export function pickFefoLot(
  lots: ReadonlyArray<SellableLot>,
  location: SellableLocation,
  today: Date,
  options: SellableAssertOptions = {},
): string | null {
  const sellable: SellableLot[] = [];
  for (const lot of lots) {
    try {
      assertLotSellable(lot, location, today, options);
      sellable.push(lot);
    } catch {
      // skip
    }
  }
  if (sellable.length === 0) return null;
  sellable.sort((a, b) => {
    if (a.expiryDate == null && b.expiryDate == null) return 0;
    if (a.expiryDate == null) return 1;
    if (b.expiryDate == null) return -1;
    return calendarDate(a.expiryDate).localeCompare(calendarDate(b.expiryDate));
  });
  return sellable[0]!.id;
}
