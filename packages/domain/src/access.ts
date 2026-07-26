import type { Membership } from "./entities.js";
import { ForbiddenError } from "./errors.js";
import type { MembershipRole } from "./types.js";

export type AccessAction =
  | "masters.write"
  | "inventory.post"
  | "po.write"
  | "accounting.read"
  | "document.approve";

export type MembershipAccess = Pick<Membership, "role" | "branchIds">;

const ROLE_ACTIONS: Record<MembershipRole, ReadonlySet<AccessAction>> = {
  org_admin: new Set([
    "masters.write",
    "inventory.post",
    "po.write",
    "accounting.read",
    "document.approve",
  ]),
  branch_manager: new Set([
    "masters.write",
    "inventory.post",
    "po.write",
    "accounting.read",
    "document.approve",
  ]),
  warehouse: new Set(["inventory.post"]),
  purchasing: new Set(["po.write"]),
  accountant: new Set(["accounting.read"]),
};

/** HQ = empty branchIds. Throws ForbiddenError if branch not granted. */
export function assertBranchAccess(
  membership: MembershipAccess,
  branchId: string,
): void {
  if (membership.branchIds.length === 0) {
    return;
  }
  if (!membership.branchIds.includes(branchId)) {
    throw new ForbiddenError();
  }
}

/**
 * Branch user (branchIds.length > 0):
 *   header set → must be in branchIds; omitted → branchIds[0]
 * HQ (branchIds.length === 0):
 *   header set → that id (no grant check beyond org); omitted → null (consolidated)
 * Throws ForbiddenError when branch user header not in grants.
 */
export function resolveActiveBranch(
  membership: MembershipAccess,
  headerBranchId: string | null | undefined,
): string | null {
  const isHq = membership.branchIds.length === 0;
  if (isHq) {
    return headerBranchId ?? null;
  }
  if (headerBranchId == null) {
    return membership.branchIds[0]!;
  }
  assertBranchAccess(membership, headerBranchId);
  return headerBranchId;
}

export function canPerform(
  role: MembershipRole,
  action: AccessAction,
): boolean {
  return ROLE_ACTIONS[role].has(action);
}
