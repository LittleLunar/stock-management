import type { CostLayerKey, CostingPort } from "../ports/costing.js";

export async function refreshCostSummary(
  costing: CostingPort,
  key: CostLayerKey,
): Promise<void> {
  await costing.recomputeProductCostSummary(key);
}
