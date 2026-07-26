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

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenError";
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

export class UnbalancedJournalError extends DomainError {
  constructor(message = "Journal lines are not balanced") {
    super(message, "UNBALANCED_JOURNAL");
    this.name = "UnbalancedJournalError";
  }
}

export class PeriodClosedError extends DomainError {
  constructor(message = "Accounting period is closed") {
    super(message, "PERIOD_CLOSED");
    this.name = "PeriodClosedError";
  }
}

export class AccountMappingMissingError extends DomainError {
  constructor(journalEventType: string) {
    super(
      `Account mapping missing for ${journalEventType}`,
      "ACCOUNT_MAPPING_MISSING",
    );
    this.name = "AccountMappingMissingError";
  }
}

export class AccountingPeriodMissingError extends DomainError {
  constructor(onDate: string) {
    super(
      `No accounting period covers date ${onDate}`,
      "ACCOUNTING_PERIOD_MISSING",
    );
    this.name = "AccountingPeriodMissingError";
  }
}

export class ThreeWayMatchError extends DomainError {
  constructor(message: string) {
    super(message, "THREE_WAY_MATCH");
    this.name = "ThreeWayMatchError";
  }
}

export class InvoiceNotDraftError extends DomainError {
  constructor(message = "Invoice is not in draft status") {
    super(message, "INVALID_STATE");
    this.name = "InvoiceNotDraftError";
  }
}

export class InvoiceNotPostedError extends DomainError {
  constructor(message = "Invoice is not posted") {
    super(message, "INVALID_STATE");
    this.name = "InvoiceNotPostedError";
  }
}

export class InvoiceAlreadyVoidedError extends DomainError {
  constructor(message = "Invoice is already voided") {
    super(message, "INVALID_STATE");
    this.name = "InvoiceAlreadyVoidedError";
  }
}
