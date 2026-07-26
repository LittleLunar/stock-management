import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  CustomerUseCases,
  type CreateCustomerInput,
  type CustomerRepository,
} from "@stock-management/application";
import type { Customer } from "@stock-management/domain";
import { customersRoutes } from "./customers.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-07-26T00:00:00.000Z");
const headers = { "x-org-id": ORG_ID, "x-user-id": USER_ID };

function createRepo(seed: Customer[] = []): CustomerRepository {
  const rows = [...seed];
  return {
    async list(orgId) {
      return rows.filter((row) => row.orgId === orgId);
    },
    async findById(orgId, id) {
      return rows.find((row) => row.orgId === orgId && row.id === id) ?? null;
    },
    async create(orgId, input: CreateCustomerInput) {
      const customer: Customer = {
        id: "00000000-0000-4000-8000-000000000099",
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
        createdAt: now,
        updatedAt: now,
      };
      rows.push(customer);
      return customer;
    },
  };
}

async function buildApp(repo: CustomerRepository) {
  const app = Fastify();
  registerErrorHandler(app);
  await app.register(requestIdPlugin);
  await app.register(createTestContextPlugin());
  await app.register(customersRoutes(new CustomerUseCases(repo)), {
    prefix: "/api/v1",
  });
  return app;
}

describe("customers routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  afterEach(async () => {
    await app.close();
  });

  it("lists customers for the org", async () => {
    app = await buildApp(
      createRepo([
        {
          id: "00000000-0000-4000-8000-000000000010",
          orgId: ORG_ID,
          code: "WALKIN",
          name: "Walk-in",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/customers",
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({ code: "WALKIN", name: "Walk-in" }),
    ]);
  });

  it("creates a customer", async () => {
    app = await buildApp(createRepo());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/customers",
      headers,
      payload: { code: "RETAIL", name: "Retail Customer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        code: "RETAIL",
        name: "Retail Customer",
        status: "active",
        orgId: ORG_ID,
      }),
    );
  });
});
