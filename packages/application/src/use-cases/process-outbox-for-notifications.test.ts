import { describe, expect, it, vi } from "vitest";
import { ProcessOutboxForNotifications } from "./process-outbox-for-notifications.js";
import type {
  NotificationChannel,
  NotificationRecipientDirectory,
} from "../ports/notification.js";

describe("ProcessOutboxForNotifications", () => {
  const directory: NotificationRecipientDirectory = {
    async listActiveMembers() {
      return [
        {
          id: "u1",
          email: "u1@example.com",
          role: "org_admin",
          branchIds: [],
        },
      ];
    },
    async findUserById(id) {
      return id === "u1" ? { id: "u1", email: "u1@example.com" } : null;
    },
    async findUserByEmail() {
      return null;
    },
  };

  it("dispatches notification.dispatch through the channel per recipient", async () => {
    const deliver = vi.fn(async () => {});
    const channel: NotificationChannel = { deliver };
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
      },
    });

    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        eventType: "user.welcome",
        recipient: { userId: "u1", email: "u1@example.com" },
        title: "Welcome",
      }),
    );
  });

  it("maps document.posted outbox events to notification intents", async () => {
    const deliver = vi.fn(async () => {});
    const processor = new ProcessOutboxForNotifications(
      { deliver },
      directory,
    );

    await processor.execute({
      id: "evt-2",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { userId: "u1", branchId: "b1" },
    });

    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "document.posted",
        recipient: { userId: "u1", email: "u1@example.com" },
      }),
    );
  });

  it("ignores stock.changed without notification.dispatch wrapper", async () => {
    const deliver = vi.fn(async () => {});
    const processor = new ProcessOutboxForNotifications(
      { deliver },
      directory,
    );

    await processor.execute({
      id: "evt-3",
      orgId: "org-1",
      eventType: "stock.changed",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: {},
    });

    expect(deliver).not.toHaveBeenCalled();
  });
});
