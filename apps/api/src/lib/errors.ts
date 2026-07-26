export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(entity: string): AppError {
  return new AppError(`${entity} not found`, 404, "NOT_FOUND");
}

export function badRequest(message: string, code = "BAD_REQUEST"): AppError {
  return new AppError(message, 400, code);
}

export function unauthorized(message = "Unauthorized"): AppError {
  return new AppError(message, 401, "UNAUTHORIZED");
}
