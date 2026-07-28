import { env } from "../lib/env";
import { ApiError, parseApiError } from "../lib/errors";
import { refreshSession } from "./refresh";
import { redirectToLogin } from "./session";

/** Public auth endpoints (and refresh itself) must not 401→refresh→retry. */
const REFRESH_EXEMPT_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/signup",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/resend-verification",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/membership-invites/accept",
  "/api/v1/membership-invites/decline",
  "/api/v1/notification-actions/execute",
]);

export function shouldRetryOn401(path: string): boolean {
  return !REFRESH_EXEMPT_PATHS.has(path);
}

export type AuthedFetchOptions = {
  path: string;
  init?: RequestInit;
  /** Called per attempt so Bearer reflects a post-refresh token. */
  buildHeaders: () => HeadersInit;
};

/**
 * Shared fetch: credentials include; on 401 (non-exempt paths) single-flight
 * refresh once and retry; on refresh failure redirect to login.
 */
export async function fetchWithAuthRetry(
  options: AuthedFetchOptions,
): Promise<Response> {
  const { path, init, buildHeaders } = options;

  const doFetch = () =>
    fetch(`${env.VITE_API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: buildHeaders(),
    });

  let res = await doFetch();

  if (res.status === 401 && shouldRetryOn401(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await doFetch();
    } else {
      redirectToLogin();
      throw new ApiError(401, {
        code: "UNAUTHORIZED",
        message: "Session expired",
        requestId: "unknown",
      });
    }
  }

  return res;
}

export async function parseJsonResponse<T>(
  res: Response,
  parse?: (raw: unknown) => T,
): Promise<T> {
  if (!res.ok) {
    let raw: unknown = await res.text();
    try {
      raw = JSON.parse(raw as string);
    } catch {
      // keep text
    }
    throw parseApiError(res.status, raw);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const json: unknown = await res.json();
  return parse ? parse(json) : (json as T);
}
