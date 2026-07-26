import { createHmac } from "node:crypto";

export function signWebhookBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function webhookSignatureHeader(rawBody: string, secret: string): string {
  return `sha256=${signWebhookBody(rawBody, secret)}`;
}
