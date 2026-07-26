import {
  NotFoundError,
  assertCanReleaseReservation,
} from "@stock-management/domain";
import type { StockReservation } from "@stock-management/domain";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { recomputeQtyReserved, requireReservations } from "./reservation.js";

export class ReleaseReservation {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    reservationId: string,
    now: Date = new Date(),
  ): Promise<StockReservation> {
    return this.uow.run(async (ctx) => {
      const reservations = requireReservations(ctx);
      const reservation = await reservations.findById(orgId, reservationId);
      if (!reservation) throw new NotFoundError("Reservation");
      assertCanReleaseReservation(reservation, now);

      const released = await reservations.update(orgId, reservationId, {
        status: "released",
      });
      if (!released) throw new NotFoundError("Reservation");

      await recomputeQtyReserved(
        ctx,
        {
          orgId,
          productId: reservation.productId,
          locationId: reservation.locationId,
          lotId: reservation.lotId,
        },
        now,
      );
      return released;
    });
  }
}
