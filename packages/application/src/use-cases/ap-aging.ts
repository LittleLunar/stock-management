import { buildApAgingReport } from "@stock-management/domain";
import type { ApAgingReport } from "@stock-management/domain";
import type { ApPort } from "../ports/ap.js";

export class ApAgingReportUseCase {
  constructor(private readonly ap: ApPort) {}

  async execute(orgId: string, asOf: string): Promise<ApAgingReport> {
    const rows = await this.ap.sumOpenBalancesByPostedInvoice(orgId);
    return buildApAgingReport(
      rows.map(({ invoice, openBalance }) => ({
        id: invoice.id,
        supplierId: invoice.supplierId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        openBalance,
      })),
      asOf,
    );
  }
}
