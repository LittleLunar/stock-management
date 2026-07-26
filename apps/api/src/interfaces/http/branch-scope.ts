import {
  listFilterFromContext,
  type BranchListFilter,
} from "@stock-management/application";
import {
  assertBranchAccess,
  canPerform,
  ForbiddenError,
  type AccessAction,
} from "@stock-management/domain";
import type { RequestContext } from "../plugins/context.js";

export { listFilterFromContext };
export type { BranchListFilter };

/** Branch-scoped users always use ctx; HQ may use query or active branch. */
export function effectiveReportBranchId(
  ctx: RequestContext,
  queryBranchId?: string | null,
): string | undefined {
  if (ctx.branchIds.length > 0) {
    return ctx.activeBranchId ?? undefined;
  }
  return (ctx.activeBranchId ?? queryBranchId) ?? undefined;
}

export function assertCanPerform(
  ctx: Pick<RequestContext, "role">,
  action: AccessAction,
  deniedMessage: string,
): void {
  if (!canPerform(ctx.role, action)) {
    throw new ForbiddenError(deniedMessage);
  }
}

/**
 * Role gate + branch write lock.
 * When activeBranchId is set, body.branchId must equal it (HQ "act as branch" lock).
 * HQ consolidated (activeBranchId null, empty branchIds) may write any org branch.
 */
export function assertDocumentBranchWrite(
  ctx: RequestContext,
  action: AccessAction,
  branchId: string,
  deniedMessage: string,
): void {
  assertCanPerform(ctx, action, deniedMessage);
  if (ctx.activeBranchId != null && branchId !== ctx.activeBranchId) {
    throw new ForbiddenError("Cannot write outside active branch");
  }
  assertBranchAccess(
    { role: ctx.role, branchIds: ctx.branchIds },
    branchId,
  );
}

/** Optional branchId (e.g. supplier invoice): still require role; lock when present. */
export function assertOptionalDocumentBranchWrite(
  ctx: RequestContext,
  action: AccessAction,
  branchId: string | null | undefined,
  deniedMessage: string,
): void {
  assertCanPerform(ctx, action, deniedMessage);
  if (branchId == null || branchId === undefined) {
    if (ctx.activeBranchId != null) {
      throw new ForbiddenError("branchId required when active branch is set");
    }
    return;
  }
  if (ctx.activeBranchId != null && branchId !== ctx.activeBranchId) {
    throw new ForbiddenError("Cannot write outside active branch");
  }
  assertBranchAccess(
    { role: ctx.role, branchIds: ctx.branchIds },
    branchId,
  );
}

/** Branch-scoped users may read a transfer if they have from OR to branch. */
export function assertTransferBranchRead(
  ctx: Pick<RequestContext, "role" | "branchIds">,
  fromBranchId: string,
  toBranchId: string,
): void {
  if (ctx.branchIds.length === 0) return;
  if (
    !ctx.branchIds.includes(fromBranchId) &&
    !ctx.branchIds.includes(toBranchId)
  ) {
    throw new ForbiddenError();
  }
}
