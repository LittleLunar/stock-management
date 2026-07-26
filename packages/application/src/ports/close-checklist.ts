export type CloseChecklistWarningCode =
  | "UNPOSTED_INVENTORY_DOCS"
  | "OUTBOX_PENDING_OR_FAILED"
  | "UNMATCHED_GRNI"
  | "DRAFT_SUPPLIER_INVOICES";

export type CloseChecklistWarning = {
  code: CloseChecklistWarningCode;
  message: string;
  count?: number;
  amount?: string;
  documentType?: string;
};

export type CloseChecklistReport = {
  periodId: string;
  startsOn: string;
  endsOn: string;
  warnings: CloseChecklistWarning[];
  canCloseSuggested: boolean;
};

export interface CloseChecklistPort {
  countDraftInventoryDocsInRange(
    orgId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<Array<{ documentType: string; count: number }>>;

  countOutboxPendingOrFailed(orgId: string): Promise<{
    pending: number;
    failed: number;
  }>;

  sumUnmatchedPostedGrAmount(orgId: string): Promise<string>;

  countDraftSupplierInvoices(orgId: string): Promise<number>;
}
