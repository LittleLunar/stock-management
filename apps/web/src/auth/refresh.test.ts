import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetRefreshLatchForTests, refreshSession } from "./refresh.js";
import { clearSession, getAccessToken } from "./session.js";

describe("refreshSession single-flight", () => {
  afterEach(() => {
    clearSession();
    __resetRefreshLatchForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shares one refresh request across concurrent callers", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          json: async () => ({
            accessToken: "new-access",
            userId: "00000000-0000-0000-0000-000000000001",
            email: "a@example.com",
          }),
        };
      }),
    );

    const [a, b, c] = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
    expect(calls).toBe(1);
    expect(getAccessToken()).toBe("new-access");
  });

  it("clears session when refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
      })),
    );

    const ok = await refreshSession();
    expect(ok).toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});
