import type { LotPort, SerialPort, StockPort } from "../ports/inventory.js";

export class StockInquiryUseCases {
  constructor(
    private readonly stock: StockPort,
    private readonly lots: LotPort,
    private readonly serials: SerialPort,
  ) {}

  balances(
    orgId: string,
    filters?: { productId?: string; locationId?: string; lowStock?: boolean },
  ) {
    return this.stock.listBalances(orgId, filters);
  }

  movements(
    orgId: string,
    filters?: { productId?: string; locationId?: string },
  ) {
    return this.stock.listMovements(orgId, filters);
  }

  listLots(orgId: string, filters?: { productId?: string }) {
    return this.lots.list(orgId, filters);
  }

  listSerials(orgId: string, filters?: { productId?: string }) {
    return this.serials.list(orgId, filters);
  }
}
