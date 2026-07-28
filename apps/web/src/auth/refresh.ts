import { AuthSessionResponseSchema } from "@stock-management/shared";
import { env } from "../lib/env";
import {
  clearSession,
  getAccessToken,
  setAccessToken,
} from "./session";

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Single-flight refresh: concurrent 401s share one POST /auth/refresh.
 * Returns true when a new access token was stored.
 */
export async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${env.VITE_API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const raw: unknown = await res.json();
      const session = AuthSessionResponseSchema.parse(raw);
      setAccessToken(session.accessToken);
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Ensure we have an access token (memory/session or via refresh cookie). */
export async function ensureAccessToken(): Promise<boolean> {
  if (getAccessToken()) return true;
  return refreshSession();
}

/** Exposed for tests — resets single-flight latch. */
export function __resetRefreshLatchForTests(): void {
  refreshInFlight = null;
}
