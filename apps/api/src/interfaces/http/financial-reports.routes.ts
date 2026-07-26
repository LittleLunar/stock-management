import type { FastifyPluginAsync } from "fastify";
import type {
  BalanceSheetUseCase,
  PnlReportUseCase,
  TrialBalanceUseCase,
} from "@stock-management/application";
import {
  BalanceSheetQuerySchema,
  PnlQuerySchema,
  TrialBalanceQuerySchema,
} from "@stock-management/shared";

export type FinancialReportsRouteUseCases = {
  trialBalance: TrialBalanceUseCase;
  pnl: PnlReportUseCase;
  balanceSheet: BalanceSheetUseCase;
};

export function financialReportsRoutes(
  useCases: FinancialReportsRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/reports/trial-balance", async (request) => {
      const query = TrialBalanceQuerySchema.parse(request.query);
      if (query.periodId) {
        return useCases.trialBalance.execute(request.ctx.orgId, {
          periodId: query.periodId,
          branchId: query.branchId,
        });
      }
      return useCases.trialBalance.execute(request.ctx.orgId, {
        asOf: query.asOf!,
        branchId: query.branchId,
      });
    });

    app.get("/reports/pnl", async (request) => {
      const query = PnlQuerySchema.parse(request.query);
      return useCases.pnl.execute(request.ctx.orgId, {
        periodId: query.periodId,
        branchId: query.branchId,
      });
    });

    app.get("/reports/balance-sheet", async (request) => {
      const query = BalanceSheetQuerySchema.parse(request.query);
      return useCases.balanceSheet.execute(request.ctx.orgId, {
        asOf: query.asOf,
        branchId: query.branchId,
      });
    });
  };
}
