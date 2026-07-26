import { z } from "zod";

export {
  MasterStatusSchema,
  LocationTypeSchema,
  MembershipRoleSchema,
  CostingMethodSchema,
  PoStatusSchema,
  DocumentStatusSchema,
  UuidSchema,
  type MasterStatus,
  type LocationType,
  type MembershipRole,
  type CostingMethod,
  type PoStatus,
  type DocumentStatus,
} from "./enums.js";

export {
  ErrorCodeSchema,
  ErrorBodySchema,
  ErrorEnvelopeSchema,
  isErrorEnvelope,
  type ErrorCode,
  type ErrorBody,
  type ErrorEnvelope,
} from "./errors.js";

export {
  OrganizationSchema,
  BranchSchema,
  LocationSchema,
  ProductSchema,
  SupplierSchema,
  CustomerSchema,
  CreateOrganizationSchema,
  type Organization,
  type Branch,
  type Location,
  type Product,
  type Supplier,
  type Customer,
  type CreateOrganization,
} from "./entities.js";

export {
  PurchaseOrderLineInputSchema,
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  PurchaseOrderIdParamsSchema,
  GoodsReceiptLineInputSchema,
  CreateGoodsReceiptSchema,
  UpdateGoodsReceiptSchema,
  GoodsReceiptIdParamsSchema,
  PostGoodsReceiptSchema,
  PostGoodsReceiptHeadersSchema,
  StockIssueLineInputSchema,
  CreateStockIssueSchema,
  UpdateStockIssueSchema,
  StockIssueIdParamsSchema,
  PostStockIssueSchema,
  PostStockIssueHeadersSchema,
  StockTransferLineInputSchema,
  CreateStockTransferSchema,
  UpdateStockTransferSchema,
  StockTransferIdParamsSchema,
  ShipStockTransferSchema,
  ShipStockTransferHeadersSchema,
  ReceiveStockTransferSchema,
  ReceiveStockTransferHeadersSchema,
  StockAdjustmentLineInputSchema,
  CreateStockAdjustmentSchema,
  UpdateStockAdjustmentSchema,
  StockAdjustmentIdParamsSchema,
  PostStockAdjustmentSchema,
  PostStockAdjustmentHeadersSchema,
  StockCountLineInputSchema,
  CreateStockCountSchema,
  UpdateStockCountSchema,
  StockCountIdParamsSchema,
  PostStockCountSchema,
  PostStockCountHeadersSchema,
  StockBalancesQuerySchema,
  StockMovementsQuerySchema,
  StockTrackingQuerySchema,
  CostLayersQuerySchema,
  CostLayerSchema,
  CreateReservationSchema,
  ReservationIdParamsSchema,
  ReservationsQuerySchema,
  AvailabilityQuerySchema,
  AvailabilityResponseSchema,
  SupplierReturnLineInputSchema,
  CreateSupplierReturnSchema,
  UpdateSupplierReturnSchema,
  SupplierReturnIdParamsSchema,
  PostSupplierReturnSchema,
  PostSupplierReturnHeadersSchema,
  CustomerReturnLineInputSchema,
  CreateCustomerReturnSchema,
  UpdateCustomerReturnSchema,
  CustomerReturnIdParamsSchema,
  PostCustomerReturnSchema,
  PostCustomerReturnHeadersSchema,
  type PurchaseOrderLineInput,
  type CreatePurchaseOrder,
  type UpdatePurchaseOrder,
  type PurchaseOrderIdParams,
  type GoodsReceiptLineInput,
  type CreateGoodsReceipt,
  type UpdateGoodsReceipt,
  type GoodsReceiptIdParams,
  type PostGoodsReceipt,
  type PostGoodsReceiptHeaders,
  type StockIssueLineInput,
  type CreateStockIssue,
  type UpdateStockIssue,
  type StockIssueIdParams,
  type PostStockIssue,
  type PostStockIssueHeaders,
  type StockTransferLineInput,
  type CreateStockTransfer,
  type UpdateStockTransfer,
  type StockTransferIdParams,
  type ShipStockTransfer,
  type ShipStockTransferHeaders,
  type ReceiveStockTransfer,
  type ReceiveStockTransferHeaders,
  type StockAdjustmentLineInput,
  type CreateStockAdjustment,
  type UpdateStockAdjustment,
  type StockAdjustmentIdParams,
  type PostStockAdjustment,
  type PostStockAdjustmentHeaders,
  type StockCountLineInput,
  type CreateStockCount,
  type UpdateStockCount,
  type StockCountIdParams,
  type PostStockCount,
  type PostStockCountHeaders,
  type StockBalancesQuery,
  type StockMovementsQuery,
  type StockTrackingQuery,
  type CostLayersQuery,
  type CostLayerResponse,
  type CreateReservation,
  type ReservationIdParams,
  type ReservationsQuery,
  type AvailabilityQuery,
  type AvailabilityResponse,
  type SupplierReturnLineInput,
  type CreateSupplierReturn,
  type UpdateSupplierReturn,
  type SupplierReturnIdParams,
  type PostSupplierReturn,
  type PostSupplierReturnHeaders,
  type CustomerReturnLineInput,
  type CreateCustomerReturn,
  type UpdateCustomerReturn,
  type CustomerReturnIdParams,
  type PostCustomerReturn,
  type PostCustomerReturnHeaders,
} from "./inventory.js";

