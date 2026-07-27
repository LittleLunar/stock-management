import { z } from "zod";
import { UuidSchema } from "./enums.js";

export const NotificationEventTypeSchema = z.enum([
  "user.welcome",
  "user.email_verified",
  "auth.password_changed",
  "membership.invite_received",
  "membership.invite_accepted",
  "membership.invite_declined",
  "document.posted",
  "document.voided",
  "stock.low",
  "approval.assigned",
]);

export const NotificationChannelSchema = z.enum(["in_app", "email"]);

export const NotificationActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["open", "server"]),
});

export const NotificationSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  userId: UuidSchema,
  eventType: NotificationEventTypeSchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()),
  actions: z.array(NotificationActionSchema),
  readAt: z.string().datetime().nullable(),
  dismissedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const NotificationListQuerySchema = z.object({
  includeDismissed: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const PutNotificationPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        eventType: NotificationEventTypeSchema,
        channel: NotificationChannelSchema,
        enabled: z.boolean(),
      }),
    )
    .min(1),
});
export type PutNotificationPreferences = z.infer<
  typeof PutNotificationPreferencesSchema
>;
