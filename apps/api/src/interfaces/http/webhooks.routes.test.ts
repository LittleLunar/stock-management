import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  Membership,
  MembershipRole,
  WebhookDelivery,
  WebhookSubscription,
} from "@stock-management/domain";
import {
  WebhookSubscriptionUseCases,
  type CreateWebhookSubscriptionInput,
  type MembershipAccessPort,
  type UpdateWebhookSubscriptionInput,
  type WebhookPort,
} from "@stock-management/application";
import { createContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";
import { webhooksRoutes } from "./webhooks.routes.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_USER = "00000000-0000-4000-8000-0000000000a1";
const WAREHOUSE_USER = "00000000-0000-4000-8000-0000000000w1";
const OUTBOX_EVENT_ID = "00000000-0000-4000-8000-0000000000e1";
const now = new Date("2026-07-26T12:00:00.000Z");

function membership(userId: string, role: MembershipRole): Membership {
  return {
    id: `m-${userId}`,
    orgId: ORG_ID,
    userId,
    role,
    status: "active",
    branchIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createMemWebhookPort(): WebhookPort {
  const subs = new Map<string, WebhookSubscription>();
  const deliveries: WebhookDelivery[] = [];
  let seq = 0;
  return {
    async listSubscriptions(orgId) {
      return [...subs.values()].filter((s) => s.orgId === orgId);
    },
    async findSubscription(orgId, id) {
      const row = subs.get(id);
      return row?.orgId === orgId ? row : null;
    },
    async listActiveSubscriptions(orgId) {
      return [...subs.values()].filter((s) => s.orgId === orgId && s.active);
    },
    async createSubscription(orgId, input: CreateWebhookSubscriptionInput) {
      seq += 1;
      const row: WebhookSubscription = {
        id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
        orgId,
        url: input.url,
        secret: input.secret,
        eventTypes: input.eventTypes,
        branchId: input.branchId ?? null,
        active: input.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      subs.set(row.id, row);
      return row;
    },
    async updateSubscription(
      orgId,
      id,
      input: UpdateWebhookSubscriptionInput,
    ) {
      const row = subs.get(id);
      if (!row || row.orgId !== orgId) return null;
      Object.assign(row, input, { updatedAt: now });
      return row;
    },
    async findDeliveryBySubscriptionAndEvent(
      orgId,
      subscriptionId,
      outboxEventId,
    ) {
      return (
        deliveries.find(
          (d) =>
            d.orgId === orgId &&
            d.subscriptionId === subscriptionId &&
            d.outboxEventId === outboxEventId,
        ) ?? null
      );
    },
    async insertDelivery(input) {
      const row: WebhookDelivery = {
        id: `00000000-0000-4000-8000-${String(deliveries.length + 100).padStart(12, "0")}`,
        orgId: input.orgId,
        subscriptionId: input.subscriptionId,
        outboxEventId: input.outboxEventId,
        status: input.status,
        httpStatus: input.httpStatus,
        error: input.error,
        createdAt: now,
        updatedAt: now,
      };
      deliveries.push(row);
      return row;
    },
    async updateDelivery(orgId, id, patch) {
      const row = deliveries.find((d) => d.orgId === orgId && d.id === id)!;
      Object.assign(row, patch, { updatedAt: now });
      return row;
    },
    async listDeliveries(orgId, filters) {
      return deliveries.filter(
        (d) =>
          d.orgId === orgId &&
          (filters?.subscriptionId
            ? d.subscriptionId === filters.subscriptionId
            : true),
      );
    },
  };
}

function createMembershipAccess(): MembershipAccessPort {
  const byUser = new Map<string, Membership>([
    [ADMIN_USER, membership(ADMIN_USER, "org_admin")],
    [WAREHOUSE_USER, membership(WAREHOUSE_USER, "warehouse")],
  ]);
  return {
    async findActiveByUser(orgId, userId) {
      const row = byUser.get(userId);
      return row?.orgId === orgId ? row : null;
    },
  };
}

describe("webhooks routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp(port = createMemWebhookPort()) {
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createContextPlugin(createMembershipAccess()));
    const useCases = new WebhookSubscriptionUseCases(port);
    await app.register(webhooksRoutes(useCases), { prefix: "/api/v1" });
    return { app, port };
  }

  const createBody = {
    url: "https://hooks.example/inventory",
    secret: "12345678",
    eventTypes: ["document.posted"],
    active: true,
  };

  it("returns 403 for warehouse on POST and GET /webhook-subscriptions", async () => {
    const { app } = await buildApp();
    const headers = {
      "x-org-id": ORG_ID,
      "x-user-id": WAREHOUSE_USER,
    };

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/webhook-subscriptions",
      headers,
      payload: createBody,
    });
    expect(createRes.statusCode).toBe(403);
    expect(createRes.json()).toMatchObject({ error: { code: "FORBIDDEN" } });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/webhook-subscriptions",
      headers,
    });
    expect(listRes.statusCode).toBe(403);
    expect(listRes.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("creates subscription as org_admin with 201", async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhook-subscriptions",
      headers: { "x-org-id": ORG_ID, "x-user-id": ADMIN_USER },
      payload: createBody,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      orgId: ORG_ID,
      url: createBody.url,
      secret: createBody.secret,
      eventTypes: ["document.posted"],
      branchId: null,
      active: true,
    });
    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("lists subscriptions and gets by id for org_admin", async () => {
    const { app } = await buildApp();
    const headers = { "x-org-id": ORG_ID, "x-user-id": ADMIN_USER };

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/webhook-subscriptions",
      headers,
      payload: createBody,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/webhook-subscriptions",
      headers,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].id).toBe(id);

    const get = await app.inject({
      method: "GET",
      url: `/api/v1/webhook-subscriptions/${id}`,
      headers,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({
      id,
      url: createBody.url,
      eventTypes: ["document.posted"],
    });
  });

  it("lists webhook deliveries for org_admin", async () => {
    const port = createMemWebhookPort();
    const { app } = await buildApp(port);
    const headers = { "x-org-id": ORG_ID, "x-user-id": ADMIN_USER };

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/webhook-subscriptions",
      headers,
      payload: createBody,
    });
    const subscriptionId = created.json().id as string;

    await port.insertDelivery({
      orgId: ORG_ID,
      subscriptionId,
      outboxEventId: OUTBOX_EVENT_ID,
      status: "succeeded",
      httpStatus: 200,
      error: null,
    });

    const all = await app.inject({
      method: "GET",
      url: "/api/v1/webhook-deliveries",
      headers,
    });
    expect(all.statusCode).toBe(200);
    expect(all.json()).toHaveLength(1);
    expect(all.json()[0]).toMatchObject({
      subscriptionId,
      outboxEventId: OUTBOX_EVENT_ID,
      status: "succeeded",
      httpStatus: 200,
    });

    const filtered = await app.inject({
      method: "GET",
      url: `/api/v1/webhook-deliveries?subscriptionId=${subscriptionId}`,
      headers,
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toHaveLength(1);

    const warehouse = await app.inject({
      method: "GET",
      url: "/api/v1/webhook-deliveries",
      headers: { "x-org-id": ORG_ID, "x-user-id": WAREHOUSE_USER },
    });
    expect(warehouse.statusCode).toBe(403);
  });
});
