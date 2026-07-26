import { z } from "zod";
import { UuidSchema } from "./enums.js";
import {
  PostIdempotencyHeadersSchema,
  PostIdempotencySchema,
} from "./costing.js";

export const SupplierInvoiceStatusSchema = z.enum([
  "draft",
  "posted",
  "voided",
]);

export const SupplierInvoiceLineInputSchema = z.object({
  productId: UuidSchema.nullable().optional(),
  lineNumber: z.number().int().positive(),
  qty: z.string().min(1),
  unitCost: z.string().min(1),
  amount: z.string().min(1),
  purchaseOrderLineId: UuidSchema,
  goodsReceiptLineId: UuidSchema,
});

export const CreateSupplierInvoiceSchema = z.object({
  supplierId: UuidSchema,
  branchId: UuidSchema.nullable().optional(),
  invoiceNumber: z.string().trim().min(1),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  externalSystem: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  lines: z.array(SupplierInvoiceLineInputSchema).min(1),
});

export const UpdateSupplierInvoiceSchema =
  CreateSupplierInvoiceSchema.partial().extend({
    lines: z.array(SupplierInvoiceLineInputSchema).min(1).optional(),
  });

export const SupplierInvoiceIdParamsSchema = z.object({ id: UuidSchema });

export const ApAgingQuerySchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export {
  PostIdempotencySchema,
  PostIdempotencyHeadersSchema,
};

export type CreateSupplierInvoice = z.infer<typeof CreateSupplierInvoiceSchema>;
export type UpdateSupplierInvoice = z.infer<typeof UpdateSupplierInvoiceSchema>;
export type SupplierInvoiceIdParams = z.infer<
  typeof SupplierInvoiceIdParamsSchema
>;
export type ApAgingQuery = z.infer<typeof ApAgingQuerySchema>;
