import { describe, expect, it } from "vitest";
import {
  InsufficientAvailabilityError,
  type Location,
  type StockBalance,
  type StockReservation,
} from "@stock-management/domain";
import type { CreateReservationInput } from "../dto/inputs.js";
import type {
  ReservationPort,
  StockBalanceKey,
  StockPort,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { ReservationUseCases } from "./reservation.js";

const now = new Date("2026-07-26T12:00:00.000Z");
const orgId = "org-1";
const branchId = "b1";
const productId = "p1";
const locationId = "loc1";

function balanceKeyOf(key: StockBalanceKey): string {
  return `${key.productId}:${key.locationId}:${key.lotId ?? ""}`;
}

/**
 * Serializes uow.run globally and holds a per-balance mutex across findBalance
 * → commit so the second create sees the first reservation's qtyReserved.
 * Models Postgres FOR UPDATE + commit visibility for the use-case contract.
 */
function createLockingReservationFake(seed: {
  qtyOnHand: string;
  qtyReserved: string;
}) {
  const location: Location = {
    id: locationId,
    orgId,
    branchId,
    code: "MAIN",
    name: "Main",
    type: "storage",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  let balance: StockBalance = {
    id: "bal-1",
    orgId,
    productId,
    locationId,
    lotId: null,
    qtyOnHand: seed.qtyOnHand,
    qtyReserved: seed.qtyReserved,
    createdAt: now,
    updatedAt: now,
  };

  const reservations = new Map<string, StockReservation>();
  let seq = 0;
  let runChain: Promise<unknown> = Promise.resolve();
  const balanceLocks = new Map<string, Promise<void>>();

  async function withBalanceLock<T>(
    key: StockBalanceKey,
    fn: () => Promise<T>,
  ): Promise<T> {
    const id = balanceKeyOf(key);
    const prev = balanceLocks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    balanceLocks.set(
      id,
      prev.then(() => gate),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  const stock: StockPort = {
    async findBalance(key) {
      return withBalanceLock(key, async () => ({ ...balance }));
    },
    async setBalance() {
      throw new Error("not used");
    },
    async setQtyReserved(key, qtyReserved) {
      return withBalanceLock(key, async () => {
        balance = { ...balance, qtyReserved, updatedAt: now };
        return { ...balance };
      });
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

  const reservationPort: ReservationPort = {
    async list(_orgId, filters) {
      return [...reservations.values()].filter((row) => {
        if (filters?.productId && row.productId !== filters.productId)
          return false;
        if (filters?.locationId && row.locationId !== filters.locationId)
          return false;
        if (filters?.status && row.status !== filters.status) return false;
        return true;
      });
    },
    async findById(_orgId, id) {
      return reservations.get(id) ?? null;
    },
    async create(_orgId, input: CreateReservationInput) {
      const id = `r-${++seq}`;
      const row: StockReservation = {
        id,
        orgId,
        branchId: input.branchId,
        productId: input.productId,
        locationId: input.locationId,
        lotId: input.lotId ?? null,
        qty: input.qty,
        status: "open",
        expiresAt: input.expiresAt ?? null,
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
        committedIssueId: null,
        createdAt: now,
        updatedAt: now,
      };
      reservations.set(id, row);
      return row;
    },
    async update(_orgId, id, patch) {
      const current = reservations.get(id)!;
      const next = { ...current, ...patch, updatedAt: now };
      reservations.set(id, next);
      return next;
    },
    async listExpiredOpen(at, limit) {
      return [...reservations.values()]
        .filter(
          (r) =>
            r.status === "open" &&
            r.expiresAt !== null &&
            r.expiresAt.getTime() <= at.getTime(),
        )
        .slice(0, limit);
    },
  };

  const uow: UnitOfWork = {
    run(fn) {
      const result = runChain.then(() =>
        fn({
          stock,
          reservations: reservationPort,
          locations: {
            async findById(_o, id) {
              return id === location.id ? location : null;
            },
          },
        } as UowContext),
      );
      runChain = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };

  return {
    uow,
    reservations: reservationPort,
    getQtyReserved: () => balance.qtyReserved,
    openCount: () =>
      [...reservations.values()].filter((r) => r.status === "open").length,
  };
}

describe("ReservationUseCases concurrent create", () => {
  it("prevents concurrent oversell on the same balance key", async () => {
    const fake = createLockingReservationFake({
      qtyOnHand: "5",
      qtyReserved: "0",
    });
    const useCases = new ReservationUseCases(fake.reservations, fake.uow);

    const input: CreateReservationInput = {
      branchId,
      productId,
      locationId,
      lotId: null,
      qty: "5",
      expiresAt: null,
    };

    const results = await Promise.allSettled([
      useCases.create(orgId, input, now),
      useCases.create(orgId, input, now),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ status: "rejected" });
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(InsufficientAvailabilityError);
    }
    expect(fake.getQtyReserved()).toBe("5");
    expect(fake.openCount()).toBe(1);
  });
});
