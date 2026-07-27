import { describe, expect, it, vi } from "vitest";
import {
  processOutboxBatch,
  type OutboxPollerStore,
  type PendingOutboxEvent,
} from "./outbox-poller.js";

function makeEvent(
  overrides: Partial<PendingOutboxEvent> = {},
): PendingOutboxEvent {
  return {
    id: "evt-1",
    orgId: "org-1",
    eventType: "document.posted",
    aggregateType: "goods_receipt",
    aggregateId: "gr-1",
    payload: { documentId: "gr-1" },
    ...overrides,
  };
}

function createFakeStore(
  initial: PendingOutboxEvent[],
): OutboxPollerStore & {
  processed: string[];
  failed: Array<{ id: string; error: string }>;
} {
  const pending = [...initial];
  const processed: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  return {
    processed,
    failed,
    async claimPending(limit: number) {
      return pending.splice(0, limit);
    },
    async markProcessed(id: string) {
      processed.push(id);
    },
    async markFailed(id: string, error: string) {
      failed.push({ id, error });
    },
  };
}

describe("processOutboxBatch", () => {
  it("marks pending events as processed after logging payload", async () => {
    const store = createFakeStore([
      makeEvent({ id: "evt-1" }),
      makeEvent({ id: "evt-2", payload: { documentId: "gr-2" } }),
    ]);
    const info = vi.fn();

    const count = await processOutboxBatch({
      runInTransaction: async (fn) =>
        fn({
          store,
          processJournal: async () => {},
          processWebhooks: async () => {},
        }),
      log: { info, error: vi.fn() },
      batchSize: 10,
    });

    expect(count).toBe(2);
    expect(store.processed).toEqual(["evt-1", "evt-2"]);
    expect(store.failed).toEqual([]);
    expect(info).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt-1",
        payload: { documentId: "gr-1" },
      }),
      "outbox event processed",
    );
  });

  it("invokes processJournal before markProcessed", async () => {
    const store = createFakeStore([makeEvent()]);
    const order: string[] = [];
    const originalMark = store.markProcessed.bind(store);
    store.markProcessed = async (id: string) => {
      order.push(`processed:${id}`);
      await originalMark(id);
    };

    await processOutboxBatch({
      runInTransaction: async (fn) =>
        fn({
          store,
          processJournal: async (e) => {
            order.push(`journal:${e.id}`);
          },
          processWebhooks: async () => {},
        }),
      log: { info: vi.fn(), error: vi.fn() },
    });

    expect(order[0]).toBe("journal:evt-1");
    expect(order[1]).toBe("processed:evt-1");
  });

  it("marks event failed when processing throws", async () => {
    const store = createFakeStore([makeEvent({ id: "evt-bad" })]);
    const error = vi.fn();

    const count = await processOutboxBatch({
      runInTransaction: async (fn) =>
        fn({
          store,
          processJournal: async () => {
            throw new Error("journal boom");
          },
          processWebhooks: async () => {},
        }),
      log: { info: vi.fn(), error },
      batchSize: 10,
    });

    expect(count).toBe(1);
    expect(store.processed).toEqual([]);
    expect(store.failed).toEqual([{ id: "evt-bad", error: "journal boom" }]);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt-bad", err: "journal boom" }),
      "outbox event failed",
    );
  });
});

describe("processOutboxBatch journal then webhook", () => {
  it("calls processJournal before processWebhooks then markProcessed", async () => {
    const order: string[] = [];
    const event: PendingOutboxEvent = {
      id: "e1",
      orgId: "o1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr1",
      payload: {},
    };
    const store: OutboxPollerStore = {
      async claimPending() {
        return [event];
      },
      async markProcessed(id) {
        order.push(`processed:${id}`);
      },
      async markFailed() {
        order.push("failed");
      },
    };
    await processOutboxBatch({
      log: { info() {}, error() {} },
      runInTransaction: async (fn) =>
        fn({
          store,
          processJournal: async () => {
            order.push("journal");
          },
          processWebhooks: async () => {
            order.push("webhook");
          },
        }),
    });
    expect(order).toEqual(["journal", "webhook", "processed:e1"]);
  });

  it("markFailed when webhooks throw after journal", async () => {
    const event: PendingOutboxEvent = {
      id: "e2",
      orgId: "o1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr1",
      payload: {},
    };
    const markFailed = vi.fn();
    await processOutboxBatch({
      log: { info() {}, error() {} },
      runInTransaction: async (fn) =>
        fn({
          store: {
            async claimPending() {
              return [event];
            },
            async markProcessed() {
              throw new Error("should not process");
            },
            markFailed,
          },
          processJournal: async () => {},
          processWebhooks: async () => {
            throw new Error("hook down");
          },
        }),
    });
    expect(markFailed).toHaveBeenCalledWith("e2", "hook down");
  });
});
