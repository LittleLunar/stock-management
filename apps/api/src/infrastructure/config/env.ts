import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/stock_management"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  OUTBOX_POLLER_ENABLED: booleanFromEnv,
  OUTBOX_POLLER_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  RESERVATION_EXPIRE_ENABLED: booleanFromEnv,
  RESERVATION_EXPIRE_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  JWT_ACCESS_SECRET: z
    .string()
    .min(1)
    .default("dev-only-jwt-access-secret-change-me"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_COOKIE_NAME: z.string().min(1).default("refresh_token"),
  REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(14 * 24 * 60 * 60),
  AUTH_STUB: booleanFromEnv,
  APP_PUBLIC_URL: z.string().min(1).default("http://localhost:5173"),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export type ApiEnv = z.infer<typeof EnvSchema>;

export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
): ApiEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(details)}`);
  }
  return parsed.data;
}
