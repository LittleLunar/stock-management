import {
  assertLotSellable,
  isQuarantineReleasePath,
  NotFoundError,
  type LocationType,
  type OutboundOperation,
} from "@stock-management/domain";
import type { UowContext } from "../ports/unit-of-work.js";

export async function assertOutboundSellable(
  ctx: Pick<UowContext, "lots" | "locations">,
  args: {
    orgId: string;
    locationId: string;
    lotId: string | null;
    operation: OutboundOperation;
    toLocationId?: string;
    today?: Date;
  },
): Promise<void> {
  if (!ctx.locations) throw new Error("Location lookup is not configured");
  const location = await ctx.locations.findById(args.orgId, args.locationId);
  if (!location) throw new NotFoundError("Location");

  let toType: LocationType | undefined;
  if (args.toLocationId) {
    const to = await ctx.locations.findById(args.orgId, args.toLocationId);
    if (!to) throw new NotFoundError("Location");
    toType = to.type;
  }

  const release = isQuarantineReleasePath({
    operation: args.operation,
    fromLocationType: location.type,
    toLocationType: toType,
  });

  let lot = null;
  if (args.lotId) {
    const found = await ctx.lots.findById(args.orgId, args.lotId);
    if (!found) throw new NotFoundError("Lot");
    lot = found;
  }

  assertLotSellable(lot, location, args.today ?? new Date(), {
    isQuarantineRelease: release,
  });
}
