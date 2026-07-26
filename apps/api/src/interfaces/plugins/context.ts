import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { MembershipAccessPort } from "@stock-management/application";
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

export function createContextPlugin(
  membershipAccess: MembershipAccessPort,
): FastifyPluginAsync {
  return fp(async (app) => {
    app.addHook("preHandler", async (request) => {
      const path = request.url.split("?")[0] ?? request.url;
      if (path === "/health") return;
      if (request.method === "POST" && path === "/api/v1/orgs") {
        request.ctx = {
          orgId: "00000000-0000-0000-0000-000000000000",
          userId: requireHeader(request, "x-user-id"),
          role: "org_admin",
          branchIds: [],
          activeBranchId: null,
        };
        return;
      }
      const orgId = requireHeader(request, "x-org-id");
      const userId = requireHeader(request, "x-user-id");
      const rawBranch = request.headers["x-branch-id"];
      const headerBranchId =
        typeof rawBranch === "string" && rawBranch.trim()
          ? rawBranch.trim()
          : null;
      request.ctx = await resolveRequestContext({
        orgId,
        userId,
        headerBranchId,
        findActiveByUser: (o, u) => membershipAccess.findActiveByUser(o, u),
      });
    });
  }, { name: "context" });
}

/** HQ org_admin stub for route unit tests that do not seed memberships. */
export function createTestContextPlugin(): FastifyPluginAsync {
  return createContextPlugin({
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
