import type { OutboxEventInput, OutboxPort } from "@stock-management/application";
import type { DbClient } from "../db/client.js";
import { outboxEvents } from "../db/schema/index.js";

export class DrizzleOutboxRepository implements OutboxPort {
  constructor(private readonly db: DbClient) {}

  async enqueue(event: OutboxEventInput): Promise<void> {
    await this.db.insert(outboxEvents).values(event);
  }
}
