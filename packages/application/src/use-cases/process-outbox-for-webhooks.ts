import {
  subscriptionMatchesEvent,
  WebhookDeliveryError,
} from "@stock-management/domain";
import type { HttpPoster, WebhookPort } from "../ports/webhook.js";
import { webhookSignatureHeader } from "../webhooks/hmac.js";

export type OutboxWebhookEvent = {
  id: string;
  orgId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt?: Date;
};

export class ProcessOutboxForWebhooks {
  constructor(
    private readonly webhooks: WebhookPort,
    private readonly post: HttpPoster,
  ) {}

  /**
   * Match active subscriptions; deliver idempotently.
   * Throws WebhookDeliveryError if any matched delivery ends failed
   * (so poller markFailed / retry). Succeeded prior deliveries are skipped.
   */
  async execute(event: OutboxWebhookEvent): Promise<void> {
    const subs = await this.webhooks.listActiveSubscriptions(event.orgId);
    const matched = subs.filter((s) =>
      subscriptionMatchesEvent(s, event),
    );
    const failures: string[] = [];
    for (const sub of matched) {
      const existing =
        await this.webhooks.findDeliveryBySubscriptionAndEvent(
          event.orgId,
          sub.id,
          event.id,
        );
      if (existing?.status === "succeeded") continue;

      const envelope = {
        id: event.id,
        orgId: event.orgId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: (event.createdAt ?? new Date()).toISOString(),
      };
      const rawBody = JSON.stringify(envelope);
      const signature = webhookSignatureHeader(rawBody, sub.secret);

      const delivery =
        existing ??
        (await this.webhooks.insertDelivery({
          orgId: event.orgId,
          subscriptionId: sub.id,
          outboxEventId: event.id,
          status: "pending",
          httpStatus: null,
          error: null,
        }));

      try {
        const res = await this.post(sub.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-Webhook-Signature": signature,
          },
          body: rawBody,
        });
        if (res.status >= 200 && res.status < 300) {
          await this.webhooks.updateDelivery(event.orgId, delivery.id, {
            status: "succeeded",
            httpStatus: res.status,
            error: null,
          });
        } else {
          const err = `HTTP ${res.status}: ${res.bodyText.slice(0, 500)}`;
          await this.webhooks.updateDelivery(event.orgId, delivery.id, {
            status: "failed",
            httpStatus: res.status,
            error: err,
          });
          failures.push(`${sub.id}: ${err}`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await this.webhooks.updateDelivery(event.orgId, delivery.id, {
          status: "failed",
          httpStatus: null,
          error: message,
        });
        failures.push(`${sub.id}: ${message}`);
      }
    }
    if (failures.length > 0) {
      throw new WebhookDeliveryError(failures.join("; "));
    }
  }
}
