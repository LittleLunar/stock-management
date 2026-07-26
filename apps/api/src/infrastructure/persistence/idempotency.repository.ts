import { and, eq, sql } from "drizzle-orm";
import type {
  IdempotencyPort,
  IdempotencyRecord,
} from "@stock-management/application";
import type { DbClient } from "../db/client.js";
import { idempotencyKeys } from "../db/schema/index.js";

export class DrizzleIdempotencyRepository implements IdempotencyPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  async find(
    orgId: string,
    operation: string,
    externalSystem: string,
    externalId: string,
  ): Promise<IdempotencyRecord | null> {
    if (this.lockForUpdate) {
      const lockKey = `${orgId}:${operation}:${externalSystem}:${externalId}`;
      await this.db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );
    }
    const query = this.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.orgId, orgId),
          eq(idempotencyKeys.operation, operation),
          eq(idempotencyKeys.externalSystem, externalSystem),
          eq(idempotencyKeys.externalId, externalId),
        ),
      );
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    const record = rows[0];
    return record
      ? {
          orgId: record.orgId,
          operation: record.operation,
          externalSystem: record.externalSystem,
          externalId: record.externalId,
          result: record.result,
        }
      : null;
  }

  async save(record: IdempotencyRecord): Promise<void> {
    await this.db
      .insert(idempotencyKeys)
      .values(record)
      .onConflictDoNothing({
        target: [
          idempotencyKeys.orgId,
          idempotencyKeys.operation,
          idempotencyKeys.externalSystem,
          idempotencyKeys.externalId,
        ],
      });
  }
}
