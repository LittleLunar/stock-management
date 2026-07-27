import type { MembershipRole } from "@stock-management/domain";
import type {
  EventPolicyResolved,
  NotificationEventPolicy,
  NotificationIntent,
  NotificationRecipient,
  NotificationRecipientDirectory,
  NotificationUserRef,
} from "../ports/notification.js";
import type { NotificationEventType } from "@stock-management/domain";
import { NOTIFICATION_CHANNEL_DEFAULTS } from "@stock-management/domain";

function defaultChannels(eventType: NotificationEventType) {
  const defaults = NOTIFICATION_CHANNEL_DEFAULTS[eventType];
  return (["in_app", "email"] as const).filter((c) => defaults[c]);
}

function membersByRoles(
  members: NotificationUserRef[],
  roles: MembershipRole[],
  branchId?: string,
): NotificationRecipient[] {
  return members
    .filter((m) => roles.includes(m.role))
    .filter((m) => {
      if (!branchId) return true;
      if (m.role === "org_admin") return true;
      return m.branchIds.includes(branchId);
    })
    .map((m) => ({ userId: m.id, email: m.email }));
}

async function resolveHintedRecipients(
  intent: NotificationIntent,
  directory: NotificationRecipientDirectory,
): Promise<NotificationRecipient[]> {
  const hints = intent.recipientHints;
  if (!hints) return [];

  const out: NotificationRecipient[] = [];
  if (hints.userId) {
    const user = await directory.findUserById(hints.userId);
    if (user) out.push({ userId: user.id, email: user.email });
  }
  if (hints.userIds?.length) {
    for (const id of hints.userIds) {
      const user = await directory.findUserById(id);
      if (user) out.push({ userId: user.id, email: user.email });
    }
  }
  if (hints.email) {
    const user = await directory.findUserByEmail(hints.email);
    if (user) {
      out.push({ userId: user.id, email: user.email });
    } else {
      out.push({ email: hints.email });
    }
  }
  if (hints.roles?.length) {
    const members = await directory.listActiveMembers(intent.orgId);
    const branchId =
      typeof intent.payload?.branchId === "string"
        ? intent.payload.branchId
        : undefined;
    out.push(...membersByRoles(members, hints.roles, branchId));
  }
  return dedupeRecipients(out);
}

