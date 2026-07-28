import {
  NOTIFICATION_CHANNEL_DEFAULTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NotFoundError,
  isChannelEnabled,
  type NotificationChannelKind,
  type NotificationEventType,
  type NotificationPreference,
} from "@stock-management/domain";
import type {
  NotificationPublisher,
  NotificationPreferenceRepository,
  NotificationRepository,
} from "../ports/notification.js";

export type EffectiveNotificationPreference = {
  eventType: NotificationEventType;
  channel: NotificationChannelKind;
  enabled: boolean;
  source: "preference" | "default";
};

export class NotificationUseCases {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly publisher?: NotificationPublisher,
  ) {}

  list(
    orgId: string,
    userId: string,
    filter?: { includeDismissed?: boolean; limit?: number; offset?: number },
  ) {
    return this.notifications.listForUser(orgId, userId, filter);
  }

  unreadCount(orgId: string, userId: string) {
    return this.notifications.unreadCount(orgId, userId);
  }

  async markRead(orgId: string, userId: string, id: string) {
    const row = await this.notifications.findById(orgId, userId, id);
    if (!row) throw new NotFoundError("Notification");
    if (!row.readAt) {
      await this.notifications.markRead(orgId, userId, id, new Date());
      this.publisher?.publish(userId, orgId, {
        type: "notification.read",
        id,
      });
      const count = await this.notifications.unreadCount(orgId, userId);
      this.publisher?.publish(userId, orgId, {
        type: "unread-count",
        count,
      });
    }
  }

  async markAllRead(orgId: string, userId: string) {
    const updated = await this.notifications.markAllRead(
      orgId,
      userId,
      new Date(),
    );
    if (updated > 0) {
      this.publisher?.publish(userId, orgId, {
        type: "notifications.read_all",
      });
      this.publisher?.publish(userId, orgId, {
        type: "unread-count",
        count: 0,
      });
    }
    return updated;
  }

  async dismiss(orgId: string, userId: string, id: string) {
    const row = await this.notifications.findById(orgId, userId, id);
    if (!row) throw new NotFoundError("Notification");
    await this.notifications.dismiss(orgId, userId, id, new Date());
    if (!row.readAt) {
      const count = await this.notifications.unreadCount(orgId, userId);
      this.publisher?.publish(userId, orgId, {
        type: "unread-count",
        count,
      });
    }
  }

  async getPreferences(
    orgId: string,
    userId: string,
  ): Promise<EffectiveNotificationPreference[]> {
    const rows = await this.preferences.list(orgId, userId);
    const byKey = new Map(
      rows.map((r) => [`${r.eventType}:${r.channel}`, r] as const),
    );
    const result: EffectiveNotificationPreference[] = [];
    for (const eventType of NOTIFICATION_EVENT_TYPES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        const existing = byKey.get(`${eventType}:${channel}`);
        result.push({
          eventType,
          channel,
          enabled: isChannelEnabled(
            eventType,
            channel,
            existing?.enabled ?? null,
          ),
          source: existing ? "preference" : "default",
        });
      }
    }
    return result;
  }

  async putPreferences(
    orgId: string,
    userId: string,
    items: Array<{
      eventType: NotificationEventType;
      channel: NotificationChannelKind;
      enabled: boolean;
    }>,
  ): Promise<NotificationPreference[]> {
    const saved: NotificationPreference[] = [];
    for (const item of items) {
      saved.push(
        await this.preferences.upsert({
          orgId,
          userId,
          eventType: item.eventType,
          channel: item.channel,
          enabled: item.enabled,
        }),
      );
    }
    return saved;
  }
}

/** Expose defaults for HTTP docs/tests. */
export { NOTIFICATION_CHANNEL_DEFAULTS };
