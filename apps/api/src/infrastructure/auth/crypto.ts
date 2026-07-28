import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { SignJWT, errors as joseErrors, jwtVerify } from "jose";
import type {
  AccessTokenSigner,
  ActionTokenSigner,
  NotificationActionTokenClaims,
  OpaqueTokenService,
  PasswordHasher,
} from "@stock-management/application";
import {
  TokenExpiredError,
  TokenInvalidError,
} from "@stock-management/domain";

export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}

export class Sha256OpaqueTokenService implements OpaqueTokenService {
  issue(): string {
    return randomBytes(32).toString("base64url");
  }

  hash(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}

export class JoseAccessTokenSigner implements AccessTokenSigner {
  private readonly secret: Uint8Array;
  private readonly ttlSeconds: number;

  constructor(secret: string, ttlSeconds: number) {
    this.secret = new TextEncoder().encode(secret);
    this.ttlSeconds = ttlSeconds;
  }

  sign(claims: { sub: string; email: string }): Promise<string> {
    return new SignJWT({ email: claims.email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<{ sub: string; email: string }> {
    try {
      const { payload } = await jwtVerify(token, this.secret);
      const sub = payload.sub;
      const email = payload.email;
      if (typeof sub !== "string" || typeof email !== "string") {
        throw new TokenInvalidError();
      }
      return { sub, email };
    } catch (err) {
      if (err instanceof TokenInvalidError || err instanceof TokenExpiredError) {
        throw err;
      }
      if (err instanceof joseErrors.JWTExpired) {
        throw new TokenExpiredError();
      }
      throw new TokenInvalidError();
    }
  }
}

export class JoseActionTokenSigner implements ActionTokenSigner {
  private readonly secret: Uint8Array;
  private readonly ttlSeconds: number;

  constructor(secret: string, ttlSeconds: number) {
    this.secret = new TextEncoder().encode(secret);
    this.ttlSeconds = ttlSeconds;
  }

  sign(claims: NotificationActionTokenClaims): Promise<string> {
    return new SignJWT({
      notificationId: claims.notificationId,
      actionId: claims.actionId,
      orgId: claims.orgId,
      entityType: claims.entityRef.type,
      entityId: claims.entityRef.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<NotificationActionTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret);
      const userId = payload.sub;
      const notificationId = payload.notificationId;
      const actionId = payload.actionId;
      const orgId = payload.orgId;
      const entityType = payload.entityType;
      const entityId = payload.entityId;
      if (
        typeof userId !== "string" ||
        typeof notificationId !== "string" ||
        typeof actionId !== "string" ||
        typeof orgId !== "string" ||
        typeof entityType !== "string" ||
        typeof entityId !== "string"
      ) {
        throw new TokenInvalidError();
      }
      return {
        notificationId,
        actionId,
        userId,
        orgId,
        entityRef: { type: entityType, id: entityId },
      };
    } catch (err) {
      if (err instanceof TokenInvalidError || err instanceof TokenExpiredError) {
        throw err;
      }
      if (err instanceof joseErrors.JWTExpired) {
        throw new TokenExpiredError();
      }
      throw new TokenInvalidError();
    }
  }
}
