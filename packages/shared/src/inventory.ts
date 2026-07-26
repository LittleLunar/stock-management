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

export const GoodsReceiptLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  purchaseOrderLineId: UuidSchema.nullable().optional(),
  qty: PositiveQuantitySchema,
  unitCost: NonNegativeAmountSchema.nullable().optional(),
  lotId: UuidSchema.nullable().optional(),
  lotCode: z.string().trim().min(1).nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  lineNumber: z.number().int().positive(),
});
export type GoodsReceiptLineInput = z.infer<typeof GoodsReceiptLineInputSchema>;

export const CreateGoodsReceiptSchema = z.object({
  purchaseOrderId: UuidSchema.nullable().optional(),
  supplierId: UuidSchema.nullable().optional(),
  branchId: UuidSchema,
  locationId: UuidSchema,
  lines: z.array(GoodsReceiptLineInputSchema).min(1),
});
export type CreateGoodsReceipt = z.infer<typeof CreateGoodsReceiptSchema>;

export const UpdateGoodsReceiptSchema = CreateGoodsReceiptSchema.partial();
export type UpdateGoodsReceipt = z.infer<typeof UpdateGoodsReceiptSchema>;

export const GoodsReceiptIdParamsSchema = z.object({
  id: UuidSchema,
});
export type GoodsReceiptIdParams = z.infer<typeof GoodsReceiptIdParamsSchema>;

function requireIdempotencyPair(
  value: { external_system?: string; external_id?: string },
  ctx: z.RefinementCtx,
): void {
  if (Boolean(value.external_system) === Boolean(value.external_id)) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "external_system and external_id must be provided together",
  });
}

export const PostGoodsReceiptSchema = z
  .object({
    external_system: z.string().trim().min(1).optional(),
    external_id: z.string().trim().min(1).optional(),
  })
  .superRefine(requireIdempotencyPair);
export type PostGoodsReceipt = z.infer<typeof PostGoodsReceiptSchema>;

export const PostGoodsReceiptHeadersSchema = z
  .object({
    "x-external-system": z.string().trim().min(1).optional(),
    "x-external-id": z.string().trim().min(1).optional(),
  })
  .transform((headers) => ({
    external_system: headers["x-external-system"],
    external_id: headers["x-external-id"],
  }))
  .superRefine(requireIdempotencyPair);
export type PostGoodsReceiptHeaders = z.infer<
  typeof PostGoodsReceiptHeadersSchema
>;

export const StockIssueLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  qty: PositiveQuantitySchema,
  lotId: UuidSchema.nullable().optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  lineNumber: z.number().int().positive(),
});
export type StockIssueLineInput = z.infer<typeof StockIssueLineInputSchema>;

export const CreateStockIssueSchema = z.object({
  branchId: UuidSchema,
  locationId: UuidSchema,
  documentNumber: z.string().trim().min(1).nullable().optional(),
  issueType: z.enum(["consume", "sample", "write_off", "other"]),
  reasonNote: z.string().trim().min(1).nullable().optional(),
  lines: z.array(StockIssueLineInputSchema).min(1),
});
export type CreateStockIssue = z.infer<typeof CreateStockIssueSchema>;

export const UpdateStockIssueSchema = CreateStockIssueSchema.partial();
export type UpdateStockIssue = z.infer<typeof UpdateStockIssueSchema>;

export const StockIssueIdParamsSchema = z.object({
  id: UuidSchema,
});
export type StockIssueIdParams = z.infer<typeof StockIssueIdParamsSchema>;

export const PostStockIssueSchema = PostGoodsReceiptSchema;
export type PostStockIssue = z.infer<typeof PostStockIssueSchema>;

export const PostStockIssueHeadersSchema = PostGoodsReceiptHeadersSchema;
export type PostStockIssueHeaders = z.infer<typeof PostStockIssueHeadersSchema>;

export const StockTransferLineInputSchema = StockIssueLineInputSchema;
export type StockTransferLineInput = z.infer<
  typeof StockTransferLineInputSchema
>;

export const CreateStockTransferSchema = z.object({
  fromLocationId: UuidSchema,
  toLocationId: UuidSchema,
  transitLocationId: UuidSchema,
  documentNumber: z.string().trim().min(1).nullable().optional(),
  lines: z.array(StockTransferLineInputSchema).min(1),
});
export type CreateStockTransfer = z.infer<typeof CreateStockTransferSchema>;

export const UpdateStockTransferSchema = CreateStockTransferSchema.partial();
export type UpdateStockTransfer = z.infer<typeof UpdateStockTransferSchema>;

export const StockTransferIdParamsSchema = z.object({
  id: UuidSchema,
});
export type StockTransferIdParams = z.infer<typeof StockTransferIdParamsSchema>;

export const ShipStockTransferSchema = PostGoodsReceiptSchema;
export type ShipStockTransfer = z.infer<typeof ShipStockTransferSchema>;

