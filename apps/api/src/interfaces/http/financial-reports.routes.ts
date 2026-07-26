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
import {
  assertCanPerform,
  effectiveReportBranchId,
} from "./branch-scope.js";

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
      assertCanPerform(
        request.ctx,
        "accounting.read",
        "Role cannot read accounting reports",
      );
      const query = TrialBalanceQuerySchema.parse(request.query);
      const branchId = effectiveReportBranchId(request.ctx, query.branchId);
      if (query.periodId) {
        return useCases.trialBalance.execute(request.ctx.orgId, {
          periodId: query.periodId,
          branchId,
        });
      }
      return useCases.trialBalance.execute(request.ctx.orgId, {
        asOf: query.asOf!,
        branchId,
      });
    });

    app.get("/reports/pnl", async (request) => {
      assertCanPerform(
        request.ctx,
        "accounting.read",
        "Role cannot read accounting reports",
      );
      const query = PnlQuerySchema.parse(request.query);
      return useCases.pnl.execute(request.ctx.orgId, {
        periodId: query.periodId,
        branchId: effectiveReportBranchId(request.ctx, query.branchId),
      });
    });

    app.get("/reports/balance-sheet", async (request) => {
      assertCanPerform(
        request.ctx,
        "accounting.read",
        "Role cannot read accounting reports",
      );
      const query = BalanceSheetQuerySchema.parse(request.query);
      return useCases.balanceSheet.execute(request.ctx.orgId, {
        asOf: query.asOf,
        branchId: effectiveReportBranchId(request.ctx, query.branchId),
      });
    });
  };
}
