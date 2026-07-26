import type { DocumentStatus } from "@stock-management/domain";

export type CostRevaluationLine = {
  id: string;
  orgId: string;
  costRevaluationId: string;
  lineNumber: number;
  costLayerId: string;
  newUnitCost: string;
};

export type CostRevaluation = {
  id: string;
  orgId: string;
  branchId: string;
  reasonCode: string;
  reasonNote: string | null;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
  lines: CostRevaluationLine[];
};

export type CreateCostRevaluationInput = {
  branchId: string;
  reasonCode: string;
  reasonNote?: string | null;
  lines: Array<{ costLayerId: string; newUnitCost: string }>;
};

export type UpdateCostRevaluationInput = {
  reasonCode?: string;
  reasonNote?: string | null;
  lines?: CreateCostRevaluationInput["lines"];
};

export interface CostRevaluationPort {
  create(
    orgId: string,
    input: CreateCostRevaluationInput,
  ): Promise<CostRevaluation>;
  findById(orgId: string, id: string): Promise<CostRevaluation | null>;
  list(orgId: string): Promise<CostRevaluation[]>;
  update(
    orgId: string,
    id: string,
    input: UpdateCostRevaluationInput,
  ): Promise<CostRevaluation>;
  updateStatus(
    orgId: string,
    id: string,
    status: DocumentStatus,
    at: Date,
  ): Promise<CostRevaluation>;
}
