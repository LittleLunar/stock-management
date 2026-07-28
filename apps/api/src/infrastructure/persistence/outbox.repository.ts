import { and, asc, eq, lte } from "drizzle-orm";
import type { OutboxEventInput, OutboxPort } from "@stock-management/application";
import type { DbClient } from "../db/client.js";
import { outboxEvents } from "../db/schema/index.js";
import type {
  OutboxPollerStore,
  PendingOutboxEvent,
} from "../workers/outbox-poller.js";

export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_RETRY_DELAY_MS = 30_000;

export class DrizzleOutboxRepository
  implements OutboxPort, OutboxPollerStore
{
  constructor(private readonly db: DbClient) {}

  async enqueue(event: OutboxEventInput): Promise<void> {
    await this.db.insert(outboxEvents).values(event);
  }

  async claimPending(limit: number): Promise<PendingOutboxEvent[]> {
    const rows = await this.db
      .select({
        id: outboxEvents.id,
        orgId: outboxEvents.orgId,
        eventType: outboxEvents.eventType,
        aggregateType: outboxEvents.aggregateType,
        aggregateId: outboxEvents.aggregateId,
        payload: outboxEvents.payload,
      })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.status, "pending"),
          lte(outboxEvents.availableAt, new Date()),
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      payload: row.payload,
    }));
  }

  async markProcessed(id: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        status: "processed",
        processedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, id));
  }

  /**
   * Retry-friendly failure: keep pending with backoff until max attempts,
   * then terminal failed. Lets notification channel retries re-run after
   * partial in-app success (idempotent via deliveryKey).
   */
  async markFailed(id: string, error: string): Promise<void> {
    const [row] = await this.db
      .select({ attempts: outboxEvents.attempts })
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id))
      .limit(1);
    const nextAttempts = (row?.attempts ?? 0) + 1;
    const terminal = nextAttempts >= OUTBOX_MAX_ATTEMPTS;

    await this.db
      .update(outboxEvents)
      .set({
        status: terminal ? "failed" : "pending",
        lastError: error,
        attempts: nextAttempts,
        availableAt: terminal
          ? new Date()
          : new Date(Date.now() + OUTBOX_RETRY_DELAY_MS),
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, id));
  }
}
