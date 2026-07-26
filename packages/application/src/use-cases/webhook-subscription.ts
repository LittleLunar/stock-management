import { NotFoundError } from "@stock-management/domain";
import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookPort,
} from "../ports/webhook.js";

export class WebhookSubscriptionUseCases {
  constructor(private readonly repo: WebhookPort) {}

  list(orgId: string) {
    return this.repo.listSubscriptions(orgId);
  }

  async get(orgId: string, id: string) {
    const row = await this.repo.findSubscription(orgId, id);
    if (!row) throw new NotFoundError("Webhook subscription");
    return row;
  }

  create(orgId: string, input: CreateWebhookSubscriptionInput) {
    return this.repo.createSubscription(orgId, {
      ...input,
      active: input.active ?? true,
      branchId: input.branchId ?? null,
    });
  }

  async update(orgId: string, id: string, input: UpdateWebhookSubscriptionInput) {
    const row = await this.repo.updateSubscription(orgId, id, input);
    if (!row) throw new NotFoundError("Webhook subscription");
    return row;
  }

  listDeliveries(orgId: string, subscriptionId?: string) {
    return this.repo.listDeliveries(orgId, { subscriptionId });
  }
}
