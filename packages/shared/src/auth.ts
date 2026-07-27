import { z } from "zod";
import { MasterStatusSchema, MembershipRoleSchema, UuidSchema } from "./enums.js";

const PasswordSchema = z.string().min(8).max(128);

export const SignupBodySchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  name: z.string().min(1).max(256),
  orgName: z.string().min(1).max(256),
});
export type SignupBody = z.infer<typeof SignupBodySchema>;

export const SignupResponseSchema = z.object({
  userId: UuidSchema,
  orgId: UuidSchema,
  email: z.string().email(),
});
export type SignupResponse = z.infer<typeof SignupResponseSchema>;

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const AuthSessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  userId: UuidSchema,
  email: z.string().email(),
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

export const VerifyEmailBodySchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailBody = z.infer<typeof VerifyEmailBodySchema>;

export const ResendVerificationBodySchema = z.object({
  email: z.string().email(),
});
export type ResendVerificationBody = z.infer<typeof ResendVerificationBodySchema>;

export const ForgotPasswordBodySchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>;

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;

export const AuthMeMembershipSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  orgName: z.string().min(1),
  userId: UuidSchema,
  role: MembershipRoleSchema,
  status: MasterStatusSchema,
  branchIds: z.array(UuidSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const AuthMeUserSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  email: z.string().email(),
  name: z.string().min(1),
  status: MasterStatusSchema,
  emailVerifiedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const AuthMeResponseSchema = z.object({
  user: AuthMeUserSchema,
  memberships: z.array(AuthMeMembershipSchema),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
