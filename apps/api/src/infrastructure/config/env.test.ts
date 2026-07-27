import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3001);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
    expect(env.RESERVATION_EXPIRE_ENABLED).toBe(false);
    expect(env.RESERVATION_EXPIRE_INTERVAL_MS).toBe(60_000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TTL_SECONDS).toBe(14 * 24 * 60 * 60);
    expect(env.AUTH_STUB).toBe(false);
    expect(env.APP_PUBLIC_URL).toBe("http://localhost:5173");
  });

  it("parses PORT and LOG_LEVEL", () => {
    const env = loadEnv({
      PORT: "4000",
      LOG_LEVEL: "debug",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/db",
    });
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.NODE_ENV).toBe("production");
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() => loadEnv({ LOG_LEVEL: "verbose" })).toThrow(/Invalid environment/);
  });
});
