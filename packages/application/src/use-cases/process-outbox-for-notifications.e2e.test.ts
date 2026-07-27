import { describe, expect, it, vi } from "vitest";
import type { Notification } from "@stock-management/domain";
import {
  BaseNotificationChannel,
  EmailChannelDecorator,
  InAppChannelDecorator,
} from "../notifications/channels.js";
import { ProcessOutboxForNotifications } from "./process-outbox-for-notifications.js";
import type {
  NotificationPreferenceRepository,
  NotificationRecipientDirectory,
  NotificationRepository,
} from "../ports/notification.js";

describe("notification.dispatch end-to-end (decorators)", () => {
  it("creates in-app row and sends email via Mailer", async () => {
    const rows: Notification[] = [];
    const notifications: NotificationRepository = {
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
        return rows.find((r) => r.data.deliveryKey === key) ?? null;
      },
      async listForUser() {
        return rows;
      },
      async unreadCount() {
        return rows.filter((r) => !r.readAt).length;
      },
      async findById(_o, _u, id) {
        return rows.find((r) => r.id === id) ?? null;
      },
      async markRead() {},
      async markAllRead() {
        return 0;
      },
      async dismiss() {},
    };
    const preferences: NotificationPreferenceRepository = {
      async list() {
        return [];
      },
      async upsert() {
        throw new Error("unused");
      },
      async findEnabled() {
        return null;
      },
    };
    const send = vi.fn(async () => {});
    const channel = new InAppChannelDecorator(
      new EmailChannelDecorator(
        new BaseNotificationChannel(),
        { send },
        preferences,
      ),
      notifications,
      preferences,
    );
    const directory: NotificationRecipientDirectory = {
      async listActiveMembers() {
        return [];
      },
      async findUserById(id) {
        return id === "u1" ? { id: "u1", email: "u1@example.com" } : null;
      },
      async findUserByEmail() {
        return null;
      },
    };

    const processor = new ProcessOutboxForNotifications(channel, directory);
    await processor.execute({
      id: "evt-1",
      orgId: "org-1",
      eventType: "notification.dispatch",
      aggregateType: "user",
      aggregateId: "u1",
      payload: {
        eventType: "user.welcome",
        actorId: "u1",
        recipientHints: { userId: "u1" },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventType).toBe("user.welcome");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u1@example.com", subject: "Welcome" }),
    );
  });
});
