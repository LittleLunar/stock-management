/**
 * Reserve must run inside UnitOfWork so StockPort.findBalance uses FOR UPDATE.
 * Never call assertCanReserve against an unlocked balance read.
 */
import {
  InvalidStateError,
  NotFoundError,
  assertCanReserve,
  availableQty,
  effectiveReservedQty,
} from "@stock-management/domain";
import type { StockReservation } from "@stock-management/domain";
import type { CreateReservationInput } from "../dto/inputs.js";
import type { BranchListFilter } from "../access/list-scope.js";
import type {
  ReservationListFilters,
  ReservationPort,
  StockBalanceKey,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";

export class ReservationUseCases {
  constructor(
    private readonly repo: ReservationPort,
    private readonly uow: UnitOfWork,
  ) {}

  list(
    orgId: string,
    filters?: ReservationListFilters,
    branchFilter?: BranchListFilter,
  ) {
    const effective: ReservationListFilters | undefined =
      branchFilter?.kind === "branch"
        ? { ...filters, branchId: branchFilter.branchId }
        : filters;
    return this.repo.list(orgId, effective);
  }

  async get(orgId: string, id: string) {
    const reservation = await this.repo.findById(orgId, id);
    if (!reservation) throw new NotFoundError("Reservation");
    return reservation;
  }

  create(
    orgId: string,
    input: CreateReservationInput,
    now: Date = new Date(),
  ): Promise<StockReservation> {
    return this.uow.run(async (ctx) => {
      const reservations = requireReservations(ctx);
      await assertLocationInBranch(ctx, orgId, input.locationId, input.branchId);

      const balanceKey: StockBalanceKey = {
        orgId,
        productId: input.productId,
        locationId: input.locationId,
        lotId: input.lotId ?? null,
      };
      const balance = await ctx.stock.findBalance(balanceKey);
      const openReservations = await reservations.list(orgId, {
        productId: input.productId,
        locationId: input.locationId,
        status: "open",
      });
      const matching = openReservations.filter(
        (reservation) =>
          (reservation.lotId ?? null) === (input.lotId ?? null),
      );
      const reserved = effectiveReservedQty(matching, now);
      const available = availableQty(balance?.qtyOnHand ?? "0", reserved);
      assertCanReserve(available, input.qty);

      const created = await reservations.create(orgId, input);
      await recomputeQtyReserved(ctx, balanceKey, now);
      return created;
    });
  }
}

export async function recomputeQtyReserved(
  ctx: UowContext,
  balanceKey: StockBalanceKey,
  now: Date,
): Promise<void> {
  const reservations = requireReservations(ctx);
  const openReservations = await reservations.list(balanceKey.orgId, {
    productId: balanceKey.productId,
    locationId: balanceKey.locationId,
    status: "open",
  });
  const matching = openReservations.filter(
    (reservation) => (reservation.lotId ?? null) === balanceKey.lotId,
  );
  const qtyReserved = effectiveReservedQty(matching, now);
  await ctx.stock.setQtyReserved(balanceKey, qtyReserved);
}

export function requireReservations(ctx: UowContext): ReservationPort {
  if (!ctx.reservations) {
    throw new Error("Reservation port is not configured");
  }
  return ctx.reservations;
}

async function assertLocationInBranch(
  ctx: UowContext,
  orgId: string,
  locationId: string,
  branchId: string,
): Promise<void> {
  if (!ctx.locations?.findById) return;
  const location = await ctx.locations.findById(orgId, locationId);
  if (!location) throw new NotFoundError("Location");
  if (location.branchId !== branchId) {
    throw new InvalidStateError("Location does not belong to branch");
  }
}
