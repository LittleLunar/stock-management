import { z } from "zod";
import { UuidSchema } from "./enums.js";

const PositiveQuantitySchema = z
  .string()
  .regex(
    /^\d{1,14}(?:\.\d{1,4})?$/,
    "Must be a positive decimal with at most 4 places",
  )
  .refine((value) => Number(value) > 0, "Must be greater than zero");

const NonNegativeAmountSchema = z
  .string()
  .regex(
    /^\d{1,14}(?:\.\d{1,4})?$/,
    "Must be a non-negative decimal with at most 4 places",
  );

export const PurchaseOrderLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  orderedQty: PositiveQuantitySchema,
  unitCost: NonNegativeAmountSchema.nullable().optional(),
  lineNumber: z.number().int().positive(),
});
export type PurchaseOrderLineInput = z.infer<
  typeof PurchaseOrderLineInputSchema
>;

export const CreatePurchaseOrderSchema = z.object({
  supplierId: UuidSchema,
  branchId: UuidSchema,
  documentNumber: z.string().trim().min(1).nullable().optional(),
  expectedDate: z.coerce.date().nullable().optional(),
  lines: z.array(PurchaseOrderLineInputSchema).min(1),
});
export type CreatePurchaseOrder = z.infer<typeof CreatePurchaseOrderSchema>;

export const UpdatePurchaseOrderSchema = CreatePurchaseOrderSchema.partial();
export type UpdatePurchaseOrder = z.infer<typeof UpdatePurchaseOrderSchema>;

export const PurchaseOrderIdParamsSchema = z.object({
  id: UuidSchema,
});
export type PurchaseOrderIdParams = z.infer<typeof PurchaseOrderIdParamsSchema>;
