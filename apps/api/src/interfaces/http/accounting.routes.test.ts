import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeAccounting } from "@stock-management/application";
import {
  AccountUseCases,
  AccountingPeriodUseCases,
  EnsureDefaultChartOfAccounts,
  JournalUseCases,
  PeriodCloseChecklistUseCase,
  type CloseChecklistPort,
} from "@stock-management/application";
import { CloseChecklistResponseSchema } from "@stock-management/shared";
import { accountingRoutes } from "./accounting.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

describe("accounting routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildAccountingApp(checklist?: CloseChecklistPort) {
    const { port } = makeFakeAccounting();
    const ensureDefaultChartOfAccounts = new EnsureDefaultChartOfAccounts(port);
    const services = {
      ensureDefaultChartOfAccounts,
      accountingPeriods: new AccountingPeriodUseCases(port, async () => 1),
      accounts: new AccountUseCases(port),
      journals: new JournalUseCases(port),
      periodCloseChecklist: new PeriodCloseChecklistUseCase(
        port,
        checklist ?? {
          async countDraftInventoryDocsInRange() {
            return [];
          },
          async countOutboxPendingOrFailed() {
            return { pending: 0, failed: 0 };
          },
          async sumUnmatchedPostedGrAmount() {
            return "0.0000";
          },
          async countDraftSupplierInvoices() {
            return 0;
          },
        },
      ),
    };
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
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

  it("GET /accounting-periods/:id/close-checklist returns warnings shape", async () => {
    const app = await buildAccountingApp();
    await app.inject({
      method: "POST",
      url: "/api/v1/accounting-periods/generate",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
      payload: { fiscalYear: 2026 },
    });
    const periods = (
      await app.inject({
        method: "GET",
        url: "/api/v1/accounting-periods",
        headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
      })
    ).json();
    const periodId = periods[0].id;

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/accounting-periods/${periodId}/close-checklist`,
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = CloseChecklistResponseSchema.parse(res.json());
    expect(body).toMatchObject({
      periodId,
      warnings: expect.any(Array),
      canCloseSuggested: expect.any(Boolean),
    });
  });
});
