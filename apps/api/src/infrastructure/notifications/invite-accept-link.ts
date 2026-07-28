import type { OpaqueTokenService } from "@stock-management/application";
import type { InviteAcceptLinkResolver } from "@stock-management/application";
import type { MembershipInviteStore } from "@stock-management/application";

/**
 * Issues a fresh opaque invite token at email-send time so raw tokens never
 * persist on the outbox. Invalidates the previous hash (create response token
 * may no longer work after the email is dispatched — email is canonical).
 */
export class RotatingInviteAcceptLinkResolver
  implements InviteAcceptLinkResolver
{
  constructor(
    private readonly invites: MembershipInviteStore,
    private readonly opaqueTokens: OpaqueTokenService,
    private readonly appPublicUrl: string,
  ) {}

  async buildAcceptUrl(inviteId: string): Promise<string | null> {
    const raw = this.opaqueTokens.issue();
    const updated = await this.invites.rotateTokenHash(
      inviteId,
      this.opaqueTokens.hash(raw),
    );
    if (!updated) return null;
    return `${this.appPublicUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(raw)}`;
  }
}
