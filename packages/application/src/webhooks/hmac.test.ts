import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { signWebhookBody, webhookSignatureHeader } from "./hmac.js";

describe("signWebhookBody", () => {
  it("matches node createHmac sha256 hex", () => {
    const body = '{"hello":"world"}';
    const secret = "s3cret";
    const expected = createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("hex");
    expect(signWebhookBody(body, secret)).toBe(expected);
    expect(webhookSignatureHeader(body, secret)).toBe(`sha256=${expected}`);
  });
});
