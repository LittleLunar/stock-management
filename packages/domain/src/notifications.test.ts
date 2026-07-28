import { describe, expect, it } from "vitest";
import {
  isChannelEnabled,
  isNotificationEventType,
  NOTIFICATION_CHANNEL_DEFAULTS,
} from "./notifications.js";

describe("notification preference defaults", () => {
  it("recognizes catalog event types", () => {
    expect(isNotificationEventType("user.welcome")).toBe(true);
    expect(isNotificationEventType("welcome")).toBe(false);
  });

  it("uses policy default when preference missing", () => {
    expect(isChannelEnabled("document.posted", "email", null)).toBe(false);
    expect(isChannelEnabled("document.posted", "in_app", undefined)).toBe(true);
    expect(isChannelEnabled("user.welcome", "email", null)).toBe(true);
  });

  it("lets preference override policy default", () => {
    expect(isChannelEnabled("document.posted", "email", true)).toBe(true);
    expect(isChannelEnabled("user.welcome", "email", false)).toBe(false);
  });

  it("documents email opt-in for document events", () => {
    expect(NOTIFICATION_CHANNEL_DEFAULTS["document.posted"].email).toBe(false);
    expect(NOTIFICATION_CHANNEL_DEFAULTS["document.voided"].email).toBe(false);
  });
});
