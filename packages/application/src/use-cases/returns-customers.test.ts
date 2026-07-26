import type {
  Customer,
  Product,
  Serial,
  StockBalance,
  StockMovement,
} from "@stock-management/domain";
import { describe, expect, it } from "vitest";
import type {
  CreateCustomerInput,
  CreateCustomerReturnInput,
  CreateSupplierReturnInput,
} from "../dto/inputs.js";
import type {
  CustomerReturnPort,
  CustomerReturnWithLines,
  StockPort,
  SupplierReturnPort,
  SupplierReturnWithLines,
} from "../ports/inventory.js";
import type { CustomerRepository } from "../ports/repositories.js";
import type { UnitOfWork, UowContext } from "../ports/unit-of-work.js";
import { CustomerUseCases } from "./customer.js";
import {
  CustomerReturnUseCases,
  PostCustomerReturn,
  VoidCustomerReturn,
} from "./customer-return.js";
import {
  PostSupplierReturn,
  SupplierReturnUseCases,
  VoidSupplierReturn,
} from "./supplier-return.js";

const now = new Date("2026-07-26T12:00:00.000Z");
const orgId = "org-1";
const userId = "user-1";
const branchId = "branch-1";
const productId = "product-1";
const locationId = "location-1";
const supplierId = "supplier-1";
const customerId = "customer-1";