export const ShipStockTransferHeadersSchema = PostGoodsReceiptHeadersSchema;
export type ShipStockTransferHeaders = z.infer<
  typeof ShipStockTransferHeadersSchema
>;

export const ReceiveStockTransferSchema = PostGoodsReceiptSchema;
export type ReceiveStockTransfer = z.infer<typeof ReceiveStockTransferSchema>;

export const ReceiveStockTransferHeadersSchema = PostGoodsReceiptHeadersSchema;
export type ReceiveStockTransferHeaders = z.infer<
  typeof ReceiveStockTransferHeadersSchema
>;

const SignedQuantitySchema = z
  .string()
  .regex(
    /^-?\d{1,14}(?:\.\d{1,4})?$/,
    "Must be a signed decimal with at most 4 places",
  )
  .refine((value) => Number(value) !== 0, "Must be non-zero");

export const StockAdjustmentLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  qty: SignedQuantitySchema,
  lotId: UuidSchema.nullable().optional(),
  unitCost: NonNegativeAmountSchema.nullable().optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  lineNumber: z.number().int().positive(),
});
export type StockAdjustmentLineInput = z.infer<
  typeof StockAdjustmentLineInputSchema
>;

export const CreateStockAdjustmentSchema = z.object({
  branchId: UuidSchema,
  locationId: UuidSchema,
  documentNumber: z.string().trim().min(1).nullable().optional(),
  reasonCode: z.string().trim().min(1),
  reasonNote: z.string().trim().min(1).nullable().optional(),
  lines: z.array(StockAdjustmentLineInputSchema).min(1),
});
export type CreateStockAdjustment = z.infer<typeof CreateStockAdjustmentSchema>;

export const UpdateStockAdjustmentSchema =
  CreateStockAdjustmentSchema.partial();
export type UpdateStockAdjustment = z.infer<typeof UpdateStockAdjustmentSchema>;

export const StockAdjustmentIdParamsSchema = z.object({
  id: UuidSchema,
});
export type StockAdjustmentIdParams = z.infer<
  typeof StockAdjustmentIdParamsSchema
>;

export const PostStockAdjustmentSchema = PostGoodsReceiptSchema;
export type PostStockAdjustment = z.infer<typeof PostStockAdjustmentSchema>;

export const PostStockAdjustmentHeadersSchema = PostGoodsReceiptHeadersSchema;
export type PostStockAdjustmentHeaders = z.infer<
  typeof PostStockAdjustmentHeadersSchema
>;

export const StockCountLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  lotId: UuidSchema.nullable().optional(),
  countedQty: NonNegativeAmountSchema.nullable(),
  unitCost: NonNegativeAmountSchema.nullable().optional(),
  lineNumber: z.number().int().positive(),
});
export type StockCountLineInput = z.infer<typeof StockCountLineInputSchema>;

export const CreateStockCountSchema = z.object({
  branchId: UuidSchema,
  locationId: UuidSchema,
  documentNumber: z.string().trim().min(1).nullable().optional(),
  lines: z.array(StockCountLineInputSchema).min(1),
});
export type CreateStockCount = z.infer<typeof CreateStockCountSchema>;

export const UpdateStockCountSchema = CreateStockCountSchema.partial();
export type UpdateStockCount = z.infer<typeof UpdateStockCountSchema>;

export const StockCountIdParamsSchema = z.object({
  id: UuidSchema,
});
export type StockCountIdParams = z.infer<typeof StockCountIdParamsSchema>;

export const PostStockCountSchema = PostGoodsReceiptSchema;
export type PostStockCount = z.infer<typeof PostStockCountSchema>;

export const PostStockCountHeadersSchema = PostGoodsReceiptHeadersSchema;
export type PostStockCountHeaders = z.infer<typeof PostStockCountHeadersSchema>;

const OptionalBooleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const StockBalancesQuerySchema = z.object({
  productId: UuidSchema.optional(),
  locationId: UuidSchema.optional(),
  lowStock: OptionalBooleanQuerySchema,
});
export type StockBalancesQuery = z.infer<typeof StockBalancesQuerySchema>;

export const StockMovementsQuerySchema = z.object({
  productId: UuidSchema.optional(),
  locationId: UuidSchema.optional(),
});
export type StockMovementsQuery = z.infer<typeof StockMovementsQuerySchema>;

export const StockTrackingQuerySchema = z.object({
  productId: UuidSchema.optional(),
});
export type StockTrackingQuery = z.infer<typeof StockTrackingQuerySchema>;

export const CostLayersQuerySchema = z.object({
  productId: UuidSchema.optional(),
  locationId: UuidSchema.optional(),
});
export type CostLayersQuery = z.infer<typeof CostLayersQuerySchema>;

export const CostLayerSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema,
  locationId: UuidSchema,
  lotId: UuidSchema.nullable(),
  receivedAt: z.string().datetime(),
  unitCost: z.string(),
  qtyOriginal: z.string(),
  qtyRemaining: z.string(),
  sourceDocumentType: z.string(),
  sourceDocumentId: UuidSchema,
});
export type CostLayerResponse = z.infer<typeof CostLayerSchema>;

