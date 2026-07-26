import { z } from "zod";

export const LandedCostTypeSchema = z.enum(["freight", "duty", "other"]);

export const CreateLandedCostSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  costType: LandedCostTypeSchema,
  totalAmount: z.string(),
  lines: z
    .array(
      z.object({
        goodsReceiptLineId: z.string().uuid().nullable().optional(),
        costLayerId: z.string().uuid().nullable().optional(),
        amount: z.string(),
      }),
    )
    .min(1),
});
export type CreateLandedCost = z.infer<typeof CreateLandedCostSchema>;

export const UpdateLandedCostSchema = CreateLandedCostSchema.partial().omit({
  branchId: true,
});
export type UpdateLandedCost = z.infer<typeof UpdateLandedCostSchema>;

export const LandedCostIdParamsSchema = z.object({ id: z.string().uuid() });

export const PostIdempotencySchema = z.object({
  external_system: z.string().min(1).optional(),
  external_id: z.string().min(1).optional(),
});

export const PostIdempotencyHeadersSchema = z.object({
  external_system: z.string().min(1).optional(),
  external_id: z.string().min(1).optional(),
});

export const CreateCostRevaluationSchema = z.object({
  branchId: z.string().uuid(),
  reasonCode: z.string().min(1),
  reasonNote: z.string().nullable().optional(),
  lines: z
    .array(
      z.object({
        costLayerId: z.string().uuid(),
        newUnitCost: z.string(),
      }),
    )
    .min(1),
});
export type CreateCostRevaluation = z.infer<typeof CreateCostRevaluationSchema>;

export const UpdateCostRevaluationSchema = CreateCostRevaluationSchema.partial().omit(
  { branchId: true },
);
export type UpdateCostRevaluation = z.infer<typeof UpdateCostRevaluationSchema>;

export const CostRevaluationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ValuationQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
  branchId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

export const CogsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  branchId: z.string().uuid().optional(),
});

export const CostSummariesQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});
