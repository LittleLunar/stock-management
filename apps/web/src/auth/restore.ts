import type { AuthMeResponse } from "@stock-management/shared";
import { authApi } from "./api";
import { ensureAccessToken } from "./refresh";
import {
  clearOrgContext,
  clearSession,
  getOrgId,
  setOrgContext,
} from "./session";

/** Pick active org from /me memberships (keep current if still valid). */
export function applyMembershipOrgContext(me: AuthMeResponse): void {
  const memberships = me.memberships;
  if (memberships.length === 0) {
    clearOrgContext();
    return;
  }
  const current = getOrgId();
  const match = memberships.find((m) => m.orgId === current);
  const chosen = match ?? memberships[0]!;
  setOrgContext(chosen.orgId, chosen.orgName);
}

export async function applyMeOrgContext(): Promise<AuthMeResponse> {
  const me = await authApi.me();
  applyMembershipOrgContext(me);
  return me;
}

/**
 * Ensure access token (refresh cookie if needed), then rehydrate org from /me.
 * Does not trust stale localStorage alone.
 */
export async function restoreSession(): Promise<boolean> {
  const ok = await ensureAccessToken();
  if (!ok) return false;
  try {
    await applyMeOrgContext();
    return true;
  } catch {
    clearSession();
    return false;
  }
}
