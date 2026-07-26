import type { FastifyPluginAsync } from "fastify";
import type {
  AccountUseCases,
  AccountingPeriodUseCases,
  EnsureDefaultChartOfAccounts,
  JournalUseCases,
  JournalWithLines,
  PeriodCloseChecklistUseCase,
} from "@stock-management/application";
import {
  AccountingPeriodIdParamsSchema,
  CreateAccountBodySchema,
  GeneratePeriodsBodySchema,
  JournalsQuerySchema,
  PatchAccountBodySchema,
  UpsertMappingBodySchema,
  UuidSchema,
} from "@stock-management/shared";
import { z } from "zod";

export type AccountingRouteUseCases = {
  ensureDefaultChartOfAccounts: EnsureDefaultChartOfAccounts;
  accountingPeriods: AccountingPeriodUseCases;
  accounts: AccountUseCases;
  journals: JournalUseCases;
  periodCloseChecklist: PeriodCloseChecklistUseCase;
};

function serializeJournal(journal: JournalWithLines) {
  return {
    id: journal.id,
    periodId: journal.periodId,
    branchId: journal.branchId,
    sourceDocumentType: journal.sourceDocumentType,
    sourceDocumentId: journal.sourceDocumentId,
    outboxEventId: journal.outboxEventId,
    reversesJournalId: journal.reversesJournalId,
    postedAt: journal.postedAt.toISOString(),
    lines: journal.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      lineNo: line.lineNo,
    })),
  };
}

export function accountingRoutes(
  useCases: AccountingRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/accounts/ensure-defaults", async (request) => {
      return useCases.ensureDefaultChartOfAccounts.execute(request.ctx.orgId);
    });

    app.get("/accounts", async (request) => {
      return useCases.accounts.list(request.ctx.orgId);
    });

    app.post("/accounts", async (request) => {
      const body = CreateAccountBodySchema.parse(request.body);
      return useCases.accounts.create(request.ctx.orgId, body);
    });

    app.patch("/accounts/:id", async (request) => {
      const { id } = z.object({ id: UuidSchema }).parse(request.params);
      const body = PatchAccountBodySchema.parse(request.body);
      return useCases.accounts.patch(request.ctx.orgId, id, body);
    });

    app.get("/account-mappings", async (request) => {
      return useCases.accounts.listMappings(request.ctx.orgId);
    });

    app.put("/account-mappings", async (request) => {
      const body = UpsertMappingBodySchema.parse(request.body);
      return useCases.accounts.upsertMapping(request.ctx.orgId, body);
    });

    app.get("/accounting-periods", async (request) => {
      return useCases.accountingPeriods.list(request.ctx.orgId);
    });

    app.post("/accounting-periods/generate", async (request) => {
      const body = GeneratePeriodsBodySchema.parse(request.body);
      return useCases.accountingPeriods.generate(
        request.ctx.orgId,
        body.fiscalYear,
      );
    });

    app.post("/accounting-periods/:id/open", async (request) => {
      const { id } = z.object({ id: UuidSchema }).parse(request.params);
      return useCases.accountingPeriods.open(request.ctx.orgId, id);
    });

    app.post("/accounting-periods/:id/close", async (request) => {
      const { id } = z.object({ id: UuidSchema }).parse(request.params);
      return useCases.accountingPeriods.close(request.ctx.orgId, id);
    });

    app.get("/accounting-periods/:id/close-checklist", async (request) => {
      const { id } = AccountingPeriodIdParamsSchema.parse(request.params);
      return useCases.periodCloseChecklist.execute(request.ctx.orgId, id);
    });

    app.get("/journals/:id", async (request) => {
      const { id } = z.object({ id: UuidSchema }).parse(request.params);
      const journal = await useCases.journals.getById(request.ctx.orgId, id);
      return serializeJournal(journal);
    });

    app.get("/journals", async (request) => {
      const query = JournalsQuerySchema.parse(request.query);
      const journals = await useCases.journals.listBySourceDocument(
        request.ctx.orgId,
        query.sourceDocumentType,
        query.sourceDocumentId,
      );
      return journals.map(serializeJournal);
    });
  };
}
