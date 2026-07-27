import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type {
  AccessTokenSigner,
  MembershipAccessPort,
} from "@stock-management/application";
import {
  resolveActiveBranch,
  UnauthorizedError,
  type Membership,
  type MembershipRole,
} from "@stock-management/domain";

export type RequestContext = {
  orgId: string;
  userId: string;
  role: MembershipRole;
  branchIds: string[];
  activeBranchId: string | null;
};

declare module "fastify" {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}

function requireHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name.toLowerCase()];
  if (typeof value !== "string" || value.trim() === "") {
    throw new UnauthorizedError(`Missing required header: ${name}`);
  }
  return value.trim();
}

function pathOnly(url: string): string {
  return url.split("?")[0] ?? url;
}

function isPublicAuthPath(path: string): boolean {
  if (!path.startsWith("/api/v1/auth")) return false;
  if (path === "/api/v1/auth/me") return false;
  return true;
}

function isPublicInvitePath(path: string): boolean {
  return (
    path === "/api/v1/membership-invites/accept" ||
    path === "/api/v1/membership-invites/decline"
  );
}

export type ResolveRequestContextInput = {
  orgId: string;
  userId: string;
  headerBranchId: string | null;
  findActiveByUser: (
    orgId: string,
    userId: string,
  ) => Promise<Membership | null>;
};

/** Pure helper extracted for unit tests (no Fastify boot). */
export async function resolveRequestContext(
  input: ResolveRequestContextInput,
): Promise<RequestContext> {
  const membership = await input.findActiveByUser(input.orgId, input.userId);
  if (!membership) {
    throw new UnauthorizedError("No active membership");
  }
  return {
    orgId: input.orgId,
    userId: input.userId,
    role: membership.role,
    branchIds: membership.branchIds,
    activeBranchId: resolveActiveBranch(membership, input.headerBranchId),
  };
}

export type ContextPluginOptions = {
  membershipAccess: MembershipAccessPort;
  accessTokens: AccessTokenSigner;
  /** When true, allow X-User-Id (automated tests only). */
  authStub?: boolean;
};

async function resolveUserId(
  request: FastifyRequest,
  options: ContextPluginOptions,
): Promise<string> {
  const auth = request.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedError("Missing bearer token");
    }
    const claims = await options.accessTokens.verify(token);
    return claims.sub;
  }

  if (options.authStub) {
    return requireHeader(request, "x-user-id");
  }

  throw new UnauthorizedError("Missing Authorization Bearer token");
}

export function createContextPlugin(
  options: ContextPluginOptions,
): FastifyPluginAsync {
  return fp(async (app) => {
    app.addHook("preHandler", async (request) => {
      const path = pathOnly(request.url);
      if (path === "/health") return;
      if (isPublicAuthPath(path)) return;
      if (isPublicInvitePath(path)) return;
      // /auth/me resolves identity inside the auth routes plugin.
      if (path === "/api/v1/auth/me") return;

      const userId = await resolveUserId(request, options);

      if (request.method === "POST" && path === "/api/v1/orgs") {
        request.ctx = {
          orgId: "00000000-0000-0000-0000-000000000000",
          userId,
          role: "org_admin",
          branchIds: [],
          activeBranchId: null,
        };
        return;
      }

      const orgId = requireHeader(request, "x-org-id");
      const rawBranch = request.headers["x-branch-id"];
      const headerBranchId =
        typeof rawBranch === "string" && rawBranch.trim()
          ? rawBranch.trim()
          : null;
      request.ctx = await resolveRequestContext({
        orgId,
        userId,
        headerBranchId,
        findActiveByUser: (o, u) =>
          options.membershipAccess.findActiveByUser(o, u),
      });
    });
  }, { name: "context" });
}

const testStubSigner: AccessTokenSigner = {
  async sign() {
    throw new Error("test context plugin does not sign tokens");
  },
  async verify() {
    throw new Error("test context plugin does not verify tokens");
  },
};

/** AUTH_STUB context with a custom membership resolver (route unit tests). */
export function createTestContextPluginWith(
  membershipAccess: MembershipAccessPort,
): FastifyPluginAsync {
  return createContextPlugin({
    membershipAccess,
    accessTokens: testStubSigner,
    authStub: true,
  });
}

/** HQ org_admin stub for route unit tests that do not seed memberships. */
export function createTestContextPlugin(): FastifyPluginAsync {
  return createTestContextPluginWith({
    findActiveByUser: async (orgId, userId) => ({
      id: "00000000-0000-4000-8000-ffffffffaaaa",
      orgId,
      userId,
      role: "org_admin",
      status: "active",
      branchIds: [],
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
  });
}
