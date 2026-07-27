const ACCESS_TOKEN_KEY = "accessToken";
const ORG_ID_KEY = "orgId";
const ORG_NAME_KEY = "orgName";
const USER_ID_KEY = "userId";

let accessTokenMemory: string | null = null;

function readSessionStorage(key: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(key);
}

function writeSessionStorage(key: string, value: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, value);
}

function removeSessionStorage(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(key);
}

export function getAccessToken(): string | null {
  if (accessTokenMemory) return accessTokenMemory;
  const stored = readSessionStorage(ACCESS_TOKEN_KEY);
  if (stored) {
    accessTokenMemory = stored;
  }
  return accessTokenMemory;
}

export function setAccessToken(token: string): void {
  accessTokenMemory = token;
  writeSessionStorage(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  accessTokenMemory = null;
  removeSessionStorage(ACCESS_TOKEN_KEY);
}

export function getOrgId(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(ORG_ID_KEY) ?? "";
}

export function getOrgName(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(ORG_NAME_KEY) ?? "";
}

export function setOrgContext(orgId: string, orgName?: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ORG_ID_KEY, orgId);
  if (orgName) {
    localStorage.setItem(ORG_NAME_KEY, orgName);
  }
}

export function clearOrgContext(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ORG_ID_KEY);
  localStorage.removeItem(ORG_NAME_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

/** Clear access token + org bootstrap leftovers. */
export function clearSession(): void {
  clearAccessToken();
  clearOrgContext();
}

/**
 * Same-origin relative path only. Rejects protocol-relative and absolute URLs.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login") || next.startsWith("/signup")) return "/";
  return next;
}

export function isAuthPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email"
  );
}

export function loginRedirectUrl(next?: string): string {
  const path =
    next ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");
  const safe = safeNextPath(path);
  if (safe === "/") return "/login";
  return `/login?next=${encodeURIComponent(safe)}`;
}

/** Hard navigate to login when refresh fails (avoids router cycles). */
export function redirectToLogin(next?: string): void {
  if (typeof window === "undefined") return;
  if (isAuthPublicPath(window.location.pathname)) return;
  window.location.assign(loginRedirectUrl(next));
}
