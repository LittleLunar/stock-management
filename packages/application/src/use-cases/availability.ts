import {
  availableQty,
  effectiveReservedQty,
} from "@stock-management/domain";
import type {
  LocationLookupPort,
  ReservationPort,
  StockPort,
} from "../ports/inventory.js";

export type AvailabilityResult = {
  onHand: string;
  reserved: string;
  available: string;
};

export class AvailabilityUseCases {
  constructor(
    private readonly stock: StockPort,
    private readonly reservations: ReservationPort,
    private readonly locations: LocationLookupPort,
  ) {}

  async getByProductBranch(
    orgId: string,
    productId: string,
    branchId: string,
    now: Date = new Date(),
  ): Promise<AvailabilityResult> {
    if (!this.locations.list) {
      throw new Error("Location list is not configured");
    }
    const branchLocations = await this.locations.list(orgId, branchId);
    const locationIds = new Set(branchLocations.map((location) => location.id));

    const balances = await this.stock.listBalances(orgId, { productId });
    const onHandTotal = balances
      .filter((balance) => locationIds.has(balance.locationId))
      .reduce((sum, balance) => sum + Number(balance.qtyOnHand), 0);

    const openReservations = await this.reservations.list(orgId, {
      productId,
      branchId,
      status: "open",
    });
    const reserved = effectiveReservedQty(openReservations, now);
    const onHand = String(onHandTotal);

    return {
      onHand,
      reserved,
      available: availableQty(onHand, reserved),
    };
  }
}
