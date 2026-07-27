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
    }
  }

  markAllRead(orgId: string, userId: string) {
    return this.notifications.markAllRead(orgId, userId, new Date());
  }

  async dismiss(orgId: string, userId: string, id: string) {
    const row = await this.notifications.findById(orgId, userId, id);
    if (!row) throw new NotFoundError("Notification");
    await this.notifications.dismiss(orgId, userId, id, new Date());
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
