import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AccountMappingMissingError,
  AccountingPeriodMissingError,
  AllocationMismatchError,
  ConflictError,
  DomainError,
  ForbiddenError,
  InsufficientCostError,
  InsufficientStockError,
  InvoiceAlreadyVoidedError,
  InvoiceNotDraftError,
  InvoiceNotPostedError,
  LayerInUseError,
  MissingUnitCostError,
  NotFoundError,
  PeriodClosedError,
  ThreeWayMatchError,
  UnauthorizedError,
  UnbalancedJournalError,
  UnsupportedCostingMethodError,
} from "@stock-management/domain";
import type { ErrorEnvelope } from "@stock-management/shared";
import { ZodError } from "zod";
import { AppError } from "../../infrastructure/lib/errors.js";

function envelope(
  request: FastifyRequest,
  code: string,
  message: string,
  details?: unknown,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId: request.requestId ?? "unknown",
    },
  };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply: FastifyReply) => {
    if (error instanceof NotFoundError) {
      return reply
        .status(404)
        .send(envelope(request, error.code, error.message));
    }

    if (error instanceof UnauthorizedError) {
      return reply
        .status(401)
        .send(envelope(request, error.code, error.message));
    }

    if (error instanceof ForbiddenError) {
      return reply
        .status(403)
        .send(envelope(request, error.code, error.message));
    }

    if (
      error instanceof ConflictError ||
      error instanceof LayerInUseError ||
      error instanceof PeriodClosedError ||
      error instanceof InvoiceNotDraftError ||
      error instanceof InvoiceNotPostedError ||
      error instanceof InvoiceAlreadyVoidedError
    ) {
      return reply
        .status(409)
        .send(envelope(request, error.code, error.message));
    }

    if (
      error instanceof InsufficientStockError ||
      error instanceof InsufficientCostError ||
      error instanceof MissingUnitCostError ||
      error instanceof UnsupportedCostingMethodError ||
      error instanceof AllocationMismatchError ||
      error instanceof AccountMappingMissingError ||
      error instanceof AccountingPeriodMissingError ||
      error instanceof ThreeWayMatchError
    ) {
      return reply
        .status(400)
        .send(envelope(request, error.code, error.message));
    }

    if (error instanceof UnbalancedJournalError) {
      return reply
        .status(500)
        .send(envelope(request, error.code, error.message));
    }

    if (error instanceof DomainError) {
      return reply
        .status(400)
        .send(envelope(request, error.code || "DOMAIN_ERROR", error.message));
    }

    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(envelope(request, error.code, error.message));
    }

    if (error instanceof ZodError) {
      return reply.status(400).send(
        envelope(request, "VALIDATION_ERROR", "Request validation failed", {
          ...error.flatten(),
        }),
      );
    }

    request.log.error({ err: error }, "Unhandled error");
    return reply
      .status(500)
      .send(envelope(request, "INTERNAL_ERROR", "Internal server error"));
  });
}
