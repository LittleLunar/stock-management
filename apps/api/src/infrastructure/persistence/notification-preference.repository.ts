import { and, eq } from "drizzle-orm";
import type {
  NotificationChannelKind,
  NotificationEventType,
  NotificationPreference,
} from "@stock-management/domain";
import type { NotificationPreferenceRepository } from "@stock-management/application";
import type { DbClient } from "../db/client.js";
import { notificationPreferences } from "../db/schema/index.js";

function mapRow(
  row: typeof notificationPreferences.$inferSelect,
): NotificationPreference {
  return {
    id: row.id,
    userId: row.userId,
    orgId: row.orgId,
    eventType: row.eventType as NotificationEventType,
    channel: row.channel,
    enabled: row.enabled,
  };
}

export class DrizzleNotificationPreferenceRepository
  implements NotificationPreferenceRepository
{
  constructor(private readonly db: DbClient) {}

  async list(
    orgId: string,
    userId: string,
  ): Promise<NotificationPreference[]> {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.orgId, orgId),
          eq(notificationPreferences.userId, userId),
        ),
      );
    return rows.map(mapRow);
  }

  async upsert(input: {
    orgId: string;
    userId: string;
    eventType: NotificationEventType;
    channel: NotificationChannelKind;
    enabled: boolean;
  }): Promise<NotificationPreference> {
    const [row] = await this.db
      .insert(notificationPreferences)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        eventType: input.eventType,
        channel: input.channel,
        enabled: input.enabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.orgId,
          notificationPreferences.eventType,
          notificationPreferences.channel,
        ],
        set: { enabled: input.enabled },
      })
      .returning();
    return mapRow(row!);
  }

  async findEnabled(
    orgId: string,
    userId: string,
    eventType: NotificationEventType,
    channel: NotificationChannelKind,
  ): Promise<boolean | null> {
    const [row] = await this.db
      .select({ enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.orgId, orgId),
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.eventType, eventType),
          eq(notificationPreferences.channel, channel),
        ),
      )
      .limit(1);
    return row ? row.enabled : null;
  }
}
