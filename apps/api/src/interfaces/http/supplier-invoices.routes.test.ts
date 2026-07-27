import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  ApAgingReportUseCase,
  SupplierInvoiceUseCases,
} from "@stock-management/application";
import { makeThreeWayDodHarness } from "../../../../../packages/application/src/use-cases/supplier-invoice.harness.js";
import {
  apReportsRoutes,
  supplierInvoicesRoutes,
} from "./supplier-invoices.routes.js";
import { createTestContextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "org-1";
const USER_ID = "user-1";

describe("supplier invoice routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp() {
    const harness = makeThreeWayDodHarness();
    const services = {
      supplierInvoices: new SupplierInvoiceUseCases(harness.ap),
      postSupplierInvoice: harness.post,
      voidSupplierInvoice: harness.voidInvoice,
    };
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(supplierInvoicesRoutes(services), {
      prefix: "/api/v1",
    });
    return { app, harness };
  }

  it("POST /supplier-invoices/:id/post returns posted invoice", async () => {
    const { app, harness } = await buildApp();
    const draftId = await harness.seedDraft({
      qty: "2",
      unitCost: "10",
      amount: "20",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/supplier-invoices/${draftId}/post`,
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().invoice.status).toBe("posted");
  });
});

describe("ap aging routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp() {
    const harness = makeThreeWayDodHarness();
    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(createTestContextPlugin());
    await app.register(apReportsRoutes(new ApAgingReportUseCase(harness.ap)), {
      prefix: "/api/v1",
    });
    return { app, harness };
  }

  it("GET /reports/ap-aging returns aging report", async () => {
    const { app, harness } = await buildApp();
    const draftId = await harness.seedDraft({
      qty: "4",
      unitCost: "10",
      amount: "40",
      invoiceDate: "2026-01-01",
    });
    await harness.post.execute(ORG_ID, USER_ID, draftId);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/ap-aging?asOf=2026-07-15",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().grandTotal).toBe("40");
  });
});
