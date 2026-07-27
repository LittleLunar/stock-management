import type { FastifyPluginAsync } from "fastify";
import type { MembershipInviteUseCases } from "@stock-management/application";
import { canPerform, ForbiddenError } from "@stock-management/domain";
import {
  AcceptMembershipInviteBodySchema,
  AcceptMembershipInviteResponseSchema,
  CreateMembershipInviteBodySchema,
  DeclineMembershipInviteBodySchema,
  MembershipInviteResponseSchema,
} from "@stock-management/shared";

function assertInviteAdmin(role: Parameters<typeof canPerform>[0]): void {
  if (!canPerform(role, "membership.invite")) {
    throw new ForbiddenError("Only org_admin can create membership invites");
  }
}

export function membershipInviteRoutes(
  useCases: MembershipInviteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/membership-invites", async (request, reply) => {
      assertInviteAdmin(request.ctx.role);
      const body = CreateMembershipInviteBodySchema.parse(request.body);
      const created = await useCases.createInvite({
        orgId: request.ctx.orgId,
        actorUserId: request.ctx.userId,
        actorRole: request.ctx.role,
        email: body.email,
        role: body.role,
        branchIds: body.branchIds,
      });
      return reply.status(201).send(
        MembershipInviteResponseSchema.parse({
          id: created.id,
          orgId: created.orgId,
          email: created.email,
          role: created.role,
          branchIds: created.branchIds,
          expiresAt: created.expiresAt,
        }),
      );
    });

    app.post("/membership-invites/accept", async (request, reply) => {
      const body = AcceptMembershipInviteBodySchema.parse(request.body);
      const result = await useCases.acceptInvite(body);
      return reply
        .status(201)
        .send(AcceptMembershipInviteResponseSchema.parse(result));
    });

    app.post("/membership-invites/decline", async (request, reply) => {
      const body = DeclineMembershipInviteBodySchema.parse(request.body);
      await useCases.declineInvite(body);
      return reply.status(204).send();
    });
  };
}
