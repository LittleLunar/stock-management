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
        const row = await this.notifications.insert({
          orgId: ctx.orgId,
          userId: ctx.recipient.userId,
          eventType: ctx.eventType,
          title: ctx.title,
          body: ctx.body,
          data: ctx.data,
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
      const cta = emailCta(ctx, this.options?.appPublicUrl);
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

function emailCta(
  ctx: NotificationDeliveryContext,
  appPublicUrl?: string,
): string | undefined {
  const payload = ctx.payload ?? {};
  if (typeof payload.acceptUrl === "string") return payload.acceptUrl;
  if (typeof payload.deepLink === "string") return payload.deepLink;
  if (typeof ctx.data.deepLink === "string") {
    if (ctx.data.deepLink.startsWith("http")) return ctx.data.deepLink;
    if (appPublicUrl) {
      return `${appPublicUrl.replace(/\/$/, "")}${ctx.data.deepLink.startsWith("/") ? "" : "/"}${ctx.data.deepLink}`;
    }
    return ctx.data.deepLink;
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
