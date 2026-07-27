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

function repo(
  overrides: Partial<NotificationRepository> = {},
): NotificationRepository {
  return {
    async insert() {
      throw new Error("insert not stubbed");
    },
    async findByDeliveryKey() {
      return null;
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
    ...overrides,
  };
}

describe("InAppChannelDecorator", () => {
  it("inserts when in_app enabled by default and calls inner with notificationId", async () => {
    const inserted: Notification[] = [];
    const notifications = repo({
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
    });
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
      repo({ insert }),
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
      repo({ insert }),
      prefs(),
    );

    await channel.deliver(
      ctx({ recipient: { email: "invitee@example.com" } }),
    );

    expect(insert).not.toHaveBeenCalled();
    expect(innerDeliver).toHaveBeenCalled();
  });

  it("reuses existing row on deliveryKey retry (idempotent in-app)", async () => {
    const insert = vi.fn();
    const existing: Notification = {
      id: "n-existing",
      orgId: "org-1",
      userId: "user-1",
      eventType: "user.welcome",
      title: "Welcome",
      body: "Hello",
      data: { deliveryKey: "evt-1:user-1" },
      actions: [],
      readAt: null,
      dismissedAt: null,
      createdAt: new Date(),
    };
    const innerDeliver = vi.fn(async () => {});
    const channel = new InAppChannelDecorator(
      { deliver: innerDeliver },
      repo({
        insert,
        async findByDeliveryKey() {
          return existing;
        },
      }),
      prefs(),
    );

    await channel.deliver(ctx({ deliveryKey: "evt-1:user-1" }));

    expect(insert).not.toHaveBeenCalled();
    expect(innerDeliver).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: "n-existing" }),
    );
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

  it("builds invite CTA via resolver (not payload acceptUrl)", async () => {
    const send = vi.fn(async () => {});
    const buildAcceptUrl = vi.fn(async () => "http://app/accept-invite?token=rotated");
    const channel = new EmailChannelDecorator(
      new BaseNotificationChannel(),
      { send },
      prefs(),
      {
        appPublicUrl: "http://localhost:5173",
        inviteAcceptLinks: { buildAcceptUrl },
      },
    );

    await channel.deliver(
      ctx({
        eventType: "membership.invite_received",
        recipient: { email: "invitee@example.com" },
        data: { entityIds: { membership_invite: "inv-1" }, deepLink: "/accept-invite" },
        payload: { acceptUrl: "http://evil/steal?token=leaked" },
      }),
    );

    expect(buildAcceptUrl).toHaveBeenCalledWith("inv-1");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "invitee@example.com",
        text: expect.stringContaining("token=rotated"),
      }),
    );
    expect(send.mock.calls[0]?.[0]?.text).not.toContain("leaked");
  });
});

describe("partial delivery / retry", () => {
  it("does not leave a duplicate in-app row when email fails then retries", async () => {
    const rows: Notification[] = [];
    const notifications = repo({
      async insert(input) {
        const row: Notification = {
          id: `n-${rows.length + 1}`,
          ...input,
          readAt: null,
          dismissedAt: null,
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
      },
      async findByDeliveryKey(_org, _user, key) {
        return (
          rows.find((r) => r.data.deliveryKey === key) ?? null
        );
      },
    });

    let emailAttempts = 0;
    const mailer: Mailer = {
      async send() {
        emailAttempts += 1;
        if (emailAttempts === 1) throw new Error("smtp down");
      },
    };

    const channel = new InAppChannelDecorator(
      new EmailChannelDecorator(
        new BaseNotificationChannel(),
        mailer,
        prefs(),
      ),
      notifications,
      prefs(),
    );

    const delivery = ctx({
      deliveryKey: "evt-9:user-1",
      eventType: "user.welcome",
    });

    await expect(channel.deliver(delivery)).rejects.toThrow("smtp down");
    expect(rows).toHaveLength(1);

    await channel.deliver(delivery);
    expect(rows).toHaveLength(1);
    expect(emailAttempts).toBe(2);
  });
});
