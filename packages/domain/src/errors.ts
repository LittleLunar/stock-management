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

export class InsufficientAvailabilityError extends DomainError {
  constructor(message: string) {
    super(message, "INSUFFICIENT_AVAILABILITY");
    this.name = "InsufficientAvailabilityError";
  }
}

export class MissingUnitCostError extends DomainError {
  constructor(message = "Unit cost is required") {
    super(message, "MISSING_UNIT_COST");
    this.name = "MissingUnitCostError";
  }
}

export class UnsupportedCostingMethodError extends DomainError {
  constructor(message = "Only FIFO costing is supported") {
    super(message, "UNSUPPORTED_COSTING_METHOD");
    this.name = "UnsupportedCostingMethodError";
  }
}

export class InsufficientCostError extends DomainError {
  constructor(message = "Insufficient open cost layer quantity") {
    super(message, "INSUFFICIENT_COST");
    this.name = "InsufficientCostError";
  }
}

export class LayerInUseError extends DomainError {
  constructor(message = "Cost layer has been partially consumed") {
    super(message, "LAYER_IN_USE");
    this.name = "LayerInUseError";
  }
}

export class AllocationMismatchError extends DomainError {
  constructor(message = "Allocated line amounts do not sum to total") {
    super(message, "ALLOCATION_MISMATCH");
    this.name = "AllocationMismatchError";
  }
}
