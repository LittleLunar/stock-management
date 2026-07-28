import { describe, expect, it } from "vitest";
import {
  DEV_ACTION_TOKEN_SECRET,
  DEV_JWT_ACCESS_SECRET,
  loadEnv,
} from "./env.js";

const productionSecrets = {
  JWT_ACCESS_SECRET: "prod-jwt-access-secret-not-a-default",
  ACTION_TOKEN_SECRET: "prod-action-token-secret-not-a-default",
} as const;

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
    expect(env.JWT_ACCESS_SECRET).toBe(DEV_JWT_ACCESS_SECRET);
    expect(env.ACTION_TOKEN_SECRET).toBe(DEV_ACTION_TOKEN_SECRET);
  });

  it("parses PORT and LOG_LEVEL", () => {
    const env = loadEnv({
      PORT: "4000",
      LOG_LEVEL: "debug",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/db",
      ...productionSecrets,
    });
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.NODE_ENV).toBe("production");
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() => loadEnv({ LOG_LEVEL: "verbose" })).toThrow(/Invalid environment/);
  });

  it("refuses weak JWT_ACCESS_SECRET default in production", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost/db",
        JWT_ACCESS_SECRET: DEV_JWT_ACCESS_SECRET,
        ACTION_TOKEN_SECRET: productionSecrets.ACTION_TOKEN_SECRET,
      }),
    ).toThrow(/JWT_ACCESS_SECRET.*production/);
  });

  it("refuses weak ACTION_TOKEN_SECRET default in production", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost/db",
        JWT_ACCESS_SECRET: productionSecrets.JWT_ACCESS_SECRET,
        ACTION_TOKEN_SECRET: DEV_ACTION_TOKEN_SECRET,
      }),
    ).toThrow(/ACTION_TOKEN_SECRET.*production/);
  });

  it("refuses AUTH_STUB=true in production", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost/db",
        AUTH_STUB: "true",
        ...productionSecrets,
      }),
    ).toThrow(/AUTH_STUB.*production/);
  });

  it("allows production with strong secrets and AUTH_STUB off", () => {
    const env = loadEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/db",
      ...productionSecrets,
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.AUTH_STUB).toBe(false);
  });
});
