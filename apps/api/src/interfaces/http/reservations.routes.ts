import type { FastifyPluginAsync } from "fastify";
import type {
  CommitReservation,
  ReleaseReservation,
  ReservationUseCases,
} from "@stock-management/application";
import {
  CreateReservationSchema,
  ReservationIdParamsSchema,
  ReservationsQuerySchema,
} from "@stock-management/shared";

export type ReservationRouteUseCases = {
  reservations: ReservationUseCases;
  releaseReservation: ReleaseReservation;
  commitReservation: CommitReservation;
};

export function reservationsRoutes(
  useCases: ReservationRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/reservations", async (request) => {
      const query = ReservationsQuerySchema.parse(request.query);
      return useCases.reservations.list(request.ctx.orgId, query);
    });

    app.get<{ Params: { id: string } }>(
      "/reservations/:id",
      async (request) => {
        const { id } = ReservationIdParamsSchema.parse(request.params);
        return useCases.reservations.get(request.ctx.orgId, id);
      },
    );

    app.post("/reservations", async (request) => {
      const body = CreateReservationSchema.parse(request.body);
      return useCases.reservations.create(request.ctx.orgId, body);
    });

    app.post<{ Params: { id: string } }>(
      "/reservations/:id/release",
      async (request) => {
        const { id } = ReservationIdParamsSchema.parse(request.params);
        return useCases.releaseReservation.execute(request.ctx.orgId, id);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/reservations/:id/commit",
      async (request) => {
        const { id } = ReservationIdParamsSchema.parse(request.params);
        return useCases.commitReservation.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
        );
      },
    );
  };
}
