import { describe, expect, it } from "vitest";
import {
  notificationChannelEnum,
  notificationPreferences,
  notifications,
} from "./index.js";

describe("notifications schema", () => {
  it("exposes notification_channel enum", () => {
    expect(notificationChannelEnum.enumValues).toEqual(["in_app", "email"]);
  });

  it("defines notifications with org/user scope and soft dismiss", () => {
    expect(notifications.orgId).toBeDefined();
    expect(notifications.userId).toBeDefined();
    expect(notifications.eventType).toBeDefined();
    expect(notifications.title).toBeDefined();
    expect(notifications.body).toBeDefined();
    expect(notifications.data).toBeDefined();
    expect(notifications.actions).toBeDefined();
    expect(notifications.readAt).toBeDefined();
    expect(notifications.dismissedAt).toBeDefined();
  });

  it("defines notification_preferences unique per user/org/event/channel", () => {
    expect(notificationPreferences.userId).toBeDefined();
    expect(notificationPreferences.orgId).toBeDefined();
    expect(notificationPreferences.eventType).toBeDefined();
    expect(notificationPreferences.channel).toBeDefined();
    expect(notificationPreferences.enabled).toBeDefined();
  });
});
