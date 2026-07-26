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

export function badRequest(message: string, code = "BAD_REQUEST"): AppError {
  return new AppError(message, 400, code);
}
