import type {
  WebhookDelivery,
  WebhookSubscription,
} from "@stock-management/domain";

export type CreateWebhookSubscriptionInput = {
  url: string;
  secret: string;
  eventTypes: string[];
  branchId?: string | null;
  active?: boolean;
};

export type UpdateWebhookSubscriptionInput = Partial<{
  url: string;
  secret: string;
  eventTypes: string[];
  branchId: string | null;
  active: boolean;
}>;

export type HttpPoster = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ status: number; bodyText: string }>;

export interface WebhookPort {
  listSubscriptions(orgId: string): Promise<WebhookSubscription[]>;
  findSubscription(
    orgId: string,
    id: string,
  ): Promise<WebhookSubscription | null>;
  listActiveSubscriptions(orgId: string): Promise<WebhookSubscription[]>;
  createSubscription(
    orgId: string,
    input: CreateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription>;
  updateSubscription(
    orgId: string,
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription | null>;
  findDeliveryBySubscriptionAndEvent(
    orgId: string,
    subscriptionId: string,
    outboxEventId: string,
  ): Promise<WebhookDelivery | null>;
  insertDelivery(input: {
    orgId: string;
    subscriptionId: string;
    outboxEventId: string;
    status: WebhookDelivery["status"];
    httpStatus: number | null;
    error: string | null;
  }): Promise<WebhookDelivery>;
  updateDelivery(
    orgId: string,
    id: string,
    patch: {
      status: WebhookDelivery["status"];
      httpStatus: number | null;
      error: string | null;
    },
  ): Promise<WebhookDelivery>;
  listDeliveries(
    orgId: string,
    filters?: { subscriptionId?: string },
  ): Promise<WebhookDelivery[]>;
}
