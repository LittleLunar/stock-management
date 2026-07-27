/** Server-computed filter — never take arbitrary widen from client. */
export type BranchListFilter =
  | { kind: "all" }
  | { kind: "branch"; branchId: string };

export function listFilterFromContext(ctx: {
  activeBranchId: string | null;
}): BranchListFilter {
  if (ctx.activeBranchId) {
    return { kind: "branch", branchId: ctx.activeBranchId };
  }
  return { kind: "all" };
}
