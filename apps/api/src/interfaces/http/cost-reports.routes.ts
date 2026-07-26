import type { FastifyPluginAsync } from "fastify";
import type {
  CogsReportUseCases,
  CostingPort,
  ValuationReportUseCases,
} from "@stock-management/application";
import {
  CogsQuerySchema,
  CostSummariesQuerySchema,
  ValuationQuerySchema,
} from "@stock-management/shared";

export type CostReportRouteUseCases = {
  valuationReport: ValuationReportUseCases;
  cogsReport: CogsReportUseCases;
  costing: CostingPort;
};

export function costReportsRoutes(
  useCases: CostReportRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/cost-reports/valuation", async (request) => {
      const query = ValuationQuerySchema.parse(request.query);
      return useCases.valuationReport.listValuation(request.ctx.orgId, query);
    });

    app.get("/cost-reports/cogs", async (request) => {
      const query = CogsQuerySchema.parse(request.query);
      return useCases.cogsReport.listCogs(request.ctx.orgId, query);
    });

    app.get("/stock/cost-summaries", async (request) => {
      const query = CostSummariesQuerySchema.parse(request.query);
      return useCases.costing.listProductCostSummaries(request.ctx.orgId, query);
    });
  };
}
