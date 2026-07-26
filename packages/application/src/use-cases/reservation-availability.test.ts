import type {
  Location,
  Product,
  StockBalance,
  StockIssue,
  StockMovement,
  StockReservation,
} from "@stock-management/domain";
import { InsufficientAvailabilityError } from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type { CreateReservationInput } from "../dto/inputs.js";
import type {
  ReservationPort,
  StockIssueWithLines,
  StockPort,
} from "../ports/inventory.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { AvailabilityUseCases } from "./availability.js";
import { CommitReservation } from "./commit-reservation.js";
import { ReleaseReservation } from "./release-reservation.js";
import { ReservationUseCases } from "./reservation.js";

const now = new Date("2026-07-26T12:00:00.000Z");
const orgId = "org-1";
const userId = "user-1";
const branchId = "branch-1";
const productId = "product-1";
const locationId = "location-1";
const location2Id = "location-2";

type FakeOptions = {
  onHand?: string;
  onHandLocation2?: string;
  reservations?: StockReservation[];
};

function makeFake(options: FakeOptions = {}) {
  const product: Product = {
    id: productId,
    orgId,
    sku: "SKU-1",
    name: "Widget",
    uom: "each",
    categoryId: null,
    trackLot: false,
    trackSerial: false,
    trackExpiry: false,
    costingMethod: "fifo",
    reorderMin: null,
    reorderMax: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const locations: Location[] = [
    {
      id: locationId,
      orgId,
      branchId,
      code: "MAIN",
      name: "Main",
      type: "storage",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: location2Id,
      orgId,
      branchId,
      code: "BACK",
      name: "Back",
      type: "storage",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const balances = new Map<string, StockBalance>();
  const balanceKey = (
    productKey: string,
    locationKey: string,
    lotId: string | null,
  ) => `${productKey}:${locationKey}:${lotId ?? ""}`;

  const seedBalance = (
    locationKey: string,
    qtyOnHand: string,
    qtyReserved = "0",
  ) => {
    balances.set(balanceKey(productId, locationKey, null), {
      id: `balance-${locationKey}`,
      orgId,
      productId,
      locationId: locationKey,
      lotId: null,
      qtyOnHand,
      qtyReserved,
      updatedAt: now,
    });
  };
  seedBalance(locationId, options.onHand ?? "10");
  seedBalance(location2Id, options.onHandLocation2 ?? "0");

  const reservations: StockReservation[] = [...(options.reservations ?? [])];
  const issues = new Map<string, StockIssueWithLines>();
  const movements: StockMovement[] = [];
  const outbox: unknown[] = [];
  let reservationSeq = reservations.length;
  let issueSeq = 0;
  let movementSeq = 0;
  let lineSeq = 0;

  const reservationPort: ReservationPort = {
    async list(listOrgId, filters) {
      return reservations.filter((reservation) => {
        if (reservation.orgId !== listOrgId) return false;
        if (filters?.productId && reservation.productId !== filters.productId) {
          return false;
        }
        if (
          filters?.locationId &&
          reservation.locationId !== filters.locationId
        ) {
          return false;
        }
        if (filters?.branchId && reservation.branchId !== filters.branchId) {
          return false;
        }
        if (filters?.status && reservation.status !== filters.status) {
          return false;
        }
        return true;
      });
    },
    async findById(findOrgId, id) {
      return (
        reservations.find((r) => r.orgId === findOrgId && r.id === id) ?? null
      );
    },
    async create(createOrgId, input: CreateReservationInput) {
      const reservation: StockReservation = {
        id: `reservation-${++reservationSeq}`,
        orgId: createOrgId,
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
      reservations.push(reservation);
      return reservation;
    },
    async update(
      updateOrgId,
      id,
      patch: {
        status?: StockReservation["status"];
        committedIssueId?: string | null;
      },
    ) {
      const index = reservations.findIndex(
        (r) => r.orgId === updateOrgId && r.id === id,
      );
      if (index < 0) return null;
      reservations[index] = {
        ...reservations[index]!,
        ...patch,
        updatedAt: now,
      };
      return reservations[index]!;
    },
  };

  const stock: StockPort = {
    async findBalance(key) {
      return (
        balances.get(
          balanceKey(key.productId, key.locationId, key.lotId),
        ) ?? null
      );
    },
    async setBalance(key, qtyOnHand) {
      const existing = balances.get(
        balanceKey(key.productId, key.locationId, key.lotId),
      );
      const balance: StockBalance = {
        id: existing?.id ?? `balance-${key.locationId}`,
        ...key,
        qtyOnHand,
        qtyReserved: existing?.qtyReserved ?? "0",
        updatedAt: now,
      };
      balances.set(
        balanceKey(key.productId, key.locationId, key.lotId),
        balance,
      );
      return balance;
    },
    async setQtyReserved(key, qtyReserved) {
      const existing = balances.get(
        balanceKey(key.productId, key.locationId, key.lotId),
      );
      const balance: StockBalance = {
        id: existing?.id ?? `balance-${key.locationId}`,
        ...key,
        qtyOnHand: existing?.qtyOnHand ?? "0",
        qtyReserved,
        updatedAt: now,
      };
      balances.set(
        balanceKey(key.productId, key.locationId, key.lotId),
        balance,
      );
      return balance;
    },
    async insertMovement(input) {
      const movement: StockMovement = {
        ...input,
        id: `movement-${++movementSeq}`,
        createdAt: input.createdAt ?? now,
      };
      movements.push(movement);
      return movement;
    },
    async listBalances(listOrgId, filters) {
      return [...balances.values()].filter((balance) => {
        if (balance.orgId !== listOrgId) return false;
        if (filters?.productId && balance.productId !== filters.productId) {
          return false;
        }
        if (filters?.locationId && balance.locationId !== filters.locationId) {
          return false;
        }
        return true;
      });
    },
    async listMovements() {
      return movements;
    },
  };

  const ctx: UowContext = {
    po: {} as UowContext["po"],
    gr: {} as UowContext["gr"],
    products: {
      async findById() {
        return product;
      },
    },
    locations: {
      async findById(_orgId, id) {
        return locations.find((location) => location.id === id) ?? null;
      },
      async list(listOrgId, listBranchId) {
        return locations.filter(
          (location) =>
            location.orgId === listOrgId &&
            (listBranchId == null || location.branchId === listBranchId),
        );
      },
    },
    stock,
    lots: {
      async upsert() {
        throw new Error("lots unused");
      },
      async list() {
        return [];
      },
    },
    serials: {
      async upsert() {
        throw new Error("serials unused");
      },
      async list() {
        return [];
      },
    },
    reservations: reservationPort,
    issues: {
      async list() {
        return [...issues.values()];
      },
      async findById(_orgId, id) {
        return issues.get(id) ?? null;
      },
      async create(_orgId, input) {
        const id = `issue-${++issueSeq}`;
        const issue: StockIssueWithLines = {
          id,
          orgId,
          branchId: input.branchId,
          locationId: input.locationId,
          documentNumber: input.documentNumber ?? null,
          issueType: input.issueType,
          reasonNote: input.reasonNote ?? null,
          status: "draft",
          createdAt: now,
          updatedAt: now,
          postedAt: null,
          voidedAt: null,
          lines: input.lines.map((line) => ({
            id: `issue-line-${++lineSeq}`,
            orgId,
            stockIssueId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })),
        };
        issues.set(id, issue);
        return issue;
      },
      async update() {
        throw new Error("issue update unused");
      },
      async updateStatus(
        _orgId,
        id,
        status: StockIssue["status"],
        occurredAt: Date,
      ) {
        const issue = issues.get(id);
        if (!issue) throw new Error("issue missing");
        const updated = {
          ...issue,
          status,
          postedAt: status === "posted" ? occurredAt : issue.postedAt,
          voidedAt: status === "void" ? occurredAt : issue.voidedAt,
          updatedAt: now,
        };
        issues.set(id, updated);
        return updated;
      },
    },
    outbox: {
      async enqueue(event) {
        outbox.push(event);
      },
    },
    idempotency: {
      async find() {
        return null;
      },
      async save() {},
    },
  };

  const uow: UnitOfWork = {
    run: async (fn) => fn(ctx),
  };

  return {
    uow,
    ctx,
    stock,
    reservations: reservationPort,
    locations: ctx.locations!,
    getReservations: () => reservations,
    getIssues: () => [...issues.values()],
    getMovements: () => movements,
    getBalance: (locationKey: string) =>
      balances.get(balanceKey(productId, locationKey, null))!,
    outbox,
  };
}

describe("reservations and availability", () => {
  it("reserves when qty is within available", async () => {
    const fake = makeFake({ onHand: "10" });
    const useCases = new ReservationUseCases(fake.reservations, fake.uow);

    const reservation = await useCases.create(orgId, {
      branchId,
      productId,
      locationId,
      qty: "4",
    });

    expect(reservation.status).toBe("open");
    expect(reservation.qty).toBe("4");
    expect(fake.getBalance(locationId).qtyReserved).toBe("4");
  });

  it("throws when reserve would oversell available", async () => {
    const fake = makeFake({
      onHand: "10",
      reservations: [
        {
          id: "reservation-existing",
          orgId,
          branchId,
          productId,
          locationId,
          lotId: null,
          qty: "8",
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
    fake.getBalance(locationId).qtyReserved = "8";
    const useCases = new ReservationUseCases(fake.reservations, fake.uow);

    await expect(
      useCases.create(orgId, {
        branchId,
        productId,
        locationId,
        qty: "3",
      }),
    ).rejects.toBeInstanceOf(InsufficientAvailabilityError);
  });

  it("releases an open reservation and decrements qty_reserved", async () => {
    const fake = makeFake({
      onHand: "10",
      reservations: [
        {
          id: "reservation-1",
          orgId,
          branchId,
          productId,
          locationId,
          lotId: null,
          qty: "5",
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
    fake.getBalance(locationId).qtyReserved = "5";
    const release = new ReleaseReservation(fake.uow);

    const reservation = await release.execute(orgId, "reservation-1");

    expect(reservation.status).toBe("released");
    expect(fake.getBalance(locationId).qtyReserved).toBe("0");
  });

  it("commits a reservation by posting a stock issue and reducing on-hand", async () => {
    const fake = makeFake({
      onHand: "10",
      reservations: [
        {
          id: "reservation-1",
          orgId,
          branchId,
          productId,
          locationId,
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
    fake.getBalance(locationId).qtyReserved = "3";
    const commit = new CommitReservation(fake.uow);

    const result = await commit.execute(orgId, userId, "reservation-1", now);

    expect(result.reservation.status).toBe("committed");
    expect(result.reservation.committedIssueId).toBe(result.issue.id);
    expect(result.issue.status).toBe("posted");
    expect(result.issue.issueType).toBe("other");
    expect(result.issue.reasonNote).toBe("reservation commit reservation-1");
    expect(result.issue.lines).toEqual([
      expect.objectContaining({
        productId,
        qty: "3",
        lotId: null,
      }),
    ]);
    expect(fake.getBalance(locationId).qtyOnHand).toBe("7");
    expect(fake.getBalance(locationId).qtyReserved).toBe("0");
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.movementType).toBe("issue");
    expect(result.movements[0]?.qty).toBe("-3");
  });

  it("ignores expired open reservations when computing availability", async () => {
    const fake = makeFake({
      onHand: "10",
      onHandLocation2: "5",
      reservations: [
        {
          id: "reservation-expired",
          orgId,
          branchId,
          productId,
          locationId,
          lotId: null,
          qty: "9",
          status: "open",
          expiresAt: new Date("2026-07-26T11:00:00.000Z"),
          externalSystem: null,
          externalId: null,
          committedIssueId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "reservation-active",
          orgId,
          branchId,
          productId,
          locationId: location2Id,
          lotId: null,
          qty: "2",
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
    fake.getBalance(locationId).qtyReserved = "9";
    fake.getBalance(location2Id).qtyReserved = "2";

    const availability = new AvailabilityUseCases(
      fake.stock,
      fake.reservations,
      fake.locations,
    );

    const result = await availability.getByProductBranch(
      orgId,
      productId,
      branchId,
      now,
    );

    expect(result).toEqual({
      onHand: "15",
      reserved: "2",
      available: "13",
    });
  });

  it("allows a new reserve after an open reservation expires", async () => {
    const fake = makeFake({
      onHand: "10",
      reservations: [
        {
          id: "reservation-expired",
          orgId,
          branchId,
          productId,
          locationId,
          lotId: null,
          qty: "10",
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
    fake.getBalance(locationId).qtyReserved = "10";
    const useCases = new ReservationUseCases(fake.reservations, fake.uow);

    const reservation = await useCases.create(
      orgId,
      {
        branchId,
        productId,
        locationId,
        qty: "4",
      },
      now,
    );

    expect(reservation.qty).toBe("4");
    expect(fake.getBalance(locationId).qtyReserved).toBe("4");
  });
});
