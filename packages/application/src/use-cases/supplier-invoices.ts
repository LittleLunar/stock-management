import {
  InvoiceNotDraftError,
  NotFoundError,
  assertLineAmount,
  ThreeWayMatchError,
} from "@stock-management/domain";
import type {
  ApPort,
  CreateSupplierInvoiceInput,
  SupplierInvoiceWithLines,
  UpdateSupplierInvoiceInput,
} from "../ports/ap.js";

export class SupplierInvoiceUseCases {
  constructor(private readonly ap: ApPort) {}

  list(orgId: string) {
    return this.ap.list(orgId);
  }

  async get(orgId: string, id: string): Promise<SupplierInvoiceWithLines> {
    const invoice = await this.ap.findById(orgId, id);
    if (!invoice) throw new NotFoundError("Supplier invoice");
    return invoice;
  }

  create(orgId: string, input: CreateSupplierInvoiceInput) {
    this.validateLines(input.lines);
    return this.ap.create(orgId, input);
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines> {
    const invoice = await this.get(orgId, id);
    if (invoice.status !== "draft") {
      throw new InvoiceNotDraftError("Only draft supplier invoices can be updated");
    }
    if (input.lines) this.validateLines(input.lines);
    return this.ap.update(orgId, id, input);
  }

  private validateLines(lines: CreateSupplierInvoiceInput["lines"]): void {
    if (!lines.length) {
      throw new ThreeWayMatchError("Supplier invoice must have at least one line");
    }
    for (const line of lines) {
      if (!line.purchaseOrderLineId || !line.goodsReceiptLineId) {
        throw new ThreeWayMatchError(
          "Each invoice line requires purchaseOrderLineId and goodsReceiptLineId",
        );
      }
      assertLineAmount(line.qty, line.unitCost, line.amount);
    }
  }
}
