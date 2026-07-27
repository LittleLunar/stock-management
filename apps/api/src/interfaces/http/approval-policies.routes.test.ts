import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  ApprovalPolicyUseCases,
  type ApprovalPolicyPort,
} from "@stock-management/application";
import type {
  ApprovalDocumentType,
  ApprovalPolicy,
} from "@stock-management/domain";
import { approvalPoliciesRoutes } from "./approval-policies.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-07-26T00:00:00.000Z");

class InMemoryApprovalPolicyRepository implements ApprovalPolicyPort {
  private readonly rows = new Map<string, ApprovalPolicy>();

  private key(orgId: string, documentType: ApprovalDocumentType) {
    return `${orgId}:${documentType}`;
  }

  async list(orgId: string): Promise<ApprovalPolicy[]> {
    return [...this.rows.values()].filter((r) => r.orgId === orgId);
  }

  async findByDocumentType(
    orgId: string,
    documentType: ApprovalDocumentType,
  ): Promise<ApprovalPolicy | null> {
    return this.rows.get(this.key(orgId, documentType)) ?? null;
  }

  async upsert(
    orgId: string,
    documentType: ApprovalDocumentType,
    required: boolean,
  ): Promise<ApprovalPolicy> {
    const id = this.key(orgId, documentType);
    const existing = this.rows.get(id);
    const row: ApprovalPolicy = {
      id: existing?.id ?? `pol-${documentType}`,
      orgId,
      documentType,
      required,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(id, row);
    return row;
  }
}

describe("approval policies routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp() {
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(
      approvalPoliciesRoutes(
        new ApprovalPolicyUseCases(new InMemoryApprovalPolicyRepository()),
      ),
      { prefix: "/api/v1" },
    );
    return app;
  }

  it("lists default policies and upserts required flag", async () => {
    const app = await buildApp();
    const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/approval-policies",
      headers,
    });
    expect(list.statusCode).toBe(200);
    const policies = list.json<ApprovalPolicy[]>();
    expect(policies).toHaveLength(2);
    expect(policies.every((p) => p.required)).toBe(true);

    const upsert = await app.inject({
      method: "PUT",
      url: "/api/v1/approval-policies",
      headers,
      payload: { documentType: "purchase_order", required: false },
    });
    expect(upsert.statusCode).toBe(200);
    expect(upsert.json()).toMatchObject({
      documentType: "purchase_order",
      required: false,
    });
  });
});
