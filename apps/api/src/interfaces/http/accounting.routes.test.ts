import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeAccounting } from "@stock-management/application";
import {
  AccountUseCases,
  AccountingPeriodUseCases,
  EnsureDefaultChartOfAccounts,
  JournalUseCases,
} from "@stock-management/application";
import { accountingRoutes } from "./accounting.routes.js";
import { contextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

describe("accounting routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildAccountingApp() {
    const { port } = makeFakeAccounting();
    const ensureDefaultChartOfAccounts = new EnsureDefaultChartOfAccounts(port);
    const services = {
      ensureDefaultChartOfAccounts,
      accountingPeriods: new AccountingPeriodUseCases(port, async () => 1),
      accounts: new AccountUseCases(port),
      journals: new JournalUseCases(port),
    };
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    await app.register(accountingRoutes(services), { prefix: "/api/v1" });
    return app;
  }

  it("seeds defaults and generates periods", async () => {
    const app = await buildAccountingApp();
    const seed = await app.inject({
      method: "POST",
      url: "/api/v1/accounts/ensure-defaults",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(seed.statusCode).toBe(200);
    expect(seed.json().accounts).toHaveLength(7);

    const gen = await app.inject({
      method: "POST",
      url: "/api/v1/accounting-periods/generate",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
      payload: { fiscalYear: 2026 },
    });
    expect(gen.statusCode).toBe(200);
    expect(gen.json().created).toHaveLength(12);
  });
});
