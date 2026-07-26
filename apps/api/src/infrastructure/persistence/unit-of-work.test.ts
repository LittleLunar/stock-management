import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client.js";
import { DrizzleUnitOfWork } from "./unit-of-work.js";

describe("DrizzleUnitOfWork", () => {
  it("builds transaction-scoped inventory adapters", async () => {
    const tx = {};
    const transaction = vi.fn(
      async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
    );
    const db = { transaction } as unknown as Db;

    const result = await new DrizzleUnitOfWork(db).run(async (context) => {
      expect(context.po).toBeDefined();
      expect(context.gr).toBeDefined();
      expect(context.issues).toBeDefined();
      expect(context.transfers).toBeDefined();
      expect(context.adjustments).toBeDefined();
      expect(context.counts).toBeDefined();
      expect(context.products).toBeDefined();
      expect(context.locations).toBeDefined();
      expect(context.stock).toBeDefined();
      expect(context.lots).toBeDefined();
      expect(context.serials).toBeDefined();
      expect(context.outbox).toBeDefined();
      expect(context.idempotency).toBeDefined();
      return "committed";
    });

    expect(result).toBe("committed");
    expect(transaction).toHaveBeenCalledOnce();
  });
});
