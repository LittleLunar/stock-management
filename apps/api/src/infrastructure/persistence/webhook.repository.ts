import { and, eq } from "drizzle-orm";
import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookPort,
} from "@stock-management/application";
import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookSubscription,
} from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import {
  webhookDeliveries,
  webhookSubscriptions,
} from "../db/schema/index.js";

export class DrizzleWebhookRepository implements WebhookPort {
  constructor(private readonly db: DbClient) {}

  listSubscriptions(orgId: string): Promise<WebhookSubscription[]> {
    return this.db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.orgId, orgId))
      .then((rows) => rows.map(toSubscription));
  }

  findSubscription(
    orgId: string,
    id: string,
  ): Promise<WebhookSubscription | null> {
    return this.db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.orgId, orgId),
          eq(webhookSubscriptions.id, id),
        ),
      )
      .then((rows) => (rows[0] ? toSubscription(rows[0]) : null));
  }

  listActiveSubscriptions(orgId: string): Promise<WebhookSubscription[]> {
    return this.db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.orgId, orgId),
          eq(webhookSubscriptions.active, true),
        ),
      )
      .then((rows) => rows.map(toSubscription));
  }

  async createSubscription(
    orgId: string,
    input: CreateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription> {
    const [row] = await this.db
      .insert(webhookSubscriptions)
      .values({
        orgId,
        url: input.url,
        secret: input.secret,
        eventTypes: input.eventTypes,
        branchId: input.branchId ?? null,
        active: input.active ?? true,
      })
      .returning();
    return toSubscription(row);
  }

  async updateSubscription(
    orgId: string,
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription | null> {
    const patch: Partial<typeof webhookSubscriptions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.url !== undefined) patch.url = input.url;
    if (input.secret !== undefined) patch.secret = input.secret;
    if (input.eventTypes !== undefined) patch.eventTypes = input.eventTypes;
    if (input.branchId !== undefined) patch.branchId = input.branchId;
    if (input.active !== undefined) patch.active = input.active;

    const [row] = await this.db
      .update(webhookSubscriptions)
      .set(patch)
      .where(
        and(
          eq(webhookSubscriptions.orgId, orgId),
          eq(webhookSubscriptions.id, id),
        ),
      )
      .returning();
    return row ? toSubscription(row) : null;
  }

  findDeliveryBySubscriptionAndEvent(
    orgId: string,
    subscriptionId: string,
    outboxEventId: string,
  ): Promise<WebhookDelivery | null> {
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.orgId, orgId),
          eq(webhookDeliveries.subscriptionId, subscriptionId),
          eq(webhookDeliveries.outboxEventId, outboxEventId),
        ),
      )
      .then((rows) => (rows[0] ? toDelivery(rows[0]) : null));
  }

  async insertDelivery(input: {
    orgId: string;
    subscriptionId: string;
    outboxEventId: string;
    status: WebhookDelivery["status"];
    httpStatus: number | null;
    error: string | null;
  }): Promise<WebhookDelivery> {
    const [row] = await this.db
      .insert(webhookDeliveries)
      .values({
        orgId: input.orgId,
        subscriptionId: input.subscriptionId,
        outboxEventId: input.outboxEventId,
        status: input.status,
        httpStatus: input.httpStatus,
        error: input.error,
      })
      .returning();
    return toDelivery(row);
  }

  async updateDelivery(
    orgId: string,
    id: string,
    patch: {
      status: WebhookDelivery["status"];
      httpStatus: number | null;
      error: string | null;
    },
  ): Promise<WebhookDelivery> {
    const [row] = await this.db
      .update(webhookDeliveries)
      .set({
        status: patch.status,
        httpStatus: patch.httpStatus,
        error: patch.error,
        updatedAt: new Date(),
      })
      .where(
        and(eq(webhookDeliveries.orgId, orgId), eq(webhookDeliveries.id, id)),
      )
      .returning();
    if (!row) {
      throw new Error(`Webhook delivery not found: ${id}`);
    }
    return toDelivery(row);
  }

  listDeliveries(
    orgId: string,
    filters?: { subscriptionId?: string },
  ): Promise<WebhookDelivery[]> {
    const conditions = [eq(webhookDeliveries.orgId, orgId)];
    if (filters?.subscriptionId) {
      conditions.push(
        eq(webhookDeliveries.subscriptionId, filters.subscriptionId),
      );
    }
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(and(...conditions))
      .then((rows) => rows.map(toDelivery));
  }
}

function toSubscription(
  row: typeof webhookSubscriptions.$inferSelect,
): WebhookSubscription {
  return {
    id: row.id,
    orgId: row.orgId,
    url: row.url,
    secret: row.secret,
    eventTypes: row.eventTypes ?? [],
    branchId: row.branchId ?? null,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDelivery(
  row: typeof webhookDeliveries.$inferSelect,
): WebhookDelivery {
  return {
    id: row.id,
    orgId: row.orgId,
    subscriptionId: row.subscriptionId,
    outboxEventId: row.outboxEventId,
    status: row.status as WebhookDeliveryStatus,
    httpStatus: row.httpStatus ?? null,
    error: row.error ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
