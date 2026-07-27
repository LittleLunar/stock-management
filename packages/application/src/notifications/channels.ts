import {
  isChannelEnabled,
  type NotificationEventType,
} from "@stock-management/domain";
import type {
  NotificationChannel,
  NotificationDeliveryContext,
  NotificationPreferenceRepository,
  NotificationRepository,
} from "../ports/notification.js";
import type { Mailer } from "../ports/auth.js";

/** Builds a one-time invite accept URL at email-send time (never stored on outbox). */
export interface InviteAcceptLinkResolver {
  buildAcceptUrl(inviteId: string): Promise<string | null>;
}

/** Innermost no-op channel — ends the decorator chain. */
export class BaseNotificationChannel implements NotificationChannel {
  async deliver(_ctx: NotificationDeliveryContext): Promise<void> {}
}

export class InAppChannelDecorator implements NotificationChannel {
  constructor(
    private readonly inner: NotificationChannel,
    private readonly notifications: NotificationRepository,
    private readonly preferences: NotificationPreferenceRepository,
  ) {}

  async deliver(ctx: NotificationDeliveryContext): Promise<void> {
    const next = { ...ctx };
    if (ctx.recipient.userId) {
      const pref = await this.preferences.findEnabled(
        ctx.orgId,
        ctx.recipient.userId,
        ctx.eventType,
        "in_app",
      );
      if (isChannelEnabled(ctx.eventType, "in_app", pref)) {
        // Idempotent on outbox retry: reuse row for same deliveryKey.
        if (ctx.deliveryKey) {
          const existing = await this.notifications.findByDeliveryKey(
            ctx.orgId,
            ctx.recipient.userId,
            ctx.deliveryKey,
          );
          if (existing) {
            next.notificationId = existing.id;
            await this.inner.deliver(next);
            return;
          }
        }

        const data = ctx.deliveryKey
          ? { ...ctx.data, deliveryKey: ctx.deliveryKey }
          : ctx.data;
        const row = await this.notifications.insert({
          orgId: ctx.orgId,
          userId: ctx.recipient.userId,
          eventType: ctx.eventType,
          title: ctx.title,
          body: ctx.body,
          data,
          actions: ctx.actions,
        });
        next.notificationId = row.id;
      }
    }
    await this.inner.deliver(next);
  }
}

export class EmailChannelDecorator implements NotificationChannel {
  constructor(
    private readonly inner: NotificationChannel,
    private readonly mailer: Mailer,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly options?: {
      appPublicUrl?: string;
      subjectFor?: (eventType: NotificationEventType, title: string) => string;
      inviteAcceptLinks?: InviteAcceptLinkResolver;
    },
  ) {}

  async deliver(ctx: NotificationDeliveryContext): Promise<void> {
    const userId = ctx.recipient.userId;
    let enabled = true;
    if (userId) {
      const pref = await this.preferences.findEnabled(
        ctx.orgId,
        userId,
        ctx.eventType,
        "email",
      );
      enabled = isChannelEnabled(ctx.eventType, "email", pref);
    } else {
      // No user yet (e.g. invite_received): use policy default via null pref.
      enabled = isChannelEnabled(ctx.eventType, "email", null);
    }

    if (enabled && ctx.recipient.email) {
      const subject =
        this.options?.subjectFor?.(ctx.eventType, ctx.title) ?? ctx.title;
      const cta = await resolveEmailCta(ctx, this.options);
      const text = cta ? `${ctx.body}\n\n${cta}` : ctx.body;
      const html = cta
        ? `<p>${escapeHtml(ctx.body)}</p><p><a href="${escapeHtml(cta)}">${escapeHtml(ctx.title)}</a></p>`
        : `<p>${escapeHtml(ctx.body)}</p>`;
      await this.mailer.send({
        to: ctx.recipient.email,
        subject,
        text,
        html,
      });
    }

    await this.inner.deliver(ctx);
  }
}

async function resolveEmailCta(
  ctx: NotificationDeliveryContext,
  options?: {
    appPublicUrl?: string;
    inviteAcceptLinks?: InviteAcceptLinkResolver;
  },
): Promise<string | undefined> {
  // Never trust acceptUrl/token from payload (may be stale/secret-bearing).
  if (
    ctx.eventType === "membership.invite_received" &&
    options?.inviteAcceptLinks
  ) {
    const inviteId =
      (typeof ctx.data.entityIds?.membership_invite === "string"
        ? ctx.data.entityIds.membership_invite
        : undefined) ??
      (typeof ctx.payload?.inviteId === "string"
        ? ctx.payload.inviteId
        : undefined);
    if (inviteId) {
      const url = await options.inviteAcceptLinks.buildAcceptUrl(inviteId);
      if (url) return url;
    }
  }

  if (typeof ctx.data.deepLink === "string") {
    if (ctx.data.deepLink.startsWith("http")) return ctx.data.deepLink;
    if (options?.appPublicUrl) {
      return `${options.appPublicUrl.replace(/\/$/, "")}${ctx.data.deepLink.startsWith("/") ? "" : "/"}${ctx.data.deepLink}`;
    }
    return ctx.data.deepLink;
  }

  // Invite fallback without rotating token: public page + inviteId (not a secret).
  if (
    ctx.eventType === "membership.invite_received" &&
    options?.appPublicUrl
  ) {
    const inviteId = ctx.data.entityIds?.membership_invite;
    if (typeof inviteId === "string") {
      return `${options.appPublicUrl.replace(/\/$/, "")}/accept-invite?inviteId=${encodeURIComponent(inviteId)}`;
    }
  }

  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
