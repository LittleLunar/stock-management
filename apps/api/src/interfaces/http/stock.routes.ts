import type { FastifyPluginAsync } from "fastify";
import type {
  CostInquiryUseCases,
  StockInquiryUseCases,
} from "@stock-management/application";
import {
  CostLayersQuerySchema,
  StockBalancesQuerySchema,
  StockMovementsQuerySchema,
  StockTrackingQuerySchema,
} from "@stock-management/shared";

export function stockRoutes(
  useCases: StockInquiryUseCases,
  costInquiry: CostInquiryUseCases,
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

    app.get("/stock/cost-layers", async (request) => {
      const query = CostLayersQuerySchema.parse(request.query);
      const layers = await costInquiry.listCostLayers(request.ctx.orgId, query);
      return layers.map((layer) => ({
        id: layer.id,
        productId: layer.productId,
        locationId: layer.locationId,
        lotId: layer.lotId,
        receivedAt: layer.receivedAt.toISOString(),
        unitCost: layer.unitCost,
        qtyOriginal: layer.qtyOriginal,
        qtyRemaining: layer.qtyRemaining,
        sourceDocumentType: layer.sourceDocumentType,
        sourceDocumentId: layer.sourceDocumentId,
      }));
    });
  };
}