type FakeOptions = {
  onHand?: string;
  supplierSerialNumbers?: string[];
  customerSerialNumbers?: string[];
  seedSupplierSerials?: boolean;
  seedCustomerSerials?: boolean;
  supplierSerialStatus?: Serial["status"];
  customerSerialStatus?: Serial["status"];
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
    trackSerial:
      (options.supplierSerialNumbers?.length ?? 0) > 0 ||
      (options.customerSerialNumbers?.length ?? 0) > 0,
    trackExpiry: false,
    costingMethod: "fifo",
    reorderMin: null,
    reorderMax: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const balances = new Map<string, StockBalance>();
  const balanceKey = (
    productKey: string,
    locationKey: string,
    lotId: string | null,
  ) => `${productKey}:${locationKey}:${lotId ?? ""}`;

  balances.set(balanceKey(productId, locationId, null), {
    id: "balance-1",
    orgId,
    productId,
    locationId,
    lotId: null,
    qtyOnHand: options.onHand ?? "10",
    qtyReserved: "0",
    updatedAt: now,
  });

  const movements: StockMovement[] = [];
  const outbox: unknown[] = [];
  const serialsByNumber = new Map<string, Serial>();
  let movementSeq = 0;
  let supplierReturnSeq = 0;
  let customerReturnSeq = 0;
  let customerSeq = 0;
  let lineSeq = 0;

  const supplierReturns = new Map<string, SupplierReturnWithLines>();
  const customerReturns = new Map<string, CustomerReturnWithLines>();
  const customers: Customer[] = [
    {
      id: customerId,
      orgId,
      code: "C-1",
      name: "Walk-in",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  ];

  if (options.seedSupplierSerials !== false) {
    for (const serialNumber of options.supplierSerialNumbers ?? []) {
      serialsByNumber.set(serialNumber, {
        id: `serial-${serialNumber}`,
        orgId,
        productId,
        lotId: null,
        locationId,
        serialNumber,
        status: options.supplierSerialStatus ?? "in_stock",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  if (options.seedCustomerSerials !== false) {
    for (const serialNumber of options.customerSerialNumbers ?? []) {
      serialsByNumber.set(serialNumber, {
        id: `serial-${serialNumber}`,
        orgId,
        productId,
        lotId: null,
        locationId: null,
        serialNumber,
        status: options.customerSerialStatus ?? "issued",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const supplierReturnPort: SupplierReturnPort = {
    async list(listOrgId) {
      return [...supplierReturns.values()].filter((doc) => doc.orgId === listOrgId);
    },
    async findById(findOrgId, id) {
      const doc = supplierReturns.get(id);
      return doc?.orgId === findOrgId ? doc : null;
    },
    async create(createOrgId, input: CreateSupplierReturnInput) {
      const id = `sr-${++supplierReturnSeq}`;
      const doc: SupplierReturnWithLines = {
        id,
        orgId: createOrgId,
        branchId: input.branchId,
        locationId: input.locationId,
        supplierId: input.supplierId,
        goodsReceiptId: input.goodsReceiptId ?? null,
        documentNumber: input.documentNumber ?? null,
        status: "draft",
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: `sr-line-${++lineSeq}`,
          orgId: createOrgId,
          supplierReturnId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          goodsReceiptLineId: line.goodsReceiptLineId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      supplierReturns.set(id, doc);
      return doc;
    },
    async update(updateOrgId, id, input) {
      const existing = supplierReturns.get(id);
      if (!existing || existing.orgId !== updateOrgId) return null;
      if (existing.status !== "draft") return existing;
      const updated: SupplierReturnWithLines = {
        ...existing,
        branchId: input.branchId ?? existing.branchId,
        locationId: input.locationId ?? existing.locationId,
        supplierId: input.supplierId ?? existing.supplierId,
        goodsReceiptId:
          input.goodsReceiptId !== undefined
            ? input.goodsReceiptId
            : existing.goodsReceiptId,
        documentNumber:
          input.documentNumber !== undefined
            ? input.documentNumber
            : existing.documentNumber,
        lines: input.lines
          ? input.lines.map((line) => ({
              id: line.id ?? `sr-line-${++lineSeq}`,
              orgId: updateOrgId,
              supplierReturnId: id,
              productId: line.productId,
              qty: line.qty,
              lotId: line.lotId ?? null,
              goodsReceiptLineId: line.goodsReceiptLineId ?? null,
              lineNumber: line.lineNumber,
              serialNumbers: line.serialNumbers ?? [],
            }))
          : existing.lines,
        updatedAt: now,
      };
      supplierReturns.set(id, updated);
      return updated;
    },
    async updateStatus(_orgId, id, status, occurredAt) {
      const existing = supplierReturns.get(id);
      if (!existing) throw new Error("Supplier return not found");
      const updated: SupplierReturnWithLines = {
        ...existing,
        status,
        postedAt: status === "posted" ? occurredAt : existing.postedAt,
        voidedAt: status === "void" ? occurredAt : existing.voidedAt,
        updatedAt: now,
      };
      supplierReturns.set(id, updated);
      return updated;
    },
  };

  const customerReturnPort: CustomerReturnPort = {
    async list(listOrgId) {
      return [...customerReturns.values()].filter((doc) => doc.orgId === listOrgId);
    },
    async findById(findOrgId, id) {
      const doc = customerReturns.get(id);
      return doc?.orgId === findOrgId ? doc : null;
    },
    async create(createOrgId, input: CreateCustomerReturnInput) {
      const id = `cr-${++customerReturnSeq}`;
      const doc: CustomerReturnWithLines = {
        id,
        orgId: createOrgId,
        branchId: input.branchId,
        locationId: input.locationId,
        customerId: input.customerId,
        documentNumber: input.documentNumber ?? null,
        status: "draft",
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
        createdAt: now,
        updatedAt: now,
        postedAt: null,
        voidedAt: null,
        lines: input.lines.map((line) => ({
          id: `cr-line-${++lineSeq}`,
          orgId: createOrgId,
          customerReturnId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          unitCost: line.unitCost ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      customerReturns.set(id, doc);
      return doc;
    },
    async update(updateOrgId, id, input) {
      const existing = customerReturns.get(id);
      if (!existing || existing.orgId !== updateOrgId) return null;
      if (existing.status !== "draft") return existing;
      const updated: CustomerReturnWithLines = {
        ...existing,
        branchId: input.branchId ?? existing.branchId,
        locationId: input.locationId ?? existing.locationId,
        customerId: input.customerId ?? existing.customerId,
        documentNumber:
          input.documentNumber !== undefined
            ? input.documentNumber
            : existing.documentNumber,
        lines: input.lines
          ? input.lines.map((line) => ({
              id: line.id ?? `cr-line-${++lineSeq}`,
              orgId: updateOrgId,
              customerReturnId: id,
              productId: line.productId,
              qty: line.qty,
              lotId: line.lotId ?? null,
              unitCost: line.unitCost ?? null,
              lineNumber: line.lineNumber,
              serialNumbers: line.serialNumbers ?? [],
            }))
          : existing.lines,
        updatedAt: now,
      };
      customerReturns.set(id, updated);
      return updated;
    },
    async updateStatus(_orgId, id, status, occurredAt) {
      const existing = customerReturns.get(id);
      if (!existing) throw new Error("Customer return not found");
      const updated: CustomerReturnWithLines = {
        ...existing,
        status,
        postedAt: status === "posted" ? occurredAt : existing.postedAt,
        voidedAt: status === "void" ? occurredAt : existing.voidedAt,
        updatedAt: now,
      };
      customerReturns.set(id, updated);
      return updated;
    },
  };

  const customerRepo: CustomerRepository = {
    async list(listOrgId) {
      return customers.filter((c) => c.orgId === listOrgId);
    },
    async findById(findOrgId, id) {
      return customers.find((c) => c.orgId === findOrgId && c.id === id) ?? null;
    },
    async create(createOrgId, input: CreateCustomerInput) {
      const customer: Customer = {
        id: `customer-${++customerSeq}`,
        orgId: createOrgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
        createdAt: now,
        updatedAt: now,
      };
      customers.push(customer);
      return customer;
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
      balances.set(balanceKey(key.productId, key.locationId, key.lotId), balance);
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
      balances.set(balanceKey(key.productId, key.locationId, key.lotId), balance);
      return balance;
    },
    async insertMovement(input) {
      const movement: StockMovement = {
        id: `movement-${++movementSeq}`,
        createdAt: now,
        ...input,
      };
      movements.push(movement);
      return movement;
    },
    async listBalances() {
      return [...balances.values()];
    },
    async listMovements(listOrgId, filters) {
      return movements.filter((movement) => {
        if (movement.orgId !== listOrgId) return false;
        if (filters?.documentType && movement.documentType !== filters.documentType) {
          return false;
        }
        if (filters?.documentId && movement.documentId !== filters.documentId) {
          return false;
        }
        return true;
      });
    },
  };

  const ctx: UowContext = {
    po: {} as UowContext["po"],
    gr: {} as UowContext["gr"],
    products: {
      async findById(findOrgId, id) {
        return findOrgId === orgId && id === productId ? product : null;
      },
    },
    stock,
    lots: {
      async upsert(input) {
        return {
          id: input.lotId ?? "lot-1",
          orgId: input.orgId,
          productId: input.productId,
          lotCode: input.lotCode ?? "LOT-1",
          expiryDate: input.expiryDate ?? null,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
      },
      async list() {
        return [];
      },
    },
    serials: {
      async upsert(input) {
        const existing = serialsByNumber.get(input.serialNumber);
        const serial: Serial = {
          id: existing?.id ?? `serial-${input.serialNumber}`,
          orgId: input.orgId,
          productId: input.productId,
          lotId: input.lotId,
          locationId: input.locationId ?? null,
          serialNumber: input.serialNumber,
          status: "in_stock",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        serialsByNumber.set(input.serialNumber, serial);
        return serial;
      },
      async findByNumber(findOrgId, findProductId, serialNumber) {
        const serial = serialsByNumber.get(serialNumber);
        if (
          !serial ||
          serial.orgId !== findOrgId ||
          serial.productId !== findProductId
        ) {
          return null;
        }
        return serial;
      },
      async updateStatus(updateOrgId, id, status) {
        for (const [number, serial] of serialsByNumber) {
          if (serial.orgId === updateOrgId && serial.id === id) {
            const updated = { ...serial, status, updatedAt: now };
            serialsByNumber.set(number, updated);
            return updated;
          }
        }
        throw new Error("Serial not found");
      },
      async updateLocation(updateOrgId, id, nextLocationId) {
        for (const [number, serial] of serialsByNumber) {
          if (serial.orgId === updateOrgId && serial.id === id) {
            const updated = {
              ...serial,
              locationId: nextLocationId,
              updatedAt: now,
            };
            serialsByNumber.set(number, updated);
            return updated;
          }
        }
        throw new Error("Serial not found");
      },
      async list() {
        return [...serialsByNumber.values()];
      },
    },
    costing: {
      async insertLayer() { throw new Error("costing not used"); },
      async getLayer() { return null; },
      async listOpenLayers() { return []; },
      async listLayersBySourceDocument() { return []; },
      async setQtyRemaining() {},
      async lockOpenLayersFifo() { return []; },
      async listOpenLayersBySourceLine() { return []; },
      async insertConsumption() { throw new Error("costing not used"); },
      async listConsumptionsByMovementIds() { return []; },
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
    supplierReturns: supplierReturnPort,
    customerReturns: customerReturnPort,
    customers: customerRepo,
  };

  const uow: UnitOfWork = {
    async run(fn) {
      return fn(ctx);
    },
  };

  return {
    uow,
    ctx,
    stock,
    supplierReturnPort,
    customerReturnPort,
    customerRepo,
    balances,
    movements,
    outbox,
    serialsByNumber,
    getOnHand: () =>
      balances.get(balanceKey(productId, locationId, null))?.qtyOnHand ?? "0",
  };
}

describe("CustomerUseCases", () => {
  it("lists and creates customers", async () => {
    const { customerRepo } = makeFake();
    const useCases = new CustomerUseCases(customerRepo);

    const listed = await useCases.list(orgId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.code).toBe("C-1");

    const created = await useCases.create(orgId, {
      code: "C-2",
      name: "Retail Co",
    });
    expect(created.code).toBe("C-2");
    expect(await useCases.list(orgId)).toHaveLength(2);
  });
});

describe("SupplierReturnUseCases", () => {
  it("posts supplier return and decreases on-hand; void reverses", async () => {
    const fake = makeFake({ onHand: "10", supplierSerialNumbers: ["S1"] });
    const drafts = new SupplierReturnUseCases(fake.supplierReturnPort);
    const post = new PostSupplierReturn(fake.uow);
    const voidDoc = new VoidSupplierReturn(fake.uow);

    const draft = await drafts.create(orgId, {
      branchId,
      locationId,
      supplierId,
      documentNumber: "SR-1",
      lines: [
        {
          productId,
          qty: "3",
          lineNumber: 1,
          serialNumbers: ["S1"],
        },
      ],
    });

    const posted = await post.execute(orgId, userId, draft.id);
    expect(posted.doc.status).toBe("posted");
    expect(fake.getOnHand()).toBe("7");
    expect(posted.movements).toHaveLength(1);
    expect(posted.movements[0]?.movementType).toBe("supplier_return");
    expect(posted.movements[0]?.qty).toBe("-3");
    expect(fake.serialsByNumber.get("S1")?.status).toBe("returned");
    expect(fake.outbox).toHaveLength(2);

    const voided = await voidDoc.execute(orgId, userId, draft.id);
    expect(voided.doc.status).toBe("void");
    expect(fake.getOnHand()).toBe("10");
    expect(voided.movements[0]?.movementType).toBe("supplier_return_void");
    expect(fake.serialsByNumber.get("S1")?.status).toBe("in_stock");
  });

  it("rejects post when stock is insufficient", async () => {
    const fake = makeFake({ onHand: "2" });
    const drafts = new SupplierReturnUseCases(fake.supplierReturnPort);
    const post = new PostSupplierReturn(fake.uow);
    const draft = await drafts.create(orgId, {
      branchId,
      locationId,
      supplierId,
      lines: [{ productId, qty: "5", lineNumber: 1 }],
    });

    await expect(post.execute(orgId, userId, draft.id)).rejects.toThrow(
      /negative stock|Insufficient/i,
    );
  });
});

describe("CustomerReturnUseCases", () => {
  it("posts customer return and increases on-hand; void reverses", async () => {
    const fake = makeFake({
      onHand: "4",
      customerSerialNumbers: ["C1"],
      customerSerialStatus: "issued",
    });
    const drafts = new CustomerReturnUseCases(fake.customerReturnPort);
    const post = new PostCustomerReturn(fake.uow);
    const voidDoc = new VoidCustomerReturn(fake.uow);

    const draft = await drafts.create(orgId, {
      branchId,
      locationId,
      customerId,
      documentNumber: "CR-1",
      lines: [
        {
          productId,
          qty: "2",
          lineNumber: 1,
          serialNumbers: ["C1"],
        },
      ],
    });

    const posted = await post.execute(orgId, userId, draft.id);
    expect(posted.doc.status).toBe("posted");
    expect(fake.getOnHand()).toBe("6");
    expect(posted.movements[0]?.movementType).toBe("customer_return");
    expect(posted.movements[0]?.qty).toBe("2");
    expect(fake.serialsByNumber.get("C1")?.status).toBe("in_stock");
    expect(fake.serialsByNumber.get("C1")?.locationId).toBe(locationId);
    expect(fake.outbox).toHaveLength(2);

    const voided = await voidDoc.execute(orgId, userId, draft.id);
    expect(voided.doc.status).toBe("void");
    expect(fake.getOnHand()).toBe("4");
    expect(voided.movements[0]?.movementType).toBe("customer_return_void");
    expect(fake.serialsByNumber.get("C1")?.status).toBe("issued");
  });
});
