import type {
  AuthMeResponse,
  AuthSessionResponse,
  ForgotPasswordBody,
  LoginBody,
  ResendVerificationBody,
  ResetPasswordBody,
  SignupBody,
  SignupResponse,
  VerifyEmailBody,
} from "@stock-management/shared";
import {
  AuthMeResponseSchema,
  AuthSessionResponseSchema,
  SignupResponseSchema,
} from "@stock-management/shared";
import { getAccessToken, setAccessToken } from "./session";
import { fetchWithAuthRetry, parseJsonResponse } from "./http";

async function authRequest<T>(
  path: string,
  init?: RequestInit,
  parse?: (raw: unknown) => T,
): Promise<T> {
  const res = await fetchWithAuthRetry({
    path,
    init,
    buildHeaders: () => {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type") && init?.body) {
        headers.set("Content-Type", "application/json");
      }
      if (!headers.has("X-Request-Id")) {
        headers.set("X-Request-Id", crypto.randomUUID());
      }
      const token = getAccessToken();
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  });
  return parseJsonResponse(res, parse);
}

function storeSession(session: AuthSessionResponse): AuthSessionResponse {
  setAccessToken(session.accessToken);
  return session;
}

export const authApi = {
  signup: (body: SignupBody) =>
    authRequest<SignupResponse>(
      "/api/v1/auth/signup",
      { method: "POST", body: JSON.stringify(body) },
      (raw) => SignupResponseSchema.parse(raw),
    ),

  login: async (body: LoginBody) => {
    const session = await authRequest<AuthSessionResponse>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify(body) },
      (raw) => AuthSessionResponseSchema.parse(raw),
    );
    return storeSession(session);
  },

  logout: () =>
    authRequest<void>("/api/v1/auth/logout", { method: "POST" }),

  verifyEmail: (body: VerifyEmailBody) =>
    authRequest<void>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resendVerification: (body: ResendVerificationBody) =>
    authRequest<void>("/api/v1/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  forgotPassword: (body: ForgotPasswordBody) =>
    authRequest<void>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resetPassword: (body: ResetPasswordBody) =>
    authRequest<void>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () =>
    authRequest<AuthMeResponse>(
      "/api/v1/auth/me",
      { method: "GET" },
      (raw) => AuthMeResponseSchema.parse(raw),
    ),
};
