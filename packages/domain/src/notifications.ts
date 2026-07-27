/** Persisted / policy catalog event types (dotted forms). */
export const NOTIFICATION_EVENT_TYPES = [
  "user.welcome",
  "user.email_verified",
  "auth.password_changed",
  "membership.invite_received",
  "membership.invite_accepted",
  "membership.invite_declined",
  "document.posted",
  "document.voided",
  "stock.low",
  "approval.assigned",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "email"] as const;
export type NotificationChannelKind = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationActionKind = "open" | "server";

export type NotificationAction = {
  id: string;
  label: string;
  kind: NotificationActionKind;
};

export type NotificationData = {
  deepLink?: string;
  entityIds?: Record<string, string>;
  [key: string]: unknown;
};

export type Notification = {
  id: string;
  orgId: string;
  userId: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  data: NotificationData;
  actions: NotificationAction[];
  readAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
};

export type NotificationPreference = {
  id: string;
  userId: string;
  orgId: string;
  eventType: NotificationEventType;
  channel: NotificationChannelKind;
  enabled: boolean;
};

/** Policy defaults when no preference row exists. */
export const NOTIFICATION_CHANNEL_DEFAULTS: Record<
  NotificationEventType,
  Record<NotificationChannelKind, boolean>
> = {
  "user.welcome": { in_app: true, email: true },
  "user.email_verified": { in_app: true, email: true },
  "auth.password_changed": { in_app: true, email: true },
  "membership.invite_received": { in_app: true, email: true },
  "membership.invite_accepted": { in_app: true, email: true },
  "membership.invite_declined": { in_app: true, email: true },
  "approval.assigned": { in_app: true, email: true },
  "document.posted": { in_app: true, email: false },
  "document.voided": { in_app: true, email: false },
  "stock.low": { in_app: true, email: true },
};

export function isNotificationEventType(
  value: string,
): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Effective channel toggle: preference row wins; otherwise policy default.
 */
export function isChannelEnabled(
  eventType: NotificationEventType,
  channel: NotificationChannelKind,
  preferenceEnabled: boolean | null | undefined,
): boolean {
  if (preferenceEnabled != null) return preferenceEnabled;
  return NOTIFICATION_CHANNEL_DEFAULTS[eventType][channel];
}

export function assertNotificationEventType(
  value: string,
): NotificationEventType {
  if (!isNotificationEventType(value)) {
    throw new Error(`Unknown notification event type: ${value}`);
  }
  return value;
}
