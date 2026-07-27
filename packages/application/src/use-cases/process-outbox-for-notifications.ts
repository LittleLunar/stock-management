import {
  assertNotificationEventType,
  isNotificationEventType,
  type NotificationEventType,
} from "@stock-management/domain";
import type {
  EnqueueNotificationIntent,
  NotificationChannel,
  NotificationEventPolicy,
  NotificationIntent,
  NotificationRecipientDirectory,
} from "../ports/notification.js";
import { NotificationEventPolicyRegistry } from "../notifications/policies.js";

export type OutboxNotificationEvent = {
  id: string;
  orgId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

/**
 * Expand a notification intent through the policy registry and deliver
 * via the decorator channel chain (once per recipient).
 */
export class ProcessOutboxForNotifications {
  constructor(
    private readonly channel: NotificationChannel,
    private readonly directory: NotificationRecipientDirectory,
    private readonly registry: NotificationEventPolicyRegistry = new NotificationEventPolicyRegistry(),
  ) {}

  async execute(event: OutboxNotificationEvent): Promise<void> {
    const intents = await this.toIntents(event);
    for (const intent of intents) {
      await this.dispatchIntent(intent);
    }
  }

  async dispatchIntent(intent: NotificationIntent): Promise<void> {
    const policy = this.registry.require(intent.eventType);
    await this.deliverWithPolicy(policy, intent);
  }

  private async deliverWithPolicy(
    policy: NotificationEventPolicy,
    intent: NotificationIntent,
  ): Promise<void> {
    const resolved = await policy.resolve(intent, this.directory);
    for (const recipient of resolved.recipients) {
      await this.channel.deliver({
        orgId: intent.orgId,
        eventType: intent.eventType,
        recipient,
        title: resolved.title,
        body: resolved.body,
        data: resolved.data,
        actions: resolved.actions,
        payload: intent.payload,
      });
    }
  }

  private async toIntents(
    event: OutboxNotificationEvent,
  ): Promise<NotificationIntent[]> {
    if (event.eventType === "notification.dispatch") {
      return [parseDispatchPayload(event)];
    }

    if (
      event.eventType === "document.posted" ||
      event.eventType === "document.voided"
    ) {
      return [
        {
          eventType: event.eventType,
          orgId: event.orgId,
          actorId:
            typeof event.payload.userId === "string"
              ? event.payload.userId
              : undefined,
          entityRef: {
            type: event.aggregateType,
            id: event.aggregateId,
          },
          payload: event.payload,
        },
      ];
    }

    // stock.changed and other domain events are ignored here unless
    // explicitly wrapped as notification.dispatch.
    return [];
  }
}

function parseDispatchPayload(
  event: OutboxNotificationEvent,
): NotificationIntent {
  const payload = event.payload;
  const eventTypeRaw =
    typeof payload.eventType === "string"
      ? payload.eventType
      : typeof payload.notificationEventType === "string"
        ? payload.notificationEventType
        : null;
  if (!eventTypeRaw || !isNotificationEventType(eventTypeRaw)) {
    throw new Error(
      `notification.dispatch missing valid eventType (outbox ${event.id})`,
    );
  }
  const eventType = assertNotificationEventType(eventTypeRaw);
  const entityRef =
    payload.entityRef &&
    typeof payload.entityRef === "object" &&
    payload.entityRef !== null &&
    "type" in payload.entityRef &&
    "id" in payload.entityRef &&
    typeof (payload.entityRef as { type: unknown }).type === "string" &&
    typeof (payload.entityRef as { id: unknown }).id === "string"
      ? {
          type: (payload.entityRef as { type: string }).type,
          id: (payload.entityRef as { id: string }).id,
        }
      : { type: event.aggregateType, id: event.aggregateId };

  return {
    eventType,
    orgId: event.orgId,
    actorId:
      typeof payload.actorId === "string" ? payload.actorId : undefined,
    entityRef,
    recipientHints:
      payload.recipientHints && typeof payload.recipientHints === "object"
        ? (payload.recipientHints as NotificationIntent["recipientHints"])
        : undefined,
    payload:
      payload.payload && typeof payload.payload === "object"
        ? (payload.payload as Record<string, unknown>)
        : (omitKeys(payload, [
            "eventType",
            "notificationEventType",
            "actorId",
            "entityRef",
            "recipientHints",
            "orgId",
          ]) as Record<string, unknown>),
  };
}

function omitKeys(
  obj: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** Writes `notification.dispatch` intents onto the outbox. */
export class OutboxEnqueueNotificationIntent
  implements EnqueueNotificationIntent
{
  constructor(
    private readonly enqueueOutbox: (event: {
      orgId: string;
      eventType: "notification.dispatch";
      aggregateType: string;
      aggregateId: string;
      payload: Record<string, unknown>;
    }) => Promise<void>,
  ) {}

  async enqueue(intent: NotificationIntent): Promise<void> {
    const aggregateType = intent.entityRef?.type ?? "notification";
    const aggregateId =
      intent.entityRef?.id ??
      intent.recipientHints?.userId ??
      intent.actorId ??
      "00000000-0000-4000-8000-000000000000";

    await this.enqueueOutbox({
      orgId: intent.orgId,
      eventType: "notification.dispatch",
      aggregateType,
      aggregateId,
      payload: {
        eventType: intent.eventType,
        actorId: intent.actorId,
        entityRef: intent.entityRef,
        recipientHints: intent.recipientHints,
        payload: intent.payload ?? {},
      },
    });
  }
}

export type { NotificationEventType };