export const CreateReservationSchema = z
  .object({
    branchId: UuidSchema,
    productId: UuidSchema,
    locationId: UuidSchema,
    qty: PositiveQuantitySchema,
    lotId: UuidSchema.nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    externalSystem: z.string().trim().min(1).nullable().optional(),
    externalId: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.externalSystem) === Boolean(value.externalId)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "externalSystem and externalId must be provided together",
    });
  });
export type CreateReservation = z.infer<typeof CreateReservationSchema>;

export const ReservationIdParamsSchema = z.object({
  id: UuidSchema,
});
export type ReservationIdParams = z.infer<typeof ReservationIdParamsSchema>;

export const ReservationsQuerySchema = z.object({
  productId: UuidSchema.optional(),
  locationId: UuidSchema.optional(),
  branchId: UuidSchema.optional(),
  status: z.enum(["open", "committed", "released"]).optional(),
});
export type ReservationsQuery = z.infer<typeof ReservationsQuerySchema>;

export const AvailabilityQuerySchema = z.object({
  productId: UuidSchema,
  branchId: UuidSchema,
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

export const AvailabilityResponseSchema = z.object({
  onHand: z.string(),
  reserved: z.string(),
  available: z.string(),
});
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;

export const SupplierReturnLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  qty: PositiveQuantitySchema,
  lotId: UuidSchema.nullable().optional(),
  goodsReceiptLineId: UuidSchema.nullable().optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  lineNumber: z.number().int().positive(),
});
export type SupplierReturnLineInput = z.infer<
  typeof SupplierReturnLineInputSchema
>;

const SupplierReturnFieldsSchema = z.object({
  branchId: UuidSchema,
  locationId: UuidSchema,
  supplierId: UuidSchema,
  goodsReceiptId: UuidSchema.nullable().optional(),
  documentNumber: z.string().trim().min(1).nullable().optional(),
  externalSystem: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  lines: z.array(SupplierReturnLineInputSchema).min(1),
});

export const CreateSupplierReturnSchema = SupplierReturnFieldsSchema.superRefine(
  (value, ctx) => {
    if (Boolean(value.externalSystem) === Boolean(value.externalId)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "externalSystem and externalId must be provided together",
    });
  },
);
export type CreateSupplierReturn = z.infer<typeof CreateSupplierReturnSchema>;

export const UpdateSupplierReturnSchema = SupplierReturnFieldsSchema.partial();
export type UpdateSupplierReturn = z.infer<typeof UpdateSupplierReturnSchema>;

export const SupplierReturnIdParamsSchema = z.object({
  id: UuidSchema,
});
export type SupplierReturnIdParams = z.infer<
  typeof SupplierReturnIdParamsSchema
>;

export const PostSupplierReturnSchema = PostGoodsReceiptSchema;
export type PostSupplierReturn = z.infer<typeof PostSupplierReturnSchema>;

export const PostSupplierReturnHeadersSchema = PostGoodsReceiptHeadersSchema;
export type PostSupplierReturnHeaders = z.infer<
  typeof PostSupplierReturnHeadersSchema
>;

export const CustomerReturnLineInputSchema = z.object({
  id: UuidSchema.optional(),
  productId: UuidSchema,
  qty: PositiveQuantitySchema,
  lotId: UuidSchema.nullable().optional(),
  unitCost: NonNegativeAmountSchema.nullable().optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  lineNumber: z.number().int().positive(),
});
export type CustomerReturnLineInput = z.infer<
  typeof CustomerReturnLineInputSchema
>;

const CustomerReturnFieldsSchema = z.object({
  branchId: UuidSchema,
  locationId: UuidSchema,
  customerId: UuidSchema,
  documentNumber: z.string().trim().min(1).nullable().optional(),
  externalSystem: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  lines: z.array(CustomerReturnLineInputSchema).min(1),
});

export const CreateCustomerReturnSchema = CustomerReturnFieldsSchema.superRefine(
  (value, ctx) => {
    if (Boolean(value.externalSystem) === Boolean(value.externalId)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "externalSystem and externalId must be provided together",
    });
  },
);
export type CreateCustomerReturn = z.infer<typeof CreateCustomerReturnSchema>;

export const UpdateCustomerReturnSchema = CustomerReturnFieldsSchema.partial();
export type UpdateCustomerReturn = z.infer<typeof UpdateCustomerReturnSchema>;

export const CustomerReturnIdParamsSchema = z.object({
  id: UuidSchema,
});
export type CustomerReturnIdParams = z.infer<
  typeof CustomerReturnIdParamsSchema
>;

export const PostCustomerReturnSchema = PostGoodsReceiptSchema;
export type PostCustomerReturn = z.infer<typeof PostCustomerReturnSchema>;

export const PostCustomerReturnHeadersSchema = PostGoodsReceiptHeadersSchema;
export type PostCustomerReturnHeaders = z.infer<
  typeof PostCustomerReturnHeadersSchema
>;
