import { describe, expect, it, vi } from "vitest";
import type { AccountingPeriod } from "@stock-management/domain";
import type { AccountingPort } from "../ports/accounting.js";
import type { CloseChecklistPort } from "../ports/close-checklist.js";
import { PeriodCloseChecklistUseCase } from "./period-close-checklist.js";

function makeFakeAccounting(periods: AccountingPeriod[]): AccountingPort {
  return {
    async listAccounts() {
      throw new Error("not used");
    },
    async findAccountByCode() {
      throw new Error("not used");
    },
    async insertAccount() {
      throw new Error("not used");
    },
    async updateAccount() {
      throw new Error("not used");
    },
    async listMappings() {
      throw new Error("not used");
    },
    async findMapping() {
      throw new Error("not used");
    },
    async upsertMapping() {
      throw new Error("not used");
    },
    async listPeriods() {
      return periods;
    },
    async findPeriodByYearMonth() {
      throw new Error("not used");
    },
    async findPeriodCoveringDate() {
      throw new Error("not used");
    },
    async insertPeriod() {
      throw new Error("not used");
    },
    async setPeriodStatus(_orgId, id, status) {
      const period = periods.find((p) => p.id === id);
      if (!period) throw new Error("not found");
      return { ...period, status };
    },
    async findJournalByOutboxEventId() {
      throw new Error("not used");
    },
    async findJournalById() {
      throw new Error("not used");
    },
    async listJournalsBySourceDocument() {
      throw new Error("not used");
    },
    async insertJournal() {
      throw new Error("not used");
    },
    async sumLinesByAccount() {
      throw new Error("not used");
    },
  };
}

function makeFakeChecklist(input: {
  drafts?: Array<{ documentType: string; count: number }>;
  outbox?: { pending: number; failed: number };
  unmatchedGrni?: string;
  draftInvoices?: number;
}): CloseChecklistPort {
  return {
    async countDraftInventoryDocsInRange() {
      return input.drafts ?? [];
    },
    async countOutboxPendingOrFailed() {
      return input.outbox ?? { pending: 0, failed: 0 };
    },
    async sumUnmatchedPostedGrAmount() {
      return input.unmatchedGrni ?? "0.0000";
    },
    async countDraftSupplierInvoices() {
      return input.draftInvoices ?? 0;
    },
  };
}

const openPeriod: AccountingPeriod = {
  id: "p1",
  orgId: "org-1",
  year: 2026,
  month: 7,
  startsOn: "2026-07-01",
  endsOn: "2026-07-31",
  status: "open",
};

describe("PeriodCloseChecklistUseCase", () => {
  it("returns soft warnings and does not close the period", async () => {
    const accounting = makeFakeAccounting([openPeriod]);
    const checklist = makeFakeChecklist({
      drafts: [{ documentType: "goods_receipt", count: 2 }],
      outbox: { pending: 1, failed: 0 },
      unmatchedGrni: "15.0000",
      draftInvoices: 1,
    });
    const setStatus = vi.spyOn(accounting, "setPeriodStatus");
    const uc = new PeriodCloseChecklistUseCase(accounting, checklist);
    const report = await uc.execute("org-1", "p1");
    expect(report.canCloseSuggested).toBe(false);
    expect(report.warnings.map((w) => w.code)).toEqual([
      "UNPOSTED_INVENTORY_DOCS",
      "OUTBOX_PENDING_OR_FAILED",
      "UNMATCHED_GRNI",
      "DRAFT_SUPPLIER_INVOICES",
    ]);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("suggests close when clean", async () => {
    const accounting = makeFakeAccounting([openPeriod]);
    const emptyChecklist = makeFakeChecklist({});
    const uc = new PeriodCloseChecklistUseCase(accounting, emptyChecklist);
    const report = await uc.execute("org-1", "p1");
    expect(report.canCloseSuggested).toBe(true);
    expect(report.warnings).toEqual([]);
  });
});
