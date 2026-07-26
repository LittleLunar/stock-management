import type { FastifyPluginAsync } from "fastify";
import type { StockInquiryUseCases } from "@stock-management/application";
import {
  StockBalancesQuerySchema,
  StockMovementsQuerySchema,
  StockTrackingQuerySchema,
} from "@stock-management/shared";

export function stockRoutes(
  useCases: StockInquiryUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/stock/balances", async (request) => {
      const query = StockBalancesQuerySchema.parse(request.query);
      return useCases.balances(request.ctx.orgId, query);
    });

    app.get("/stock/movements", async (request) => {
      const query = StockMovementsQuerySchema.parse(request.query);
      return useCases.movements(request.ctx.orgId, query);
    });

    app.get("/stock/lots", async (request) => {
      const query = StockTrackingQuerySchema.parse(request.query);
      return useCases.listLots(request.ctx.orgId, query);
    });

    app.get("/stock/serials", async (request) => {
      const query = StockTrackingQuerySchema.parse(request.query);
      return useCases.listSerials(request.ctx.orgId, query);
    });
  };
}
