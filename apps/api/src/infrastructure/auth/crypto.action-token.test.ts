import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  TokenExpiredError,
  TokenInvalidError,
} from "@stock-management/domain";
import { JoseActionTokenSigner } from "./crypto.js";

describe("JoseActionTokenSigner", () => {
  const secret = "test-action-secret";
  const claims = {
    notificationId: "00000000-0000-4000-8000-000000000001",
    actionId: "approve",
    userId: "00000000-0000-4000-8000-000000000002",
    orgId: "00000000-0000-4000-8000-000000000003",
    entityRef: {
      type: "purchase_order",
      id: "00000000-0000-4000-8000-000000000004",
    },
  };

  it("round-trips action claims", async () => {
    const signer = new JoseActionTokenSigner(secret, 3600);
    const token = await signer.sign(claims);
    await expect(signer.verify(token)).resolves.toEqual(claims);
  });

  it("maps expired JWT to TokenExpiredError", async () => {
    const key = new TextEncoder().encode(secret);
    const token = await new SignJWT({
      notificationId: claims.notificationId,
      actionId: claims.actionId,
      orgId: claims.orgId,
      entityType: claims.entityRef.type,
      entityId: claims.entityRef.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setExpirationTime("0s")
      .sign(key);
    await new Promise((r) => setTimeout(r, 20));
    const signer = new JoseActionTokenSigner(secret, 3600);
    await expect(signer.verify(token)).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("maps malformed JWT to TokenInvalidError", async () => {
    const signer = new JoseActionTokenSigner(secret, 3600);
    await expect(signer.verify("not-a-jwt")).rejects.toBeInstanceOf(
      TokenInvalidError,
    );
  });
});
