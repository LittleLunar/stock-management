export type CogsFilter = {
  from: Date;
  to: Date;
  branchId?: string;
};

export type CogsSourceRow = {
  branchId: string;
  movementType: string;
  documentType: string;
  totalCost: string;
  createdAt: Date;
  documentStatus: string;
};

export type CogsRow = {
  branchId: string;
  movementType: string;
  documentType: string;
  totalCost: string;
};

export type CogsResult = {
  rows: CogsRow[];
  totalCogs: string;
};

export interface CogsMovementSource {
  listOutboundMovements(
    orgId: string,
    filter: CogsFilter,
  ): Promise<CogsSourceRow[]>;
}

const COGS_TYPES = new Set([
  "issue",
  "supplier_return",
  "adjustment",
  "count_variance",
]);

const TRANSFER_TYPES = new Set([
  "transfer_out",
  "transfer_in",
  "transfer_out_void",
  "transfer_in_void",
]);

export class CogsReportUseCases {
  constructor(private readonly source: CogsMovementSource) {}

  async listCogs(orgId: string, filter: CogsFilter): Promise<CogsResult> {
    const movements = await this.source.listOutboundMovements(orgId, filter);
    const aggregated = new Map<string, CogsRow>();
    let total = 0;

    for (const movement of movements) {
      if (movement.documentStatus !== "posted") continue;
      if (TRANSFER_TYPES.has(movement.movementType)) continue;
      if (!COGS_TYPES.has(movement.movementType)) continue;
      // Negative qty adjustments/counts are COGS; source should already be outbound
      const cost = Math.abs(Number(movement.totalCost));
      if (cost === 0) continue;
      if (filter.branchId && movement.branchId !== filter.branchId) continue;
      if (movement.createdAt < filter.from || movement.createdAt > filter.to) {
        continue;
      }

      const key = `${movement.branchId}|${movement.movementType}|${movement.documentType}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.totalCost = String(Number(existing.totalCost) + cost);
      } else {
        aggregated.set(key, {
          branchId: movement.branchId,
          movementType: movement.movementType,
          documentType: movement.documentType,
          totalCost: String(cost),
        });
      }
      total += cost;
    }

    return { rows: [...aggregated.values()], totalCogs: String(total) };
  }
}
