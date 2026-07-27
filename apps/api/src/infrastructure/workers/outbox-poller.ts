export type PendingOutboxEvent = {
  id: string;
  orgId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export interface OutboxPollerStore {
  claimPending(limit: number): Promise<PendingOutboxEvent[]>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export type OutboxPollerLog = {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
};

export type ProcessOutboxBatchDeps = {
  store: OutboxPollerStore;
  processJournal: (event: PendingOutboxEvent) => Promise<void>;
  processWebhooks: (event: PendingOutboxEvent) => Promise<void>;
  processNotifications?: (event: PendingOutboxEvent) => Promise<void>;
};

export type ProcessOutboxBatchOptions = {
  runInTransaction: <T>(
    fn: (deps: ProcessOutboxBatchDeps) => Promise<T>,
  ) => Promise<T>;
  log: OutboxPollerLog;
  batchSize?: number;
};

/**
 * Claim a batch of pending outbox events (caller supplies SKIP LOCKED store),
 * create journals when applicable, deliver webhooks, dispatch notifications,
 * log each payload, and mark processed — or failed if processing throws.
 * Order is mandatory: journal → webhooks → notifications → markProcessed.
 */
export async function processOutboxBatch(
  options: ProcessOutboxBatchOptions,
): Promise<number> {
  const batchSize = options.batchSize ?? 50;

  return options.runInTransaction(async (deps) => {
    const rows = await deps.store.claimPending(batchSize);
    for (const row of rows) {
      try {
        await deps.processJournal(row);
        await deps.processWebhooks(row);
        if (deps.processNotifications) {
          await deps.processNotifications(row);
        }
        options.log.info(
          {
            eventId: row.id,
            orgId: row.orgId,
            eventType: row.eventType,
            aggregateType: row.aggregateType,
            aggregateId: row.aggregateId,
            payload: row.payload,
          },
          "outbox event processed",
        );
        await deps.store.markProcessed(row.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        options.log.error(
          { eventId: row.id, err: message },
          "outbox event failed",
        );
        await deps.store.markFailed(row.id, message);
      }
    }
    return rows.length;
  });
}

export type OutboxPollerOptions = ProcessOutboxBatchOptions & {
  intervalMs: number;
};

/** In-process interval poller; start/stop from API lifecycle. */
export class OutboxPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly options: OutboxPollerOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.safeTick();
    }, this.options.intervalMs);
    // Unref so the timer alone does not keep the process alive during tests/shutdown.
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<number> {
    return processOutboxBatch(this.options);
  }

  private async safeTick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.tick();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.options.log.error({ err: message }, "outbox poller tick failed");
    } finally {
      this.ticking = false;
    }
  }
}
