import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./api.js";
import { __resetRefreshLatchForTests } from "./refresh.js";
import {
  applyMembershipOrgContext,
} from "./restore.js";
import {
  clearSession,
  getAccessToken,
  getOrgId,
  getOrgName,
  setAccessToken,
  setOrgContext,
} from "./session.js";
import { shouldRetryOn401 } from "./http.js";

describe("shouldRetryOn401", () => {
  it("retries /me and business paths", () => {
    expect(shouldRetryOn401("/api/v1/auth/me")).toBe(true);
    expect(shouldRetryOn401("/api/v1/branches")).toBe(true);
  });

  it("does not retry public auth endpoints or refresh", () => {
    expect(shouldRetryOn401("/api/v1/auth/login")).toBe(false);
    expect(shouldRetryOn401("/api/v1/auth/refresh")).toBe(false);
    expect(shouldRetryOn401("/api/v1/auth/signup")).toBe(false);
  });
});

describe("authApi.me 401 refresh retry", () => {
  afterEach(() => {
    clearSession();
    __resetRefreshLatchForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refreshes once then retries /me with new Bearer", async () => {
    setAccessToken("expired");
    const paths: string[] = [];
    const authHeaders: Array<string | null> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url).replace(/^https?:\/\/[^/]+/, "");
        paths.push(path);
        const headers = new Headers(init?.headers);
        authHeaders.push(headers.get("Authorization"));

        if (path === "/api/v1/auth/me" && headers.get("Authorization") === "Bearer expired") {
          return { ok: false, status: 401, text: async () => '{"error":{"code":"UNAUTHORIZED","message":"expired","requestId":"r1"}}', json: async () => ({}) };
        }
        if (path === "/api/v1/auth/refresh") {
          return {
            ok: true,
            json: async () => ({
              accessToken: "fresh",
              userId: "00000000-0000-0000-0000-000000000001",
              email: "a@example.com",
            }),
          };
        }
        if (path === "/api/v1/auth/me" && headers.get("Authorization") === "Bearer fresh") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: {
                id: "00000000-0000-0000-0000-000000000001",
                orgId: "00000000-0000-0000-0000-000000000010",
                email: "a@example.com",
                name: "Ada",
                status: "active",
                emailVerifiedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              memberships: [
                {
                  id: "00000000-0000-0000-0000-000000000020",
                  orgId: "00000000-0000-0000-0000-000000000010",
                  orgName: "Fresh Org",
                  userId: "00000000-0000-0000-0000-000000000001",
                  role: "org_admin",
                  status: "active",
                  branchIds: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          };
        }
        throw new Error(`unexpected fetch ${path}`);
      }),
    );

    const me = await authApi.me();
    expect(paths.filter((p) => p === "/api/v1/auth/me")).toHaveLength(2);
    expect(paths).toContain("/api/v1/auth/refresh");
    expect(getAccessToken()).toBe("fresh");
    expect(me.user.name).toBe("Ada");
  });

  it("does not refresh on login 401", async () => {
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = String(url).replace(/^https?:\/\/[^/]+/, "");
        if (path === "/api/v1/auth/refresh") {
          refreshCalls += 1;
        }
        return {
          ok: false,
          status: 401,
          text: async () =>
            '{"error":{"code":"INVALID_CREDENTIALS","message":"bad","requestId":"r1"}}',
          json: async () => ({}),
        };
      }),
    );

    await expect(
      authApi.login({ email: "a@example.com", password: "wrong-password" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(refreshCalls).toBe(0);
  });
});

describe("applyMembershipOrgContext", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("sets org from first membership when none stored", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });

    applyMembershipOrgContext({
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        orgId: "00000000-0000-0000-0000-000000000010",
        email: "a@example.com",
        name: "Ada",
        status: "active",
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      memberships: [
        {
          id: "00000000-0000-0000-0000-000000000020",
          orgId: "00000000-0000-0000-0000-000000000010",
          orgName: "Acme",
          userId: "00000000-0000-0000-0000-000000000001",
          role: "org_admin",
          status: "active",
          branchIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    expect(getOrgId()).toBe("00000000-0000-0000-0000-000000000010");
    expect(getOrgName()).toBe("Acme");
  });

  it("keeps current org when still in memberships", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    setOrgContext(
      "00000000-0000-0000-0000-000000000099",
      "Stale Name",
    );

    applyMembershipOrgContext({
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        orgId: "00000000-0000-0000-0000-000000000010",
        email: "a@example.com",
        name: "Ada",
        status: "active",
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      memberships: [
        {
          id: "00000000-0000-0000-0000-000000000021",
          orgId: "00000000-0000-0000-0000-000000000010",
          orgName: "First",
          userId: "00000000-0000-0000-0000-000000000001",
          role: "org_admin",
          status: "active",
          branchIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "00000000-0000-0000-0000-000000000022",
          orgId: "00000000-0000-0000-0000-000000000099",
          orgName: "Second",
          userId: "00000000-0000-0000-0000-000000000001",
          role: "warehouse",
          status: "active",
          branchIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    expect(getOrgId()).toBe("00000000-0000-0000-0000-000000000099");
    expect(getOrgName()).toBe("Second");
  });
});
