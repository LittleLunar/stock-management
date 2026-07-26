import {
  NotFoundError,
  assertCanCommitReservation,
} from "@stock-management/domain";
import type { StockMovement, StockReservation } from "@stock-management/domain";
import type { StockIssueWithLines } from "../ports/inventory.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import { postStockIssueInCtx } from "./stock-issue.js";
import { recomputeQtyReserved, requireReservations } from "./reservation.js";

export type CommitReservationResult = {
  reservation: StockReservation;
  issue: StockIssueWithLines;
  movements: StockMovement[];
};

export class CommitReservation {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    orgId: string,
    userId: string,
    reservationId: string,
    now: Date = new Date(),
  ): Promise<CommitReservationResult> {
    return this.uow.run(async (ctx) => {
      const reservations = requireReservations(ctx);
      const issues = ctx.issues;
      if (!issues) throw new Error("Stock issue port is not configured");

      const reservation = await reservations.findById(orgId, reservationId);
      if (!reservation) throw new NotFoundError("Reservation");
      assertCanCommitReservation(reservation, now);

      const draftIssue = await issues.create(orgId, {
        branchId: reservation.branchId,
        locationId: reservation.locationId,
        issueType: "other",
        reasonNote: `reservation commit ${reservation.id}`,
        lines: [
          {
            productId: reservation.productId,
            qty: reservation.qty,
            lotId: reservation.lotId,
            lineNumber: 1,
          },
        ],
      });

      const posted = await postStockIssueInCtx(
        ctx,
        orgId,
        userId,
        draftIssue.id,
      );

      const issueWithLines = await issues.findById(orgId, posted.issue.id);
      if (!issueWithLines) throw new NotFoundError("Stock issue");

      const committed = await reservations.update(orgId, reservationId, {
        status: "committed",
        committedIssueId: posted.issue.id,
      });
      if (!committed) throw new NotFoundError("Reservation");

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

      return {
        reservation: committed,
        issue: issueWithLines,
        movements: posted.movements,
      };
    });
  }
}
