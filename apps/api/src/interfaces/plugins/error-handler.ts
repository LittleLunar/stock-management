import type { FastifyInstance } from "fastify";
import {
  DomainError,
  NotFoundError,
  UnauthorizedError,
} from "@stock-management/domain";
import { ZodError } from "zod";
import { AppError } from "../../infrastructure/lib/errors.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (error instanceof DomainError) {
      return reply.status(400).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
        },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });
}
