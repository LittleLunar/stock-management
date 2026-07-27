import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
} from "@stock-management/domain";
import type { Location, MembershipAccess } from "@stock-management/domain";
import type {
  CreateStockTransferInput,
  StockTransferPort,
  StockTransferWithLines,
  UpdateStockTransferInput,
} from "../ports/inventory.js";
import type { LocationLookupPort } from "../ports/inventory.js";
import { StockTransferUseCases } from "./stock-transfer.js";

const now = new Date("2026-07-26T00:00:00.000Z");
const orgId = "org-1";
const hqAccess: MembershipAccess = { role: "org_admin", branchIds: [] };

function makeLocation(
  id: string,
  branchId: string,
  type: Location["type"] = "storage",
): Location {
  return {
    id,
    orgId,
    branchId,
    code: id,
    name: id,
    type,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function makeHarness(locations: Location[]) {
  const byId = new Map(locations.map((loc) => [loc.id, loc]));
  const transfers = new Map<string, StockTransferWithLines>();

  const locationLookup: LocationLookupPort = {
    async findById(lookupOrgId, id) {
      const location = byId.get(id);
      return location?.orgId === lookupOrgId ? location : null;
    },
  };

  const fakeTransfers: StockTransferPort = {
    async list() {
      return [...transfers.values()];
    },
    async findById(lookupOrgId, id) {
      const transfer = transfers.get(id);
      return transfer?.orgId === lookupOrgId ? transfer : null;
    },
    async create(createOrgId, input: CreateStockTransferInput) {
      const from = byId.get(input.fromLocationId);
      const to = byId.get(input.toLocationId);
      if (!from || !to) throw new NotFoundError("Location");
      const id = `transfer-${transfers.size + 1}`;
      const transfer: StockTransferWithLines = {
        id,
        orgId: createOrgId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        transitLocationId: input.transitLocationId,
        fromBranchId: from.branchId,
        toBranchId: to.branchId,
        purpose: input.purpose ?? "standard",
        documentNumber: input.documentNumber ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        shippedAt: null,
        receivedAt: null,
        voidedAt: null,
        lines: input.lines.map((line, index) => ({
          id: line.id ?? `line-${index + 1}`,
          orgId: createOrgId,
          stockTransferId: id,
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId ?? null,
          lineNumber: line.lineNumber,
          serialNumbers: line.serialNumbers ?? [],
        })),
      };
      transfers.set(id, transfer);
      return transfer;
    },
    async update(
      updateOrgId,
      id,
      input: UpdateStockTransferInput,
    ): Promise<StockTransferWithLines | null> {
      const current = await fakeTransfers.findById(updateOrgId, id);
      if (!current) return null;
      const fromLocationId = input.fromLocationId ?? current.fromLocationId;
      const toLocationId = input.toLocationId ?? current.toLocationId;
      const from = byId.get(fromLocationId);
      const to = byId.get(toLocationId);
      if (!from || !to) throw new NotFoundError("Location");
      const updated: StockTransferWithLines = {
        ...current,
        fromLocationId,
        toLocationId,
        transitLocationId:
          input.transitLocationId ?? current.transitLocationId,
        fromBranchId: from.branchId,
        toBranchId: to.branchId,
        purpose: input.purpose ?? current.purpose,
        documentNumber:
          input.documentNumber !== undefined
            ? input.documentNumber
            : current.documentNumber,
        lines:
          input.lines?.map((line, index) => ({
            id: line.id ?? `line-${index + 1}`,
            orgId: updateOrgId,
            stockTransferId: id,
            productId: line.productId,
            qty: line.qty,
            lotId: line.lotId ?? null,
            lineNumber: line.lineNumber,
            serialNumbers: line.serialNumbers ?? [],
          })) ?? current.lines,
        updatedAt: now,
      };
      transfers.set(id, updated);
      return updated;
    },
    async updateStatus() {
      throw new Error("not used");
    },
  };

  return {
    useCases: new StockTransferUseCases(fakeTransfers, locationLookup),
    transferCount: () => transfers.size,
  };
}

describe("StockTransferUseCases purpose", () => {
  it("rejects replenishment when from and to locations share a branch", async () => {
    const { useCases } = makeHarness([
      makeLocation("loc-a", "b1"),
      makeLocation("loc-b", "b1"),
      makeLocation("loc-t", "b1", "transit"),
    ]);

    await expect(
      useCases.create(
        orgId,
        {
          fromLocationId: "loc-a",
          toLocationId: "loc-b",
          transitLocationId: "loc-t",
          purpose: "replenishment",
          lines: [{ productId: "p1", qty: "1", lineNumber: 1 }],
        },
        hqAccess,
      ),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("creates replenishment when branches differ", async () => {
    const { useCases } = makeHarness([
      makeLocation("loc-hq", "hq"),
      makeLocation("loc-store", "store"),
      makeLocation("loc-t", "hq", "transit"),
    ]);

    const created = await useCases.create(
      orgId,
      {
        fromLocationId: "loc-hq",
        toLocationId: "loc-store",
        transitLocationId: "loc-t",
        purpose: "replenishment",
        lines: [{ productId: "p1", qty: "1", lineNumber: 1 }],
      },
      hqAccess,
    );

    expect(created.purpose).toBe("replenishment");
    expect(created.fromBranchId).not.toBe(created.toBranchId);
  });

  it("defaults purpose to standard", async () => {
    const { useCases } = makeHarness([
      makeLocation("loc-a", "b1"),
      makeLocation("loc-b", "b1"),
      makeLocation("loc-t", "b1", "transit"),
    ]);

    const created = await useCases.create(
      orgId,
      {
        fromLocationId: "loc-a",
        toLocationId: "loc-b",
        transitLocationId: "loc-t",
        lines: [{ productId: "p1", qty: "1", lineNumber: 1 }],
      },
      hqAccess,
    );

    expect(created.purpose).toBe("standard");
  });

  it("rejects replenishment without toBranch grant and does not persist", async () => {
    const { useCases, transferCount } = makeHarness([
      makeLocation("loc-hq", "hq"),
      makeLocation("loc-store", "store"),
      makeLocation("loc-t", "hq", "transit"),
    ]);

    await expect(
      useCases.create(
        orgId,
        {
          fromLocationId: "loc-hq",
          toLocationId: "loc-store",
          transitLocationId: "loc-t",
          purpose: "replenishment",
          lines: [{ productId: "p1", qty: "1", lineNumber: 1 }],
        },
        { role: "warehouse", branchIds: ["hq"] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(transferCount()).toBe(0);
  });
});
