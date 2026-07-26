export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} not found`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_STATE");
    this.name = "InvalidStateError";
  }
}

export class InsufficientStockError extends DomainError {
  constructor(message: string) {
    super(message, "INSUFFICIENT_STOCK");
    this.name = "InsufficientStockError";
  }
}

export class TrackingRequiredError extends DomainError {
  constructor(message: string) {
    super(message, "TRACKING_REQUIRED");
    this.name = "TrackingRequiredError";
  }
}

export class OverReceiveError extends DomainError {
  constructor(message: string) {
    super(message, "OVER_RECEIVE");
    this.name = "OverReceiveError";
  }
}
