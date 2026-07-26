import type { UnitOfWork } from "../ports/unit-of-work.js";
import { recomputeQtyReserved, requireReservations } from "./reservation.js";

export class ExpireReservations {
  constructor(private readonly uow: UnitOfWork) {}

  /** Returns number of reservations hard-released. */
  execute(now: Date = new Date(), limit = 100): Promise<number> {
    return this.uow.run(async (ctx) => {
      const reservations = requireReservations(ctx);
      const expired = await reservations.listExpiredOpen(now, limit);
      let count = 0;
      for (const row of expired) {
        if (row.status !== "open") continue;
        await reservations.update(row.orgId, row.id, { status: "released" });
        await recomputeQtyReserved(
          ctx,
          {
            orgId: row.orgId,
            productId: row.productId,
            locationId: row.locationId,
            lotId: row.lotId,
          },
          now,
        );
        count += 1;
      }
      return count;
    });
  }
}
