import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  AvailabilityUseCases,
  CommitReservation,
  ReleaseReservation,
  ReservationUseCases,
  createFakeCosting,
  type CreateReservationInput,
  type ReservationPort,
  type StockIssueWithLines,
  type StockPort,
  type UnitOfWork,
  type UowContext,
} from "@stock-management/application";
import type {
  Location,
  Product,
  StockBalance,
  StockIssue,
  StockMovement,
  StockReservation,
} from "@stock-management/domain";
import { reservationsRoutes } from "./reservations.routes.js";
import { availabilityRoutes } from "./availability.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const BRANCH_ID = "00000000-0000-4000-8000-000000000003";
const LOCATION_ID = "00000000-0000-4000-8000-000000000004";
const LOCATION_2_ID = "00000000-0000-4000-8000-000000000006";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000005";
const now = new Date("2026-07-26T12:00:00.000Z");
const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };

type FakeOptions = {
  onHand?: string;
  onHandLocation2?: string;
  reservations?: StockReservation[];
  serialize?: boolean;
};

function makeFake(options: FakeOptions = {}) {
  const product: Product = {
    id: PRODUCT_ID,
    orgId: ORG_ID,
    sku: "SKU-1",
    name: "Widget",
    uom: "EA",
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
      id: LOCATION_ID,
      orgId: ORG_ID,
      branchId: BRANCH_ID,
      code: "MAIN",
      name: "Main",
      type: "storage",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: LOCATION_2_ID,
      orgId: ORG_ID,
      branchId: BRANCH_ID,
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
    balances.set(balanceKey(PRODUCT_ID, locationKey, null), {
      id: randomUUID(),
      orgId: ORG_ID,
      productId: PRODUCT_ID,
      locationId: locationKey,
      lotId: null,
      qtyOnHand,
      qtyReserved,
      updatedAt: now,
    });
  };
  seedBalance(LOCATION_ID, options.onHand ?? "10");
  seedBalance(LOCATION_2_ID, options.onHandLocation2 ?? "0");

  const costing = createFakeCosting();
  void costing.insertLayer({
    orgId: ORG_ID,
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    lotId: null,
    sourceDocumentType: "goods_receipt",
    sourceDocumentId: "gr-seed",
    sourceDocumentLineId: "grl-seed",
    sourceMovementId: "m-seed",
    receivedAt: new Date("2026-01-01"),
    unitCost: "10",
    qtyOriginal: options.onHand ?? "10",
    qtyRemaining: options.onHand ?? "10",
  });

  const reservations: StockReservation[] = [...(options.reservations ?? [])];
  const issues = new Map<string, StockIssueWithLines>();
  const movements: StockMovement[] = [];
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
        id: randomUUID(),
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
    async update(updateOrgId, id, patch) {
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
    async listExpiredOpen(at, limit) {
      return reservations
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
        id: existing?.id ?? randomUUID(),
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
        id: existing?.id ?? randomUUID(),
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
        unitCost: input.unitCost ?? null,
        totalCost: input.totalCost ?? null,
      };
      movements.push(movement);
      return movement;
    },
    async updateMovementCosts(_orgId, movementId, unitCost, totalCost) {
      const movement = movements.find((candidate) => candidate.id === movementId);
      if (!movement) throw new Error("Movement not found");
      movement.unitCost = unitCost;
      movement.totalCost = totalCost;
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
      async findById() {
        return null;
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
          orgId: ORG_ID,
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
            orgId: ORG_ID,
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
    costing,
    outbox: { async enqueue() {} },
    idempotency: {
      async find() {
        return null;
      },
      async save() {},
    },
  };

  let chain: Promise<unknown> = Promise.resolve();
  const uow: UnitOfWork = {
    run: async (fn) => {
      if (!options.serialize) return fn(ctx);
      const run = chain.then(() => fn(ctx));
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };

  return {
    reservationPort,
    stock,
    locations: ctx.locations!,
    uow,
    getReservations: () => reservations,
  };
}

async function buildApp(fake: ReturnType<typeof makeFake>) {
  const app = Fastify();
  registerErrorHandler(app);
  await app.register(requestIdPlugin);
  await app.register(createTestContextPlugin());

  const reservations = new ReservationUseCases(
    fake.reservationPort,
    fake.uow,
  );
  const releaseReservation = new ReleaseReservation(fake.uow);
  const commitReservation = new CommitReservation(fake.uow);
  const availability = new AvailabilityUseCases(
    fake.stock,
    fake.reservationPort,
    fake.locations,
  );

  await app.register(
    reservationsRoutes({
      reservations,
      releaseReservation,
      commitReservation,
    }),
    { prefix: "/api/v1" },
  );
  await app.register(availabilityRoutes(availability), { prefix: "/api/v1" });
  return app;
}

describe("reservations and availability routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates and lists reservations", async () => {
    const fake = makeFake({ onHand: "10" });
    const app = await buildApp(fake);
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/reservations",
      headers,
      payload: {
        branchId: BRANCH_ID,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        qty: "4",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(
      expect.objectContaining({
        status: "open",
        qty: "4",
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
      }),
    );

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/reservations",
      headers,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const get = await app.inject({
      method: "GET",
      url: `/api/v1/reservations/${created.json().id}`,
      headers,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().id).toBe(created.json().id);
  });

  it("rejects oversell with insufficient availability", async () => {
    const fake = makeFake({
      onHand: "10",
      reservations: [
        {
          id: "00000000-0000-4000-8000-000000000010",
          orgId: ORG_ID,
          branchId: BRANCH_ID,
          productId: PRODUCT_ID,
          locationId: LOCATION_ID,
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
    const balance = await fake.stock.findBalance({
      orgId: ORG_ID,
      productId: PRODUCT_ID,
      locationId: LOCATION_ID,
      lotId: null,
    });
    await fake.stock.setQtyReserved(
      {
        orgId: ORG_ID,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        lotId: null,
      },
      "8",
    );
    expect(balance?.qtyOnHand).toBe("10");

    const app = await buildApp(fake);
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/reservations",
      headers,
      payload: {
        branchId: BRANCH_ID,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        qty: "3",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INSUFFICIENT_AVAILABILITY");
  });

  it("rejects concurrent oversell so only one reserve wins", async () => {
    const fake = makeFake({ onHand: "5", serialize: true });
    const app = await buildApp(fake);
    apps.push(app);

    const payload = {
      branchId: BRANCH_ID,
      productId: PRODUCT_ID,
      locationId: LOCATION_ID,
      qty: "5",
    };

    const [first, second] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers,
        payload,
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/reservations",
        headers,
        payload,
      }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 400]);
    const failed = first.statusCode === 400 ? first : second;
    expect(failed.json().error.code).toBe("INSUFFICIENT_AVAILABILITY");
    expect(fake.getReservations().filter((r) => r.status === "open")).toHaveLength(
      1,
    );
  });

  it("returns branch availability with onHand, reserved, available", async () => {
    const fake = makeFake({
      onHand: "10",
      onHandLocation2: "5",
      reservations: [
        {
          id: "00000000-0000-4000-8000-000000000011",
          orgId: ORG_ID,
          branchId: BRANCH_ID,
          productId: PRODUCT_ID,
          locationId: LOCATION_ID,
          lotId: null,
          qty: "9",
          status: "open",
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
          externalSystem: null,
          externalId: null,
          committedIssueId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "00000000-0000-4000-8000-000000000012",
          orgId: ORG_ID,
          branchId: BRANCH_ID,
          productId: PRODUCT_ID,
          locationId: LOCATION_2_ID,
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
    const app = await buildApp(fake);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/availability?productId=${PRODUCT_ID}&branchId=${BRANCH_ID}`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      onHand: "15",
      reserved: "2",
      available: "13",
    });
  });

  it("releases and commits reservations", async () => {
    const fake = makeFake({ onHand: "10" });
    const app = await buildApp(fake);
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/reservations",
      headers,
      payload: {
        branchId: BRANCH_ID,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        qty: "3",
      },
    });
    const reservationId = created.json().id as string;

    const releasedCreate = await app.inject({
      method: "POST",
      url: "/api/v1/reservations",
      headers,
      payload: {
        branchId: BRANCH_ID,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        qty: "2",
      },
    });
    const releaseId = releasedCreate.json().id as string;

    const release = await app.inject({
      method: "POST",
      url: `/api/v1/reservations/${releaseId}/release`,
      headers,
    });
    expect(release.statusCode).toBe(200);
    expect(release.json().status).toBe("released");

    const commit = await app.inject({
      method: "POST",
      url: `/api/v1/reservations/${reservationId}/commit`,
      headers,
    });
    expect(commit.statusCode).toBe(200);
    expect(commit.json().reservation.status).toBe("committed");
    expect(commit.json().issue.status).toBe("posted");
    expect(commit.json().movements).toHaveLength(1);
  });
});
