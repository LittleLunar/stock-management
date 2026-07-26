import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3001);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
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
