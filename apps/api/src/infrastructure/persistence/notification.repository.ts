import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type {
  NotificationAction,
  NotificationData,
  NotificationEventType,
} from "@stock-management/domain";
import type {
  NotificationListFilter,
  NotificationRepository,
} from "@stock-management/application";
import type { Notification } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { notifications } from "../db/schema/index.js";

function mapRow(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    eventType: row.eventType as NotificationEventType,
    title: row.title,
    body: row.body,
    data: (row.data ?? {}) as NotificationData,
    actions: (row.actions ?? []) as NotificationAction[],
    readAt: row.readAt,
    dismissedAt: row.dismissedAt,
    createdAt: row.createdAt,
  };
}

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: DbClient) {}

  async insert(input: {
    orgId: string;
    userId: string;
    eventType: NotificationEventType;
    title: string;
    body: string;
    data: NotificationData;
    actions: NotificationAction[];
  }): Promise<Notification> {
    const [row] = await this.db
      .insert(notifications)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        data: input.data,
        actions: input.actions,
      })
      .returning();
    return mapRow(row!);
  }

  async listForUser(
    orgId: string,
    userId: string,
    filter?: NotificationListFilter,
  ): Promise<Notification[]> {
    const includeDismissed = filter?.includeDismissed ?? false;
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    const conditions = [
      eq(notifications.orgId, orgId),
      eq(notifications.userId, userId),
    ];
    if (!includeDismissed) {
      conditions.push(isNull(notifications.dismissedAt));
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(
        sql`(${notifications.readAt} is null) desc`,
        desc(notifications.createdAt),
      )
      .limit(limit)
      .offset(offset);

    return rows.map(mapRow);
  }

  async unreadCount(orgId: string, userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.orgId, orgId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          isNull(notifications.dismissedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async findById(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<Notification | null> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.orgId, orgId),
          eq(notifications.userId, userId),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async markRead(
    orgId: string,
    userId: string,
    id: string,
    at: Date,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.orgId, orgId),
          eq(notifications.userId, userId),
        ),
      );
  }

  async markAllRead(orgId: string, userId: string, at: Date): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(
        and(
          eq(notifications.orgId, orgId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          isNull(notifications.dismissedAt),
        ),
      )
      .returning({ id: notifications.id });
    return rows.length;
  }

  async dismiss(
    orgId: string,
    userId: string,
    id: string,
    at: Date,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({ dismissedAt: at })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.orgId, orgId),
          eq(notifications.userId, userId),
        ),
      );
  }
}
