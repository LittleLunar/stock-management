import type { FastifyPluginAsync } from "fastify";
import type { ApprovalPolicyUseCases } from "@stock-management/application";
import { ForbiddenError } from "@stock-management/domain";
import { UpsertApprovalPolicySchema } from "@stock-management/shared";
import { assertCanPerform } from "./branch-scope.js";

export function approvalPoliciesRoutes(
  useCases: ApprovalPolicyUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/approval-policies", async (request) => {
      assertCanPerform(
        request.ctx,
        "document.approve",
        "Role cannot view approval policies",
      );
      return useCases.list(request.ctx.orgId);
    });

    app.put("/approval-policies", async (request) => {
      if (request.ctx.role !== "org_admin") {
        throw new ForbiddenError("Only org_admin can update approval policies");
      }
      const body = UpsertApprovalPolicySchema.parse(request.body);
      return useCases.upsert(
        request.ctx.orgId,
        body.documentType,
        body.required,
      );
    });
  };
}
