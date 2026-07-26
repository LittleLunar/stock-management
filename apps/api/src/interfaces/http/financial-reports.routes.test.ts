import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  BalanceSheetUseCase,
  PnlReportUseCase,
  TrialBalanceUseCase,
} from "@stock-management/application";
import {
  BalanceSheetResponseSchema,
  PnlResponseSchema,
  TrialBalanceResponseSchema,
} from "@stock-management/shared";
import {
  ap,
  cogs,
  equity,
  inv,
  makeAccount,
  makeFakeAccountingWithLines,
} from "../../../../../packages/application/src/use-cases/report-test-fakes.js";
import { financialReportsRoutes } from "./financial-reports.routes.js";
import { contextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const PERIOD_ID = "00000000-0000-4000-8000-000000000010";

describe("financial reports routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp() {
    const accounting = makeFakeAccountingWithLines([
      {
        orgId: ORG_ID,
        periodId: PERIOD_ID,
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: inv,
        debit: "130",
        credit: "40",
      },
      {
        orgId: ORG_ID,
        periodId: PERIOD_ID,
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: ap,
        debit: "0",
        credit: "50",
      },
      {
        orgId: ORG_ID,
        periodId: PERIOD_ID,
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: makeAccount(
          "00000000-0000-4000-8000-000000000105",
          "2100",
          "GRNI",
          "liability",
        ),
        debit: "50",
        credit: "100",
      },
      {
        orgId: ORG_ID,
        periodId: PERIOD_ID,
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: equity,
        debit: "0",
        credit: "30",
      },
      {
        orgId: ORG_ID,
        periodId: PERIOD_ID,
        postedAt: new Date("2026-07-10T12:00:00.000Z"),
        branchId: null,
        account: cogs,
        debit: "40",
        credit: "0",
      },
    ]);
    const services = {
      trialBalance: new TrialBalanceUseCase(accounting),
      pnl: new PnlReportUseCase(accounting),
      balanceSheet: new BalanceSheetUseCase(accounting),
    };
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    await app.register(financialReportsRoutes(services), { prefix: "/api/v1" });
    return app;
  }

  it("GET /reports/trial-balance?periodId= returns rows", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports/trial-balance?periodId=${PERIOD_ID}`,
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = TrialBalanceResponseSchema.parse(res.json());
    expect(body.totalDebit).toBeDefined();
  });

  it("GET /reports/trial-balance without periodId or asOf is 400", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/trial-balance",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /reports/pnl?periodId= returns netIncome", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports/pnl?periodId=${PERIOD_ID}`,
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = PnlResponseSchema.parse(res.json());
    expect(body.totalExpense).toBe("40.0000");
    expect(body.netIncome).toBe("-40.0000");
  });

  it("GET /reports/balance-sheet?asOf= folds netIncome and sets balanced", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/balance-sheet?asOf=2026-07-31",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = BalanceSheetResponseSchema.parse(res.json());
    expect(body.netIncome).toBe("-40.0000");
    expect(body.totalEquity).toBe("-10.0000");
    expect(body.balanced).toBe(true);
  });
});
