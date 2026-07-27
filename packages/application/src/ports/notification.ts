import type {
  Notification,
  NotificationAction,
  NotificationChannelKind,
  NotificationData,
  NotificationEventType,
  NotificationPreference,
} from "@stock-management/domain";
import type { MembershipRole } from "@stock-management/domain";
import type { Mailer } from "./auth.js";

export type NotificationEntityRef = {
  type: string;
  id: string;
};

export type NotificationIntent = {
  eventType: NotificationEventType;
  orgId: string;
  actorId?: string;
  entityRef?: NotificationEntityRef;
  recipientHints?: {
    email?: string;
    userId?: string;
    userIds?: string[];
    roles?: MembershipRole[];
  };
  payload?: Record<string, unknown>;
};

export interface EnqueueNotificationIntent {
  enqueue(intent: NotificationIntent): Promise<void>;
}

export class NoOpEnqueueNotificationIntent implements EnqueueNotificationIntent {
  async enqueue(_intent: NotificationIntent): Promise<void> {}
}

export type NotificationRecipient = {
  userId?: string;
  email: string;
};

export type NotificationDeliveryContext = {
  orgId: string;
  eventType: NotificationEventType;
  recipient: NotificationRecipient;
  title: string;
  body: string;
  data: NotificationData;
  actions: NotificationAction[];
  /** Set by InApp decorator after insert so email CTAs can reference the row. */
  notificationId?: string;
  /** Safe extras for channel logic (never include secrets). */
  payload?: Record<string, unknown>;
  /**
   * Idempotency key for in-app writes across outbox retries
   * (typically `${outboxEventId}:${userId|email}`).
   */
  deliveryKey?: string;
};

export interface NotificationChannel {
  deliver(ctx: NotificationDeliveryContext): Promise<void>;
}

export type NotificationListFilter = {
  includeDismissed?: boolean;
  limit?: number;
  offset?: number;
};

export interface NotificationRepository {
  insert(input: {
    orgId: string;
    userId: string;
    eventType: NotificationEventType;
    title: string;
    body: string;
    data: NotificationData;
    actions: NotificationAction[];
  }): Promise<Notification>;

  /**
   * Lookup prior in-app row for the same outbox delivery (retry safety).
   * Match is on `data.deliveryKey`.
   */
  findByDeliveryKey(
    orgId: string,
    userId: string,
    deliveryKey: string,
  ): Promise<Notification | null>;

  listForUser(
    orgId: string,
    userId: string,
    filter?: NotificationListFilter,
  ): Promise<Notification[]>;

  unreadCount(orgId: string, userId: string): Promise<number>;

  findById(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<Notification | null>;

  markRead(orgId: string, userId: string, id: string, at: Date): Promise<void>;

  markAllRead(orgId: string, userId: string, at: Date): Promise<number>;

  dismiss(orgId: string, userId: string, id: string, at: Date): Promise<void>;
}

export interface NotificationPreferenceRepository {
  list(
    orgId: string,
    userId: string,
  ): Promise<NotificationPreference[]>;

  upsert(input: {
    orgId: string;
    userId: string;
    eventType: NotificationEventType;
    channel: NotificationChannelKind;
    enabled: boolean;
  }): Promise<NotificationPreference>;

  findEnabled(
    orgId: string,
    userId: string,
    eventType: NotificationEventType,
    channel: NotificationChannelKind,
  ): Promise<boolean | null>;
}

export type NotificationUserRef = {
  id: string;
  email: string;
  role: MembershipRole;
  branchIds: string[];
};

/** Resolve org members for policy recipient expansion. */
export interface NotificationRecipientDirectory {
  listActiveMembers(orgId: string): Promise<NotificationUserRef[]>;
  findUserById(userId: string): Promise<{ id: string; email: string } | null>;
  findUserByEmail(
    email: string,
  ): Promise<{ id: string; email: string } | null>;
}

export type EventPolicyResolved = {
  recipients: NotificationRecipient[];
  title: string;
  body: string;
  data: NotificationData;
  actions: NotificationAction[];
  defaultChannels: NotificationChannelKind[];
};

export interface NotificationEventPolicy {
  readonly eventType: NotificationEventType;
  resolve(
    intent: NotificationIntent,
    directory: NotificationRecipientDirectory,
  ): Promise<EventPolicyResolved>;
}

export type { Mailer };
