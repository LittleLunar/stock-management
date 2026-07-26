import { describe, expect, it, vi } from "vitest";
import {
  EnsureDefaultChartOfAccounts,
  ProcessOutboxForJournals,
  makeFakeAccounting,
} from "@stock-management/application";
import {
  processOutboxBatch,
  type OutboxPollerStore,
  type PendingOutboxEvent,
} from "./outbox-poller.js";

function makeFullJournalHarness() {
  const { port } = makeFakeAccounting();
  const ensureDefaults = new EnsureDefaultChartOfAccounts(port);
  const processor = new ProcessOutboxForJournals(port, ensureDefaults);

  async function ensurePeriod(onDate: string) {
    const [y, m] = onDate.split("-").map(Number);
    const year = y!;
    const month = m!;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    await port.insertPeriod({
      orgId: "org-1",
      year,
      month,
      startsOn: `${year}-${pad(month)}-01`,
      endsOn: `${year}-${pad(month)}-${pad(lastDay)}`,
      status: "open",
    });
  }

  return { port, processor, ensurePeriod };
}

function createFakeStore(
  initial: PendingOutboxEvent[],
): OutboxPollerStore & { processed: string[] } {
  const pending = [...initial];
  const processed: string[] = [];
  return {
    processed,
    async claimPending(limit: number) {
      return pending.splice(0, limit);
    },
    async markProcessed(id: string) {
      processed.push(id);
    },
    async markFailed() {},
  };
}

describe("D1 GR journal flow", () => {
  it("posts GR cost event → Dr Inventory Cr GRNI", async () => {
    const { port, processor, ensurePeriod } = makeFullJournalHarness();
    await ensurePeriod("2026-07-01");
    const journal = await processor.execute({
      id: "outbox-post-1",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: {
        inventoryValueDelta: "37.5",
        branchId: null,
        postedAt: "2026-07-15T12:00:00.000Z",
      },
    });
    expect(journal).not.toBeNull();
    const inv = await port.findAccountByCode("org-1", "1300");
    const grni = await port.findAccountByCode("org-1", "2100");
    expect(journal!.lines).toEqual([
      expect.objectContaining({
        accountId: inv!.id,
        debit: "37.5",
        credit: "0",
      }),
      expect.objectContaining({
        accountId: grni!.id,
        debit: "0",
        credit: "37.5",
      }),
    ]);
    expect(journal!.outboxEventId).toBe("outbox-post-1");
  });

  it("voids GR → reversing journal linked to original", async () => {
    const { port, processor, ensurePeriod } = makeFullJournalHarness();
    await ensurePeriod("2026-07-01");
    const original = await processor.execute({
      id: "outbox-post-1",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: {
        inventoryValueDelta: "37.5",
        postedAt: "2026-07-15T12:00:00.000Z",
      },
    });
    const reverse = await processor.execute({
      id: "outbox-void-1",
      orgId: "org-1",
      eventType: "document.voided",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: {
        inventoryValueDelta: "37.5",
        postedAt: "2026-07-16T12:00:00.000Z",
      },
    });
    expect(reverse!.reversesJournalId).toBe(original!.id);
    const inv = await port.findAccountByCode("org-1", "1300");
    const grni = await port.findAccountByCode("org-1", "2100");
    expect(reverse!.lines[0]).toMatchObject({
      accountId: grni!.id,
      debit: "37.5",
      credit: "0",
    });
    expect(reverse!.lines[1]).toMatchObject({
      accountId: inv!.id,
      debit: "0",
      credit: "37.5",
    });
  });

  it("poller marks stock.changed processed without journal", async () => {
    const { port, processor } = makeFullJournalHarness();
    const store = createFakeStore([
      {
        id: "evt-stock",
        orgId: "org-1",
        eventType: "stock.changed",
        aggregateType: "goods_receipt",
        aggregateId: "gr-1",
        payload: {},
      },
    ]);
    let journalCalls = 0;
    await processOutboxBatch({
      runInTransaction: async (fn) =>
        fn({
          store,
          processJournal: async (e) => {
            journalCalls += 1;
            await processor.execute(e);
          },
        }),
      log: { info: vi.fn(), error: vi.fn() },
    });
    expect(journalCalls).toBe(1);
    expect(store.processed).toEqual(["evt-stock"]);
    expect(
      await port.listJournalsBySourceDocument("org-1", "goods_receipt", "gr-1"),
    ).toEqual([]);
  });
});
