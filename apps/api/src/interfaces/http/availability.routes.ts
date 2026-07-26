import type { FastifyPluginAsync } from "fastify";
import type { AvailabilityUseCases } from "@stock-management/application";
import {
  AvailabilityQuerySchema,
  AvailabilityResponseSchema,
} from "@stock-management/shared";

export function availabilityRoutes(
  useCases: AvailabilityUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/availability", async (request) => {
      const query = AvailabilityQuerySchema.parse(request.query);
      const result = await useCases.getByProductBranch(
        request.ctx.orgId,
        query.productId,
        query.branchId,
      );
      return AvailabilityResponseSchema.parse(result);
    });
  };
}
