import type { Membership } from "@stock-management/domain";

export interface MembershipAccessPort {
  /** Active membership for org+user, including branchIds (empty = HQ). */
  findActiveByUser(orgId: string, userId: string): Promise<Membership | null>;
}
