import { ErrorEnvelopeSchema, type ErrorBody } from "@stock-management/shared";
import i18n from "../i18n";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  readonly details?: unknown;

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

export function parseApiError(status: number, raw: unknown): ApiError {
  const parsed = ErrorEnvelopeSchema.safeParse(raw);
  if (parsed.success) {
    return new ApiError(status, parsed.data.error);
  }
  return new ApiError(status, {
    code: "INTERNAL_ERROR",
    message:
      typeof raw === "string" && raw.trim()
        ? raw
        : `Request failed with status ${status}`,
    requestId: "unknown",
  });
}

function localizedErrorMessage(code: string, fallback: string): string {
  const key = `errors.${code}`;
  const translated = i18n.t(key, { ns: "errors", defaultValue: "" });
  if (translated && translated !== key) return translated;
  return fallback;
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const message = localizedErrorMessage(error.code, error.message);
    const suffix =
      import.meta.env.DEV && error.requestId !== "unknown"
        ? ` (${error.requestId})`
        : "";
    return `${message}${suffix}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