function dedupeRecipients(
  recipients: NotificationRecipient[],
): NotificationRecipient[] {
  const seen = new Set<string>();
  const result: NotificationRecipient[] = [];
  for (const r of recipients) {
    const key = r.userId ?? `email:${r.email.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(r);
  }
  return result;
}

function templatePolicy(
  eventType: NotificationEventType,
  title: string,
  body: (intent: NotificationIntent) => string,
  resolveRecipients: (
    intent: NotificationIntent,
    directory: NotificationRecipientDirectory,
  ) => Promise<NotificationRecipient[]>,
  actions?: EventPolicyResolved["actions"],
  deepLink?: (intent: NotificationIntent) => string | undefined,
): NotificationEventPolicy {
  return {
    eventType,
    async resolve(intent, directory) {
      const recipients = await resolveRecipients(intent, directory);
      const link = deepLink?.(intent);
      return {
        recipients,
        title,
        body: body(intent),
        data: {
          ...(link ? { deepLink: link } : {}),
          ...(intent.entityRef
            ? {
                entityIds: {
                  [intent.entityRef.type]: intent.entityRef.id,
                },
              }
            : {}),
          ...(intent.payload ?? {}),
        },
        actions: actions ?? (link ? [{ id: "open", label: "Open", kind: "open" }] : []),
        defaultChannels: defaultChannels(eventType),
      };
    },
  };
}

async function actorOrHint(
  intent: NotificationIntent,
  directory: NotificationRecipientDirectory,
): Promise<NotificationRecipient[]> {
  const hinted = await resolveHintedRecipients(intent, directory);
  if (hinted.length) return hinted;
  if (intent.actorId) {
    const user = await directory.findUserById(intent.actorId);
    if (user) return [{ userId: user.id, email: user.email }];
  }
  return [];
}

async function stakeholders(
  intent: NotificationIntent,
  directory: NotificationRecipientDirectory,
  roles: MembershipRole[],
): Promise<NotificationRecipient[]> {
  const hinted = await resolveHintedRecipients(intent, directory);
  if (hinted.length) return hinted;
  const members = await directory.listActiveMembers(intent.orgId);
  const branchId =
    typeof intent.payload?.branchId === "string"
      ? intent.payload.branchId
      : undefined;
  return membersByRoles(members, roles, branchId);
}

export const notificationEventPolicies: NotificationEventPolicy[] = [
  templatePolicy(
    "user.welcome",
    "Welcome",
    () => "Welcome to stock management. Your account is ready.",
    actorOrHint,
    [],
    () => "/",
  ),
  templatePolicy(
    "user.email_verified",
    "Email verified",
    () => "Your email address has been verified.",
    actorOrHint,
  ),
  templatePolicy(
    "auth.password_changed",
    "Password changed",
    () => "Your password was changed. If this wasn't you, reset it immediately.",
    actorOrHint,
  ),
  templatePolicy(
    "membership.invite_received",
    "You're invited",
    (intent) =>
      `You have been invited to join an organization${
        typeof intent.payload?.orgName === "string"
          ? ` (${intent.payload.orgName})`
          : ""
      }.`,
    actorOrHint,
    [
      { id: "accept", label: "Accept", kind: "server" },
      { id: "decline", label: "Decline", kind: "server" },
    ],
    (intent) =>
      typeof intent.payload?.acceptUrl === "string"
        ? intent.payload.acceptUrl
        : "/accept-invite",
  ),
  templatePolicy(
    "membership.invite_accepted",
    "Invite accepted",
    (intent) =>
      `${typeof intent.payload?.email === "string" ? intent.payload.email : "A teammate"} accepted their invite.`,
    (intent, directory) =>
      stakeholders(intent, directory, ["org_admin"]),
  ),
  templatePolicy(
    "membership.invite_declined",
    "Invite declined",
    () => "A membership invite was declined.",
    actorOrHint,
  ),
  templatePolicy(
    "document.posted",
    "Document posted",
    (intent) =>
      `${intent.entityRef?.type ?? "Document"} ${intent.entityRef?.id ?? ""} was posted.`.trim(),
    (intent, directory) =>
      stakeholders(intent, directory, ["org_admin", "branch_manager"]),
    undefined,
    (intent) =>
      intent.entityRef
        ? `/${intent.entityRef.type.replaceAll("_", "-")}s/${intent.entityRef.id}`
        : undefined,
  ),
  templatePolicy(
    "document.voided",
    "Document voided",
    (intent) =>
      `${intent.entityRef?.type ?? "Document"} ${intent.entityRef?.id ?? ""} was voided.`.trim(),
    (intent, directory) =>
      stakeholders(intent, directory, ["org_admin", "branch_manager"]),
  ),
  templatePolicy(
    "stock.low",
    "Low stock",
    (intent) => {
      const sku =
        typeof intent.payload?.sku === "string"
          ? intent.payload.sku
          : typeof intent.payload?.productId === "string"
            ? intent.payload.productId
            : "A product";
      return `${sku} is at or below reorder minimum.`;
    },
    (intent, directory) =>
      stakeholders(intent, directory, [
        "org_admin",
        "branch_manager",
        "purchasing",
      ]),
  ),
  templatePolicy(
    "approval.assigned",
    "Approval needed",
    (intent) =>
      `${intent.entityRef?.type ?? "Document"} needs your approval.`,
    (intent, directory) =>
      stakeholders(intent, directory, [
        "org_admin",
        "branch_manager",
        "purchasing",
      ]),
    [
      { id: "approve", label: "Approve", kind: "server" },
      { id: "reject", label: "Reject", kind: "server" },
    ],
  ),
];

export class NotificationEventPolicyRegistry {
  private readonly byType: Map<NotificationEventType, NotificationEventPolicy>;

  constructor(policies: NotificationEventPolicy[] = notificationEventPolicies) {
    this.byType = new Map(policies.map((p) => [p.eventType, p]));
  }

  get(eventType: NotificationEventType): NotificationEventPolicy | undefined {
    return this.byType.get(eventType);
  }

  require(eventType: NotificationEventType): NotificationEventPolicy {
    const policy = this.get(eventType);
    if (!policy) {
      throw new Error(`No notification policy for ${eventType}`);
    }
    return policy;
  }
}
