import { describe, expect, it } from "vitest";
import {
  NotificationEventPolicyRegistry,
  notificationEventPolicies,
} from "./policies.js";
import type {
  NotificationIntent,
  NotificationRecipientDirectory,
  NotificationUserRef,
} from "../ports/notification.js";

const members: NotificationUserRef[] = [
  {
    id: "admin-1",
    email: "admin@example.com",
    role: "org_admin",
    branchIds: [],
  },
  {
    id: "mgr-1",
    email: "mgr@example.com",
    role: "branch_manager",
    branchIds: ["branch-a"],
  },
  {
    id: "wh-1",
    email: "wh@example.com",
    role: "warehouse",
    branchIds: ["branch-a"],
  },
  {
    id: "buy-1",
    email: "buy@example.com",
    role: "purchasing",
    branchIds: ["branch-a"],
  },
];

const directory: NotificationRecipientDirectory = {
  async listActiveMembers() {
    return members;
  },
  async findUserById(userId) {
    const m = members.find((x) => x.id === userId);
    return m ? { id: m.id, email: m.email } : null;
  },
  async findUserByEmail(email) {
    const m = members.find(
      (x) => x.email.toLowerCase() === email.toLowerCase(),
    );
    return m ? { id: m.id, email: m.email } : null;
  },
};

describe("NotificationEventPolicyRegistry", () => {
  const registry = new NotificationEventPolicyRegistry();

  it("registers all v1 event policies", () => {
    expect(notificationEventPolicies.map((p) => p.eventType).sort()).toEqual(
      [
        "approval.assigned",
        "auth.password_changed",
        "document.posted",
        "document.voided",
        "membership.invite_accepted",
        "membership.invite_declined",
        "membership.invite_received",
        "stock.low",
        "user.email_verified",
        "user.welcome",
      ].sort(),
    );
  });

  it("resolves welcome to actor", async () => {
    const intent: NotificationIntent = {
      eventType: "user.welcome",
      orgId: "org-1",
      actorId: "admin-1",
    };
    const resolved = await registry.require("user.welcome").resolve(intent, directory);
    expect(resolved.recipients).toEqual([
      { userId: "admin-1", email: "admin@example.com" },
    ]);
    expect(resolved.defaultChannels).toEqual(["in_app", "email"]);
  });

  it("resolves invite_received to email-only when user unknown", async () => {
    const intent: NotificationIntent = {
      eventType: "membership.invite_received",
      orgId: "org-1",
      actorId: "admin-1",
      recipientHints: { email: "new@example.com" },
      payload: { acceptUrl: "http://x/accept?token=t" },
    };
    const resolved = await registry
      .require("membership.invite_received")
      .resolve(intent, directory);
    expect(resolved.recipients).toEqual([{ email: "new@example.com" }]);
    expect(resolved.actions.map((a) => a.id)).toEqual(["accept", "decline"]);
  });

  it("resolves document.posted to org_admin and branch managers for branch", async () => {
    const intent: NotificationIntent = {
      eventType: "document.posted",
      orgId: "org-1",
      entityRef: { type: "goods_receipt", id: "gr-1" },
      payload: { branchId: "branch-a" },
    };
    const resolved = await registry
      .require("document.posted")
      .resolve(intent, directory);
    expect(resolved.recipients.map((r) => r.userId).sort()).toEqual([
      "admin-1",
      "mgr-1",
    ]);
    expect(resolved.defaultChannels).toEqual(["in_app"]);
  });

  it("resolves approval.assigned including purchasing", async () => {
    const intent: NotificationIntent = {
      eventType: "approval.assigned",
      orgId: "org-1",
      entityRef: { type: "purchase_order", id: "po-1" },
      payload: { branchId: "branch-a" },
    };
    const resolved = await registry
      .require("approval.assigned")
      .resolve(intent, directory);
    expect(resolved.recipients.map((r) => r.userId).sort()).toEqual([
      "admin-1",
      "buy-1",
      "mgr-1",
    ]);
  });
});
