import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AuthSession, AuthUseCases } from "@stock-management/application";
import { UnauthorizedError } from "@stock-management/domain";
import {
  AuthMeResponseSchema,
  AuthSessionResponseSchema,
  ForgotPasswordBodySchema,
  LoginBodySchema,
  ResendVerificationBodySchema,
  ResetPasswordBodySchema,
  SignupBodySchema,
  SignupResponseSchema,
  VerifyEmailBodySchema,
} from "@stock-management/shared";

export type AuthRouteOptions = {
  cookieName: string;
  secureCookies: boolean;
  accessTokenVerifier: {
    verify(token: string): Promise<{ sub: string; email: string }>;
  };
};

function refreshCookieOptions(
  options: AuthRouteOptions,
  maxAgeSeconds: number,
) {
  return {
    path: "/api/v1/auth",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: options.secureCookies,
    maxAge: maxAgeSeconds,
  };
}

function setRefreshCookie(
  reply: FastifyReply,
  options: AuthRouteOptions,
  session: AuthSession,
): void {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((session.refreshExpiresAt.getTime() - Date.now()) / 1000),
  );
  reply.setCookie(
    options.cookieName,
    session.refreshToken,
    refreshCookieOptions(options, maxAgeSeconds),
  );
}

function clearRefreshCookie(
  reply: FastifyReply,
  options: AuthRouteOptions,
): void {
  reply.clearCookie(options.cookieName, {
    path: "/api/v1/auth",
    httpOnly: true,
    sameSite: "lax",
    secure: options.secureCookies,
  });
}

function readRefreshToken(
  request: FastifyRequest,
  cookieName: string,
): string | undefined {
  const value = request.cookies?.[cookieName];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function requireBearerUserId(
  request: FastifyRequest,
  verifier: AuthRouteOptions["accessTokenVerifier"],
): Promise<string> {
  const auth = request.headers.authorization;
  if (typeof auth !== "string" || !auth.toLowerCase().startsWith("bearer ")) {
    throw new UnauthorizedError("Missing Authorization Bearer token");
  }
  const token = auth.slice("bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Missing Authorization Bearer token");
  }
  const claims = await verifier.verify(token);
  return claims.sub;
}

function sessionBody(session: AuthSession) {
  return AuthSessionResponseSchema.parse({
    accessToken: session.accessToken,
    userId: session.userId,
    email: session.email,
  });
}

export function authRoutes(
  useCases: AuthUseCases,
  options: AuthRouteOptions,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/auth/signup", async (request, reply) => {
      const body = SignupBodySchema.parse(request.body);
      const result = await useCases.signup(body);
      return reply
        .status(201)
        .send(SignupResponseSchema.parse(result));
    });

    app.post("/auth/login", async (request, reply) => {
      const body = LoginBodySchema.parse(request.body);
      const session = await useCases.login(body);
      setRefreshCookie(reply, options, session);
      return sessionBody(session);
    });

    app.post("/auth/logout", async (request, reply) => {
      const refreshToken = readRefreshToken(request, options.cookieName);
      if (refreshToken) {
        await useCases.logout({ refreshToken });
      }
      clearRefreshCookie(reply, options);
      return reply.status(204).send();
    });

    app.post("/auth/refresh", async (request, reply) => {
      const refreshToken = readRefreshToken(request, options.cookieName);
      if (!refreshToken) {
        throw new UnauthorizedError("Missing refresh token cookie");
      }
      const session = await useCases.refresh({ refreshToken });
      setRefreshCookie(reply, options, session);
      return sessionBody(session);
    });

    app.post("/auth/verify-email", async (request, reply) => {
      const body = VerifyEmailBodySchema.parse(request.body);
      await useCases.verifyEmail(body);
      return reply.status(204).send();
    });

    app.post("/auth/resend-verification", async (request, reply) => {
      const body = ResendVerificationBodySchema.parse(request.body);
      await useCases.resendVerification(body);
      return reply.status(204).send();
    });

    app.post("/auth/forgot-password", async (request, reply) => {
      const body = ForgotPasswordBodySchema.parse(request.body);
      await useCases.forgotPassword(body);
      return reply.status(204).send();
    });

    app.post("/auth/reset-password", async (request, reply) => {
      const body = ResetPasswordBodySchema.parse(request.body);
      await useCases.resetPassword(body);
      return reply.status(204).send();
    });

    app.get("/auth/me", async (request) => {
      const userId = await requireBearerUserId(
        request,
        options.accessTokenVerifier,
      );
      const me = await useCases.getMe({ userId });
      return AuthMeResponseSchema.parse(me);
    });
  };
}
