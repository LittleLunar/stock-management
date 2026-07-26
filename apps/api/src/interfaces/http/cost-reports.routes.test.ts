import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  CogsReportUseCases,
  LandedCostUseCases,
  ValuationReportUseCases,
  createFakeCosting,
  type LandedCostDocument,
  type LandedCostPort,
} from "@stock-management/application";
import type { Location } from "@stock-management/domain";
import { costReportsRoutes } from "./cost-reports.routes.js";
import { landedCostsRoutes } from "./landed-costs.routes.js";
import { contextPlugin } from "../plugins/context.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestIdPlugin } from "../plugins/request-id.js";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const BRANCH_ID = "00000000-0000-4000-8000-000000000003";

describe("cost reports and landed cost routes", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("lists valuation and creates landed cost draft", async () => {
    const costing = createFakeCosting();
    const locations = {
      async findById(): Promise<Location | null> {
        return null;
      },
    };
    const docs = new Map<string, LandedCostDocument>();
    const landedRepo: LandedCostPort = {
      async list(orgId) {
        return [...docs.values()].filter((d) => d.orgId === orgId);
      },
      async findById(orgId, id) {
        const doc = docs.get(id);
        return doc?.orgId === orgId ? doc : null;
      },
      async create(orgId, input) {
        const id = "lc-1";
        const now = new Date();
        const doc: LandedCostDocument = {
          id,
          orgId,
          branchId: input.branchId,
          supplierId: input.supplierId ?? null,
          costType: input.costType,
          totalAmount: input.totalAmount,
          status: "draft",
          createdAt: now,
          updatedAt: now,
          postedAt: null,
          voidedAt: null,
          lines: input.lines.map((line, i) => ({
            id: `l-${i}`,
            orgId,
            landedCostDocumentId: id,
            lineNumber: i + 1,
            goodsReceiptLineId: line.goodsReceiptLineId ?? null,
            costLayerId: line.costLayerId ?? null,
            amount: line.amount,
          })),
        };
        docs.set(id, doc);
        return doc;
      },
      async update() {
        throw new Error("unused");
      },
      async updateStatus() {
        throw new Error("unused");
      },
    };

    const app = Fastify();
    apps.push(app);
    registerErrorHandler(app);
    await app.register(requestIdPlugin);
    await app.register(contextPlugin);
    await app.register(
      costReportsRoutes({
        valuationReport: new ValuationReportUseCases(costing, locations),
        cogsReport: new CogsReportUseCases({
          async listOutboundMovements() {
            return [];
          },
        }),
        costing,
      }),
      { prefix: "/api/v1" },
    );
    await app.register(
      landedCostsRoutes({
        landedCosts: new LandedCostUseCases(landedRepo),
        postLandedCost: { execute: async () => ({ document: docs.get("lc-1")! }) } as never,
        voidLandedCost: { execute: async () => ({ document: docs.get("lc-1")! }) } as never,
      }),
      { prefix: "/api/v1" },
    );

    const valuation = await app.inject({
      method: "GET",
      url: "/api/v1/cost-reports/valuation",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
    });
    expect(valuation.statusCode).toBe(200);
    expect(valuation.json()).toEqual({ rows: [], totalValue: "0" });

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/landed-costs",
      headers: { "x-org-id": ORG_ID, "x-user-id": USER_ID },
      payload: {
        branchId: BRANCH_ID,
        costType: "freight",
        totalAmount: "10",
        lines: [
          {
            costLayerId: "00000000-0000-4000-8000-000000000099",
            amount: "10",
          },
        ],
      },
    });
    expect(create.statusCode).toBe(200);
    expect(create.json<{ status: string }>().status).toBe("draft");
  });
});
