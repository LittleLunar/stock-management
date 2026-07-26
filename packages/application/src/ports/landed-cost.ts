import type { DocumentStatus } from "@stock-management/domain";

export type LandedCostType = "freight" | "duty" | "other";

export type LandedCostLine = {
  id: string;
  orgId: string;
  landedCostDocumentId: string;
  lineNumber: number;
  goodsReceiptLineId: string | null;
  costLayerId: string | null;
  amount: string;
};

export type LandedCostDocument = {
  id: string;
  orgId: string;
  branchId: string;
  supplierId: string | null;
  costType: LandedCostType;
  totalAmount: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
  lines: LandedCostLine[];
};

export type CreateLandedCostInput = {
  branchId: string;
  supplierId?: string | null;
  costType: LandedCostType;
  totalAmount: string;
  lines: Array<{
    goodsReceiptLineId?: string | null;
    costLayerId?: string | null;
    amount: string;
  }>;
};

export type UpdateLandedCostInput = {
  supplierId?: string | null;
  costType?: LandedCostType;
  totalAmount?: string;
  lines?: CreateLandedCostInput["lines"];
};

export interface LandedCostPort {
  create(orgId: string, input: CreateLandedCostInput): Promise<LandedCostDocument>;
  findById(orgId: string, id: string): Promise<LandedCostDocument | null>;
  list(orgId: string): Promise<LandedCostDocument[]>;
  update(
    orgId: string,
    id: string,
    input: UpdateLandedCostInput,
  ): Promise<LandedCostDocument>;
  updateStatus(
    orgId: string,
    id: string,
    status: DocumentStatus,
    at: Date,
  ): Promise<LandedCostDocument>;
}