import {
  CostingMethodSchema,
  LocationTypeSchema,
  MasterStatusSchema,
  MembershipRoleSchema,
  UuidSchema,
} from "./enums.js";

export const CreateBranchSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  status: MasterStatusSchema.optional(),
});
export type CreateBranch = z.infer<typeof CreateBranchSchema>;

export const UpdateBranchSchema = z.object({
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(256).optional(),
  status: MasterStatusSchema.optional(),
});
export type UpdateBranch = z.infer<typeof UpdateBranchSchema>;

export const CreateLocationSchema = z.object({
  branchId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  type: LocationTypeSchema.optional(),
  status: MasterStatusSchema.optional(),
});
export type CreateLocation = z.infer<typeof CreateLocationSchema>;

export const UpdateLocationSchema = z.object({
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(256).optional(),
  type: LocationTypeSchema.optional(),
  status: MasterStatusSchema.optional(),
});
export type UpdateLocation = z.infer<typeof UpdateLocationSchema>;

export const CreateCategorySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  status: MasterStatusSchema.optional(),
});
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  uom: z.string().min(1).max(32).optional(),
  categoryId: UuidSchema.nullable().optional(),
  trackLot: z.boolean().optional(),
  trackSerial: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  costingMethod: CostingMethodSchema.optional(),
  reorderMin: z.string().nullable().optional(),
  reorderMax: z.string().nullable().optional(),
  status: MasterStatusSchema.optional(),
  barcodes: z.array(z.string().min(1)).optional(),
});
export type CreateProduct = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.omit({
  barcodes: true,
}).partial();
export type UpdateProduct = z.infer<typeof UpdateProductSchema>;

export const CreateSupplierSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  status: MasterStatusSchema.optional(),
});
export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = CreateSupplierSchema.partial();
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;

export const CreateCustomerSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  status: MasterStatusSchema.optional(),
});
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>;

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().min(1).max(64).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  status: MasterStatusSchema.optional(),
});
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(256),
  status: MasterStatusSchema.optional(),
});
export type CreateUser = z.infer<typeof CreateUserSchema>;

export const CreateMembershipSchema = z.object({
  userId: UuidSchema,
  role: MembershipRoleSchema,
  branchIds: z.array(UuidSchema).optional(),
  status: MasterStatusSchema.optional(),
});
export type CreateMembership = z.infer<typeof CreateMembershipSchema>;

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export {
  LandedCostTypeSchema,
  CreateLandedCostSchema,
  UpdateLandedCostSchema,
  LandedCostIdParamsSchema,
  PostIdempotencySchema,
  PostIdempotencyHeadersSchema,
  CreateCostRevaluationSchema,
  UpdateCostRevaluationSchema,
  CostRevaluationIdParamsSchema,
  ValuationQuerySchema,
  CogsQuerySchema,
  CostSummariesQuerySchema,
  type CreateLandedCost,
  type UpdateLandedCost,
  type CreateCostRevaluation,
  type UpdateCostRevaluation,
} from "./costing.js";

export {
  AccountTypeSchema,
  AccountSchema,
  CreateAccountBodySchema,
  PatchAccountBodySchema,
  UpsertMappingBodySchema,
  GeneratePeriodsBodySchema,
  JournalsQuerySchema,
  JournalLineSchema,
  JournalSchema,
  type CreateAccountBody,
  type PatchAccountBody,
  type UpsertMappingBody,
  type GeneratePeriodsBody,
  type JournalsQuery,
} from "./accounting.js";
