import { describe, expect, it } from "vitest";
import type { StockBalance, StockReservation } from "@stock-management/domain";
import type { ReservationPort, StockPort } from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { ExpireReservations } from "./expire-reservations.js";

const now = new Date("2026-07-26T12:00:00.000Z");

function createExpireFake(seed: {
  qtyOnHand: string;
  qtyReserved: string;
  reservations: StockReservation[];
}) {
  let balance: StockBalance = {
    id: "bal-1",
    orgId: "org-1",
    productId: "p1",
    locationId: "loc1",
    lotId: null,
    qtyOnHand: seed.qtyOnHand,
    qtyReserved: seed.qtyReserved,
    createdAt: now,
    updatedAt: now,
  };
  const byId = new Map(seed.reservations.map((r) => [r.id, { ...r }]));

  const reservationPort: ReservationPort = {
    async list() {
      return [...byId.values()];
    },
    async findById(_orgId, id) {
      return byId.get(id) ?? null;
    },
    async create() {
      throw new Error("not used");
    },
    async update(_orgId, id, patch) {
      const current = byId.get(id)!;
      const next = { ...current, ...patch, updatedAt: now };
      byId.set(id, next);
      return next;
    },
    async listExpiredOpen(at, limit) {
      return [...byId.values()]
        .filter(
          (r) =>
            r.status === "open" &&
            r.expiresAt !== null &&
            r.expiresAt.getTime() <= at.getTime(),
        )
        .slice(0, limit);
    },
  };

  const stock: StockPort = {
    async findBalance() {
      return { ...balance };
    },
    async setBalance() {
      throw new Error("not used");
    },
    async setQtyReserved(_key, qtyReserved) {
      balance = { ...balance, qtyReserved, updatedAt: now };
      return { ...balance };
    },
    async insertMovement() {
      throw new Error("not used");
    },
    async updateMovementCosts() {
      throw new Error("not used");
    },
    async listBalances() {
      return [balance];
    },
    async listMovements() {
      return [];
    },
  };

  const uow: UnitOfWork = {
    run(fn) {
      return fn({ stock, reservations: reservationPort } as UowContext);
    },
  };

  return {
    uow,
    byId,
    getQtyReserved: () => balance.qtyReserved,
  };
}

describe("ExpireReservations", () => {
  it("hard-releases open reservations past expiresAt and recomputes qtyReserved", async () => {
    const fake = createExpireFake({
      qtyOnHand: "10",
      qtyReserved: "4",
      reservations: [
        {
          id: "r-expired",
          orgId: "org-1",
          branchId: "b1",
          productId: "p1",
          locationId: "loc1",
          lotId: null,
          qty: "4",
          status: "open",
          expiresAt: new Date("2026-07-26T11:00:00.000Z"),
          externalSystem: null,
          externalId: null,
          committedIssueId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const n = await new ExpireReservations(fake.uow).execute(now);
    expect(n).toBe(1);
    expect(fake.byId.get("r-expired")?.status).toBe("released");
    expect(fake.getQtyReserved()).toBe("0");
  });

  it("ignores open reservations with null expiresAt", async () => {
    const fake = createExpireFake({
      qtyOnHand: "10",
      qtyReserved: "3",
      reservations: [
        {
          id: "r-open",
          orgId: "org-1",
          branchId: "b1",
          productId: "p1",
          locationId: "loc1",
          lotId: null,
          qty: "3",
          status: "open",
          expiresAt: null,
          externalSystem: null,
          externalId: null,
          committedIssueId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const n = await new ExpireReservations(fake.uow).execute(now);
    expect(n).toBe(0);
    expect(fake.byId.get("r-open")?.status).toBe("open");
    expect(fake.getQtyReserved()).toBe("3");
  });
});
