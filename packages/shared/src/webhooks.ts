import { z } from "zod";

export const CreateWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8),
  eventTypes: z.array(z.string().min(1)).min(1),
  branchId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});
export type CreateWebhookSubscription = z.infer<
  typeof CreateWebhookSubscriptionSchema
>;

export const UpdateWebhookSubscriptionSchema =
  CreateWebhookSubscriptionSchema.partial();
export type UpdateWebhookSubscription = z.infer<
  typeof UpdateWebhookSubscriptionSchema
>;
