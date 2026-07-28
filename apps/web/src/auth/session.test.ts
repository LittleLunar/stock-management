import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  getAccessToken,
  isAuthPublicPath,
  loginRedirectUrl,
  safeNextPath,
  setAccessToken,
} from "./session.js";

describe("safeNextPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNextPath("/stock")).toBe("/stock");
    expect(safeNextPath("/branches?x=1")).toBe("/branches?x=1");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });

  it("avoids bouncing back to auth pages", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/signup")).toBe("/");
  });
});

describe("loginRedirectUrl", () => {
  it("includes next when not home", () => {
    expect(loginRedirectUrl("/stock")).toBe("/login?next=%2Fstock");
    expect(loginRedirectUrl("/")).toBe("/login");
  });
});

describe("isAuthPublicPath", () => {
  it("recognizes public auth routes", () => {
    expect(isAuthPublicPath("/login")).toBe(true);
    expect(isAuthPublicPath("/verify-email")).toBe(true);
    expect(isAuthPublicPath("/accept-invite")).toBe(true);
    expect(isAuthPublicPath("/")).toBe(false);
  });
});

describe("access token memory/sessionStorage", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("stores and clears token", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });

    setAccessToken("tok-1");
    expect(getAccessToken()).toBe("tok-1");
    clearSession();
    expect(getAccessToken()).toBeNull();
  });
});
