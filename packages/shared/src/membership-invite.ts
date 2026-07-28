import { z } from "zod";
import { MembershipRoleSchema, UuidSchema } from "./enums.js";

const PasswordSchema = z.string().min(8).max(128);

export const CreateMembershipInviteBodySchema = z.object({
  email: z.string().email(),
  role: MembershipRoleSchema,
  branchIds: z.array(UuidSchema).default([]),
});
export type CreateMembershipInviteBody = z.infer<
  typeof CreateMembershipInviteBodySchema
>;

export const MembershipInviteResponseSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  email: z.string().email(),
  role: MembershipRoleSchema,
  branchIds: z.array(UuidSchema),
  expiresAt: z.coerce.date(),
});
export type MembershipInviteResponse = z.infer<
  typeof MembershipInviteResponseSchema
>;

export const AcceptMembershipInviteBodySchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(256),
  password: PasswordSchema,
});
export type AcceptMembershipInviteBody = z.infer<
  typeof AcceptMembershipInviteBodySchema
>;

export const AcceptMembershipInviteResponseSchema = z.object({
  inviteId: UuidSchema,
  userId: UuidSchema,
  membershipId: UuidSchema,
  orgId: UuidSchema,
  email: z.string().email(),
});
export type AcceptMembershipInviteResponse = z.infer<
  typeof AcceptMembershipInviteResponseSchema
>;

export const DeclineMembershipInviteBodySchema = z.object({
  token: z.string().min(1),
});
export type DeclineMembershipInviteBody = z.infer<
  typeof DeclineMembershipInviteBodySchema
>;
