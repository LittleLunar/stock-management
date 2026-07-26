import type {
  InvoiceMatch,
  SupplierInvoice,
  SupplierInvoiceLine,
} from "@stock-management/domain";

export type SupplierInvoiceWithLines = SupplierInvoice & {
  lines: SupplierInvoiceLine[];
};

export type CreateSupplierInvoiceInput = {
  supplierId: string;
  branchId?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  externalSystem?: string | null;
  externalId?: string | null;
  lines: Array<{
    productId?: string | null;
    lineNumber: number;
    qty: string;
    unitCost: string;
    amount: string;
    purchaseOrderLineId: string;
    goodsReceiptLineId: string;
  }>;
};

export type UpdateSupplierInvoiceInput = Partial<
  Omit<CreateSupplierInvoiceInput, "lines">
> & {
  lines?: CreateSupplierInvoiceInput["lines"];
};

export interface ApPort {
  list(orgId: string): Promise<SupplierInvoice[]>;
  findById(orgId: string, id: string): Promise<SupplierInvoiceWithLines | null>;

  create(
    orgId: string,
    input: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines>;

  update(
    orgId: string,
    id: string,
    input: UpdateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithLines>;

  markPosted(
    orgId: string,
    id: string,
    postedAt: Date,
  ): Promise<SupplierInvoice>;

  markVoided(
    orgId: string,
    id: string,
    voidedAt: Date,
  ): Promise<SupplierInvoice>;

  insertMatches(
    orgId: string,
    matches: Array<Omit<InvoiceMatch, "id"> & { id?: string }>,
  ): Promise<InvoiceMatch[]>;

  listMatchesForPostedInvoicesByPoLine(
    orgId: string,
    purchaseOrderLineId: string,
  ): Promise<InvoiceMatch[]>;

  listMatchesForPostedInvoicesByGrLine(
    orgId: string,
    goodsReceiptLineId: string,
  ): Promise<InvoiceMatch[]>;

  sumOpenBalancesByPostedInvoice(
    orgId: string,
  ): Promise<
    Array<{
      invoice: SupplierInvoice;
      openBalance: string;
    }>
  >;
}
