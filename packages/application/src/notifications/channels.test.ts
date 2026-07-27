import { describe, expect, it, vi } from "vitest";
import type { Notification } from "@stock-management/domain";
import {
  BaseNotificationChannel,
  EmailChannelDecorator,
  InAppChannelDecorator,
} from "./channels.js";
import type {
  NotificationDeliveryContext,
  NotificationPreferenceRepository,
  NotificationRepository,
} from "../ports/notification.js";
import type { Mailer } from "../ports/auth.js";

function ctx(
  overrides: Partial<NotificationDeliveryContext> = {},
): NotificationDeliveryContext {
  return {
    orgId: "org-1",
    eventType: "user.welcome",
    recipient: { userId: "user-1", email: "a@example.com" },
    title: "Welcome",
    body: "Hello",
    data: {},
    actions: [],
    ...overrides,
  };
}

function prefs(
  map: Record<string, boolean | null> = {},
): NotificationPreferenceRepository {
  return {
    async list() {
      return [];
    },
    async upsert() {
      throw new Error("not used");
    },
    async findEnabled(_org, userId, eventType, channel) {
      const key = `${userId}:${eventType}:${channel}`;
      return key in map ? map[key]! : null;
    },
  };
}

describe("InAppChannelDecorator", () => {
  it("inserts when in_app enabled by default and calls inner with notificationId", async () => {
    const inserted: Notification[] = [];
    const notifications: NotificationRepository = {
      async insert(input) {
        const row: Notification = {
          id: "n-1",
          ...input,
          readAt: null,
          dismissedAt: null,
          createdAt: new Date(),
        };
        inserted.push(row);
        return row;
      },
      async listForUser() {
        return [];
      },
      async unreadCount() {
        return 0;
      },
      async findById() {
        return null;
      },
      async markRead() {},
      async markAllRead() {
        return 0;
      },
      async dismiss() {},
    };
    const innerDeliver = vi.fn(async () => {});
    const channel = new InAppChannelDecorator(
      { deliver: innerDeliver },
      notifications,
      prefs(),
    );

    await channel.deliver(ctx());

    expect(inserted).toHaveLength(1);
    expect(innerDeliver).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: "n-1" }),
    );
  });

  it("skips insert when preference disables in_app but still calls inner", async () => {
    const insert = vi.fn();
    const innerDeliver = vi.fn(async () => {});
    const channel = new InAppChannelDecorator(
      { deliver: innerDeliver },
      { insert } as unknown as NotificationRepository,
      prefs({ "user-1:user.welcome:in_app": false }),
    );

    await channel.deliver(ctx());

    expect(insert).not.toHaveBeenCalled();
    expect(innerDeliver).toHaveBeenCalled();
  });

  it("skips insert when recipient has no userId", async () => {
    const insert = vi.fn();
    const innerDeliver = vi.fn(async () => {});
    const channel = new InAppChannelDecorator(
      { deliver: innerDeliver },
      { insert } as unknown as NotificationRepository,
      prefs(),
    );

    await channel.deliver(
      ctx({ recipient: { email: "invitee@example.com" } }),
    );

    expect(insert).not.toHaveBeenCalled();
    expect(innerDeliver).toHaveBeenCalled();
  });
});

describe("EmailChannelDecorator", () => {
  it("sends mail when email enabled and calls inner", async () => {
    const send = vi.fn(async () => {});
    const mailer: Mailer = { send };
    const innerDeliver = vi.fn(async () => {});
    const channel = new EmailChannelDecorator(
      { deliver: innerDeliver },
      mailer,
      prefs(),
    );

    await channel.deliver(ctx({ eventType: "user.welcome" }));

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.com",
        subject: "Welcome",
      }),
    );
    expect(innerDeliver).toHaveBeenCalled();
  });

  it("short-circuits email when preference disables email", async () => {
    const send = vi.fn(async () => {});
    const innerDeliver = vi.fn(async () => {});
    const channel = new EmailChannelDecorator(
      { deliver: innerDeliver },
      { send },
      prefs({ "user-1:document.posted:email": false }),
    );

    await channel.deliver(ctx({ eventType: "document.posted" }));

    expect(send).not.toHaveBeenCalled();
    expect(innerDeliver).toHaveBeenCalled();
  });

  it("uses policy default (no email) for document.posted without preference", async () => {
    const send = vi.fn(async () => {});
    const channel = new EmailChannelDecorator(
      new BaseNotificationChannel(),
      { send },
      prefs(),
    );

    await channel.deliver(ctx({ eventType: "document.posted" }));

    expect(send).not.toHaveBeenCalled();
  });

  it("emails invitee without userId using policy default", async () => {
    const send = vi.fn(async () => {});
    const channel = new EmailChannelDecorator(
      new BaseNotificationChannel(),
      { send },
      prefs(),
      { appPublicUrl: "http://localhost:5173" },
    );

    await channel.deliver(
      ctx({
        eventType: "membership.invite_received",
        recipient: { email: "invitee@example.com" },
        payload: { acceptUrl: "http://localhost:5173/accept-invite?token=abc" },
      }),
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "invitee@example.com",
        text: expect.stringContaining("accept-invite?token=abc"),
      }),
    );
  });
});
