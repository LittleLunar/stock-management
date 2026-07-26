import type { CostLayer } from "@stock-management/domain";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export class CostInquiryUseCases {
  constructor(private readonly uow: UnitOfWork) {}

  listCostLayers(
    orgId: string,
    filter: { productId?: string; locationId?: string } = {},
  ): Promise<CostLayer[]> {
    return this.uow.run((ctx) => ctx.costing.listOpenLayers(orgId, filter));
  }
}
