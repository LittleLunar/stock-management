import { describe, expect, it } from "vitest";
import {
  LocationQuarantinedError,
  LotExpiredError,
  LotQuarantinedError,
} from "@stock-management/domain";
import { assertOutboundSellable } from "./assert-outbound-sellable.js";

const today = new Date("2026-07-26T12:00:00.000Z");

function ctx(opts: {
  locationType?: "storage" | "quarantine";
  lot?: {
    id: string;
    expiryDate: Date | null;
    status: "active" | "quarantine";
  } | null;
  toLocationType?: "storage" | "quarantine";
}) {
  const locationType = opts.locationType ?? "storage";
  return {
    locations: {
      async findById(_org: string, id: string) {
        if (id === "to") {
          return {
            id: "to",
            orgId: "o",
            branchId: "b",
            code: "T",
            name: "To",
            type: opts.toLocationType ?? "storage",
            status: "active" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return {
          id: "from",
          orgId: "o",
          branchId: "b",
          code: "F",
          name: "From",
          type: locationType,
          status: "active" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
    lots: {
      async upsert() {
        throw new Error("n/a");
      },
      async list() {
        return [];
      },
      async findById() {
        if (!opts.lot) return null;
        return {
          id: opts.lot.id,
          orgId: "o",
          productId: "p",
          lotCode: "L1",
          expiryDate: opts.lot.expiryDate,
          status: opts.lot.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
  };
}

describe("assertOutboundSellable", () => {
  it("blocks expired lot on issue", async () => {
    await expect(
      assertOutboundSellable(
        ctx({
          lot: {
            id: "lot-1",
            expiryDate: new Date("2026-07-01T00:00:00.000Z"),
            status: "active",
          },
        }),
        {
          orgId: "o",
          locationId: "from",
          lotId: "lot-1",
          operation: "issue",
          today,
        },
      ),
    ).rejects.toBeInstanceOf(LotExpiredError);
  });

  it("blocks quarantine location on issue", async () => {
    await expect(
      assertOutboundSellable(ctx({ locationType: "quarantine", lot: null }), {
        orgId: "o",
        locationId: "from",
        lotId: null,
        operation: "issue",
        today,
      }),
    ).rejects.toBeInstanceOf(LocationQuarantinedError);
  });

  it("allows transfer ship quarantine → storage with expired quarantined lot", async () => {
    await expect(
      assertOutboundSellable(
        ctx({
          locationType: "quarantine",
          toLocationType: "storage",
          lot: {
            id: "lot-1",
            expiryDate: new Date("2026-07-01T00:00:00.000Z"),
            status: "quarantine",
          },
        }),
        {
          orgId: "o",
          locationId: "from",
          lotId: "lot-1",
          operation: "transfer_ship",
          toLocationId: "to",
          today,
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks quarantined lot on issue", async () => {
    await expect(
      assertOutboundSellable(
        ctx({
          lot: {
            id: "lot-1",
            expiryDate: new Date("2026-08-01T00:00:00.000Z"),
            status: "quarantine",
          },
        }),
        {
          orgId: "o",
          locationId: "from",
          lotId: "lot-1",
          operation: "issue",
          today,
        },
      ),
    ).rejects.toBeInstanceOf(LotQuarantinedError);
  });
});
