import {
  type AvailabilityQuery,
  type AvailabilityResponse,
  type Branch,
  type CreateBranch,
  type CreateCustomer,
  type CreateCustomerReturn,
  type CreateGoodsReceipt,
  type CreateLandedCost,
  type CreateLocation,
  type CreateCostRevaluation,
  type CreateOrganization,
  type CreateProduct,
  type CreatePurchaseOrder,
  type CreateReservation,
  type CreateStockAdjustment,
  type CreateStockCount,
  type CreateStockIssue,
  type CreateStockTransfer,
  type CreateSupplier,
  type CreateSupplierReturn,
  type Customer,
  type CustomerReturnLineInput,
  type GoodsReceiptLineInput,
  type Location,
  type Organization,
  type PostCustomerReturn,
  type PostGoodsReceipt,
  type PostStockAdjustment,
  type PostStockCount,
  type PostStockIssue,
  type PostSupplierReturn,
  type Product,
  type PurchaseOrderLineInput,
  type ReceiveStockTransfer,
  type ReservationsQuery,
  type ShipStockTransfer,
  type StockAdjustmentLineInput,
  type StockBalancesQuery,
  type StockCountLineInput,
  type StockIssueLineInput,
  type StockMovementsQuery,
  type StockTransferLineInput,
  type Supplier,
  type SupplierReturnLineInput,
  type UpdateStockCount,
} from "@stock-management/shared";
import { env } from "../lib/env";
import { parseApiError } from "../lib/errors";

export type ApiHeaders = {
  orgId: string;
  userId: string;
  branchId?: string; // when set → X-Branch-Id
};

export type PurchaseOrder = {
  id: string;
  orgId: string;
  supplierId: string;
  branchId: string;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "partially_received"
    | "received"
    | "closed"
    | "cancelled";
  documentNumber: string | null;
  expectedDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderLine = Omit<
  PurchaseOrderLineInput,
  "id" | "unitCost"
> & {
  id: string;
  orgId: string;
  purchaseOrderId: string;
  receivedQty: string;
  unitCost: string | null;
};

export type PurchaseOrderWithLines = PurchaseOrder & {
  lines: PurchaseOrderLine[];
};

export type GoodsReceipt = {
  id: string;
  orgId: string;
  purchaseOrderId: string | null;
  supplierId: string | null;
  branchId: string;
  locationId: string;
  status: "draft" | "posted" | "void";
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  voidedAt: string | null;
};

export type GoodsReceiptLine = Omit<
  GoodsReceiptLineInput,
  "id" | "unitCost" | "lotId" | "expiryDate"
> & {
  id: string;
  orgId: string;
  goodsReceiptId: string;
  unitCost: string | null;
  lotId: string | null;
  lotCode?: string | null;
  expiryDate?: string | null;
  serialNumbers: string[];
};

export type GoodsReceiptWithLines = GoodsReceipt & {
  lines: GoodsReceiptLine[];
};

export type StockBalance = {
  id: string;
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  qtyOnHand: string;
  qtyReserved: string;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  orgId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  documentType: string;
  documentId: string;
  documentLineId: string | null;
  movementType: string;
  qty: string;
  createdAt: string;
};

export type StockIssue = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  documentNumber: string | null;
  issueType: "consume" | "sample" | "write_off" | "other";
  reasonNote: string | null;
  status: "draft" | "posted" | "void";
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  voidedAt: string | null;
};

export type StockIssueLine = Omit<
  StockIssueLineInput,
  "id" | "serialNumbers"
> & {
  id: string;
  orgId: string;
  stockIssueId: string;
  lotId: string | null;
  serialNumbers: string[];
};

export type StockIssueWithLines = StockIssue & {
  lines: StockIssueLine[];
};

export type StockIssueActionResult = {
  issue: StockIssue;
  movements: StockMovement[];
};

export type StockTransfer = {
  id: string;
  orgId: string;
  fromLocationId: string;
  toLocationId: string;
  transitLocationId: string;
  fromBranchId: string;
  toBranchId: string;
  purpose: "standard" | "replenishment";
  documentNumber: string | null;
  status: "draft" | "in_transit" | "received" | "void";
  createdAt: string;
  updatedAt: string;
  shippedAt: string | null;
  receivedAt: string | null;
  voidedAt: string | null;
};

export type StockTransferLine = Omit<
  StockTransferLineInput,
  "id" | "serialNumbers"
> & {
  id: string;
  orgId: string;
  stockTransferId: string;
  lotId: string | null;
  serialNumbers: string[];
};

export type StockTransferWithLines = StockTransfer & {
  lines: StockTransferLine[];
};

export type StockTransferActionResult = {
  transfer: StockTransfer;
  movements: StockMovement[];
};

export type StockAdjustment = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  documentNumber: string | null;
  reasonCode: string;
  reasonNote: string | null;
  status: "draft" | "pending_approval" | "approved" | "posted" | "void";
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  voidedAt: string | null;
};

export type ApprovalPolicy = {
  id: string;
  orgId: string;
  documentType: "purchase_order" | "stock_adjustment";
  required: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockAdjustmentLine = Omit<
  StockAdjustmentLineInput,
  "id" | "serialNumbers"
> & {
  id: string;
  orgId: string;
  stockAdjustmentId: string;
  lotId: string | null;
  serialNumbers: string[];
};

export type StockAdjustmentWithLines = StockAdjustment & {
  lines: StockAdjustmentLine[];
};

export type StockAdjustmentActionResult = {
  adjustment: StockAdjustment;
  movements: StockMovement[];
};

export type StockCount = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  documentNumber: string | null;
  status: "draft" | "posted" | "void";
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  voidedAt: string | null;
};

export type StockCountLine = Omit<StockCountLineInput, "id"> & {
  id: string;
  orgId: string;
  stockCountId: string;
  lotId: string | null;
  expectedQty: string;
  countedQty: string | null;
};

export type StockCountWithLines = StockCount & {
  lines: StockCountLine[];
};

export type StockCountActionResult = {
  count: StockCount;
  movements: StockMovement[];
};

export type StockReservation = {
  id: string;
  orgId: string;
  branchId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  qty: string;
  status: "open" | "committed" | "released";
  expiresAt: string | null;
  externalSystem: string | null;
  externalId: string | null;
  committedIssueId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommitReservationResult = {
  reservation: StockReservation;
  issue: StockIssueWithLines;
  movements: StockMovement[];
};

export type SupplierReturn = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  supplierId: string;
  goodsReceiptId: string | null;
  documentNumber: string | null;
  status: "draft" | "posted" | "void";
  externalSystem: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  voidedAt: string | null;
};

export type SupplierReturnLine = Omit<
  SupplierReturnLineInput,
  "id" | "serialNumbers"
> & {
  id: string;
  orgId: string;
  supplierReturnId: string;
  lotId: string | null;
  serialNumbers: string[];
};

export type SupplierReturnWithLines = SupplierReturn & {
  lines: SupplierReturnLine[];
};

export type SupplierReturnActionResult = {
  doc: SupplierReturn;
  movements: StockMovement[];
};

export type CustomerReturn = {
  id: string;
  orgId: string;
  branchId: string;
  locationId: string;
  customerId: string;
  documentNumber: string | null;
  status: "draft" | "posted" | "void";
  externalSystem: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  voidedAt: string | null;
};

export type CustomerReturnLine = Omit<
  CustomerReturnLineInput,
  "id" | "serialNumbers"
> & {
  id: string;
  orgId: string;
  customerReturnId: string;
  lotId: string | null;
  serialNumbers: string[];
};

export type CustomerReturnWithLines = CustomerReturn & {
  lines: CustomerReturnLine[];
};

export type CustomerReturnActionResult = {
  doc: CustomerReturn;
  movements: StockMovement[];
};

export type {
  AvailabilityQuery,
  AvailabilityResponse,
  Branch,
  CreateCustomer,
  CreateCustomerReturn,
  CreateGoodsReceipt,
  CreateReservation,
  CreateStockAdjustment,
  CreateStockCount,
  CreateStockIssue,
  CreateStockTransfer,
  CreateSupplierReturn,
  Customer,
  Location,
  Product,
  ReservationsQuery,
  Supplier,
  Organization,
  CreateBranch,
  CreateLocation,
  CreateProduct,
  CreatePurchaseOrder,
  CreateSupplier,
  PostCustomerReturn,
  PostGoodsReceipt,
  PostStockAdjustment,
  PostStockCount,
  PostStockIssue,
  PostSupplierReturn,
  ReceiveStockTransfer,
  ShipStockTransfer,
  StockBalancesQuery,
  StockMovementsQuery,
  UpdateStockCount,
};

function headers(ctx: ApiHeaders, init?: HeadersInit): Headers {
  const h = new Headers(init);
  h.set("Content-Type", "application/json");
  h.set("X-Org-Id", ctx.orgId);
  h.set("X-User-Id", ctx.userId);
  if (ctx.branchId) {
    h.set("X-Branch-Id", ctx.branchId);
  }
  if (!h.has("X-Request-Id")) {
    h.set("X-Request-Id", crypto.randomUUID());
  }
  return h;
}

async function request<T>(
  path: string,
  ctx: ApiHeaders,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    ...init,
    headers: headers(ctx, init?.headers),
  });
  if (!res.ok) {
    let raw: unknown = await res.text();
    try {
      raw = JSON.parse(raw as string);
    } catch {
      // keep text body
    }
    throw parseApiError(res.status, raw);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

function withQuery(
  path: string,
  query: Record<string, string | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const api = {
  createOrg: (userId: string, body: CreateOrganization) =>
    request<Organization>(
      "/api/v1/orgs",
      { orgId: "00000000-0000-0000-0000-000000000000", userId },
      { method: "POST", body: JSON.stringify(body) },
    ),
  listBranches: (ctx: ApiHeaders) => request<Branch[]>("/api/v1/branches", ctx),
  createBranch: (ctx: ApiHeaders, body: CreateBranch) =>
    request<Branch>("/api/v1/branches", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listLocations: (ctx: ApiHeaders, branchId?: string) =>
    request<Location[]>(
      `/api/v1/locations${branchId ? `?branchId=${branchId}` : ""}`,
      ctx,
    ),
  createLocation: (ctx: ApiHeaders, body: CreateLocation) =>
    request<Location>("/api/v1/locations", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listProducts: (ctx: ApiHeaders) =>
    request<Product[]>("/api/v1/products", ctx),
  createProduct: (ctx: ApiHeaders, body: CreateProduct) =>
    request<Product>("/api/v1/products", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listSuppliers: (ctx: ApiHeaders) =>
    request<Supplier[]>("/api/v1/suppliers", ctx),
  createSupplier: (ctx: ApiHeaders, body: CreateSupplier) =>
    request<Supplier>("/api/v1/suppliers", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listPurchaseOrders: (ctx: ApiHeaders) =>
    request<PurchaseOrder[]>("/api/v1/purchase-orders", ctx),
  getPurchaseOrder: (ctx: ApiHeaders, id: string) =>
    request<PurchaseOrderWithLines>(`/api/v1/purchase-orders/${id}`, ctx),
  createPurchaseOrder: (ctx: ApiHeaders, body: CreatePurchaseOrder) =>
    request<PurchaseOrderWithLines>("/api/v1/purchase-orders", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitPurchaseOrder: (ctx: ApiHeaders, id: string) =>
    request<PurchaseOrder>(`/api/v1/purchase-orders/${id}/submit`, ctx, {
      method: "POST",
    }),
  approvePurchaseOrder: (ctx: ApiHeaders, id: string) =>
    request<PurchaseOrder>(`/api/v1/purchase-orders/${id}/approve`, ctx, {
      method: "POST",
    }),
  listGoodsReceipts: (ctx: ApiHeaders) =>
    request<GoodsReceipt[]>("/api/v1/goods-receipts", ctx),
  getGoodsReceipt: (ctx: ApiHeaders, id: string) =>
    request<GoodsReceiptWithLines>(`/api/v1/goods-receipts/${id}`, ctx),
  createGoodsReceipt: (ctx: ApiHeaders, body: CreateGoodsReceipt) =>
    request<GoodsReceiptWithLines>("/api/v1/goods-receipts", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postGoodsReceipt: (
    ctx: ApiHeaders,
    id: string,
    body: PostGoodsReceipt = {},
  ) =>
    request<GoodsReceipt>(`/api/v1/goods-receipts/${id}/post`, ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  voidGoodsReceipt: (ctx: ApiHeaders, id: string) =>
    request<GoodsReceipt>(`/api/v1/goods-receipts/${id}/void`, ctx, {
      method: "POST",
    }),
  listStockBalances: (ctx: ApiHeaders, query: StockBalancesQuery = {}) =>
    request<StockBalance[]>(withQuery("/api/v1/stock/balances", query), ctx),
  listStockMovements: (ctx: ApiHeaders, query: StockMovementsQuery = {}) =>
    request<StockMovement[]>(withQuery("/api/v1/stock/movements", query), ctx),
  listStockIssues: (ctx: ApiHeaders) =>
    request<StockIssue[]>("/api/v1/stock-issues", ctx),
  getStockIssue: (ctx: ApiHeaders, id: string) =>
    request<StockIssueWithLines>(`/api/v1/stock-issues/${id}`, ctx),
  createStockIssue: (ctx: ApiHeaders, body: CreateStockIssue) =>
    request<StockIssueWithLines>("/api/v1/stock-issues", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postStockIssue: (ctx: ApiHeaders, id: string, body: PostStockIssue = {}) =>
    request<StockIssueActionResult>(`/api/v1/stock-issues/${id}/post`, ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  voidStockIssue: (ctx: ApiHeaders, id: string) =>
    request<StockIssueActionResult>(`/api/v1/stock-issues/${id}/void`, ctx, {
      method: "POST",
    }),
  listStockTransfers: (ctx: ApiHeaders) =>
    request<StockTransfer[]>("/api/v1/stock-transfers", ctx),
  getStockTransfer: (ctx: ApiHeaders, id: string) =>
    request<StockTransferWithLines>(`/api/v1/stock-transfers/${id}`, ctx),
  createStockTransfer: (ctx: ApiHeaders, body: CreateStockTransfer) =>
    request<StockTransferWithLines>("/api/v1/stock-transfers", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  shipStockTransfer: (
    ctx: ApiHeaders,
    id: string,
    body: ShipStockTransfer = {},
  ) =>
    request<StockTransferActionResult>(
      `/api/v1/stock-transfers/${id}/ship`,
      ctx,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  receiveStockTransfer: (
    ctx: ApiHeaders,
    id: string,
    body: ReceiveStockTransfer = {},
  ) =>
    request<StockTransferActionResult>(
      `/api/v1/stock-transfers/${id}/receive`,
      ctx,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  voidStockTransfer: (ctx: ApiHeaders, id: string) =>
    request<StockTransferActionResult>(
      `/api/v1/stock-transfers/${id}/void`,
      ctx,
      { method: "POST" },
    ),
  listStockAdjustments: (ctx: ApiHeaders) =>
    request<StockAdjustment[]>("/api/v1/stock-adjustments", ctx),
  getStockAdjustment: (ctx: ApiHeaders, id: string) =>
    request<StockAdjustmentWithLines>(`/api/v1/stock-adjustments/${id}`, ctx),
  createStockAdjustment: (ctx: ApiHeaders, body: CreateStockAdjustment) =>
    request<StockAdjustmentWithLines>("/api/v1/stock-adjustments", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitStockAdjustment: (ctx: ApiHeaders, id: string) =>
    request<StockAdjustment>(`/api/v1/stock-adjustments/${id}/submit`, ctx, {
      method: "POST",
    }),
  approveStockAdjustment: (ctx: ApiHeaders, id: string) =>
    request<StockAdjustment>(`/api/v1/stock-adjustments/${id}/approve`, ctx, {
      method: "POST",
    }),
  postStockAdjustment: (
    ctx: ApiHeaders,
    id: string,
    body: PostStockAdjustment = {},
  ) =>
    request<StockAdjustmentActionResult>(
      `/api/v1/stock-adjustments/${id}/post`,
      ctx,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  voidStockAdjustment: (ctx: ApiHeaders, id: string) =>
    request<StockAdjustmentActionResult>(
      `/api/v1/stock-adjustments/${id}/void`,
      ctx,
      { method: "POST" },
    ),
  listApprovalPolicies: (ctx: ApiHeaders) =>
    request<ApprovalPolicy[]>("/api/v1/approval-policies", ctx),
  upsertApprovalPolicy: (
    ctx: ApiHeaders,
    body: {
      documentType: "purchase_order" | "stock_adjustment";
      required: boolean;
    },
  ) =>
    request<ApprovalPolicy>("/api/v1/approval-policies", ctx, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  listStockCounts: (ctx: ApiHeaders) =>
    request<StockCount[]>("/api/v1/stock-counts", ctx),
  getStockCount: (ctx: ApiHeaders, id: string) =>
    request<StockCountWithLines>(`/api/v1/stock-counts/${id}`, ctx),
  createStockCount: (ctx: ApiHeaders, body: CreateStockCount) =>
    request<StockCountWithLines>("/api/v1/stock-counts", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStockCount: (ctx: ApiHeaders, id: string, body: UpdateStockCount) =>
    request<StockCountWithLines>(`/api/v1/stock-counts/${id}`, ctx, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  postStockCount: (ctx: ApiHeaders, id: string, body: PostStockCount = {}) =>
    request<StockCountActionResult>(`/api/v1/stock-counts/${id}/post`, ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  voidStockCount: (ctx: ApiHeaders, id: string) =>
    request<StockCountActionResult>(`/api/v1/stock-counts/${id}/void`, ctx, {
      method: "POST",
    }),
  listCustomers: (ctx: ApiHeaders) =>
    request<Customer[]>("/api/v1/customers", ctx),
  createCustomer: (ctx: ApiHeaders, body: CreateCustomer) =>
    request<Customer>("/api/v1/customers", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listReservations: (ctx: ApiHeaders, query: ReservationsQuery = {}) =>
    request<StockReservation[]>(
      withQuery("/api/v1/reservations", query),
      ctx,
    ),
  getReservation: (ctx: ApiHeaders, id: string) =>
    request<StockReservation>(`/api/v1/reservations/${id}`, ctx),
  createReservation: (ctx: ApiHeaders, body: CreateReservation) =>
    request<StockReservation>("/api/v1/reservations", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  releaseReservation: (ctx: ApiHeaders, id: string) =>
    request<StockReservation>(`/api/v1/reservations/${id}/release`, ctx, {
      method: "POST",
    }),
  commitReservation: (ctx: ApiHeaders, id: string) =>
    request<CommitReservationResult>(
      `/api/v1/reservations/${id}/commit`,
      ctx,
      { method: "POST" },
    ),
  getAvailability: (ctx: ApiHeaders, query: AvailabilityQuery) =>
    request<AvailabilityResponse>(
      withQuery("/api/v1/availability", query),
      ctx,
    ),
  listSupplierReturns: (ctx: ApiHeaders) =>
    request<SupplierReturn[]>("/api/v1/supplier-returns", ctx),
  getSupplierReturn: (ctx: ApiHeaders, id: string) =>
    request<SupplierReturnWithLines>(`/api/v1/supplier-returns/${id}`, ctx),
  createSupplierReturn: (ctx: ApiHeaders, body: CreateSupplierReturn) =>
    request<SupplierReturnWithLines>("/api/v1/supplier-returns", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postSupplierReturn: (
    ctx: ApiHeaders,
    id: string,
    body: PostSupplierReturn = {},
  ) =>
    request<SupplierReturnActionResult>(
      `/api/v1/supplier-returns/${id}/post`,
      ctx,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  voidSupplierReturn: (ctx: ApiHeaders, id: string) =>
    request<SupplierReturnActionResult>(
      `/api/v1/supplier-returns/${id}/void`,
      ctx,
      { method: "POST" },
    ),
  listCustomerReturns: (ctx: ApiHeaders) =>
    request<CustomerReturn[]>("/api/v1/customer-returns", ctx),
  getCustomerReturn: (ctx: ApiHeaders, id: string) =>
    request<CustomerReturnWithLines>(`/api/v1/customer-returns/${id}`, ctx),
  createCustomerReturn: (ctx: ApiHeaders, body: CreateCustomerReturn) =>
    request<CustomerReturnWithLines>("/api/v1/customer-returns", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postCustomerReturn: (
    ctx: ApiHeaders,
    id: string,
    body: PostCustomerReturn = {},
  ) =>
    request<CustomerReturnActionResult>(
      `/api/v1/customer-returns/${id}/post`,
      ctx,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  voidCustomerReturn: (ctx: ApiHeaders, id: string) =>
    request<CustomerReturnActionResult>(
      `/api/v1/customer-returns/${id}/void`,
      ctx,
      { method: "POST" },
    ),
  listCostLayers: (
    ctx: ApiHeaders,
    query: { productId?: string; locationId?: string } = {},
  ) => request<unknown[]>(withQuery("/api/v1/stock/cost-layers", query), ctx),
  listCostSummaries: (
    ctx: ApiHeaders,
    query: { productId?: string; locationId?: string } = {},
  ) =>
    request<unknown[]>(withQuery("/api/v1/stock/cost-summaries", query), ctx),
  listValuation: (
    ctx: ApiHeaders,
    query: {
      asOf?: string;
      branchId?: string;
      locationId?: string;
      productId?: string;
    } = {},
  ) =>
    request<{ rows: unknown[]; totalValue: string }>(
      withQuery("/api/v1/cost-reports/valuation", query),
      ctx,
    ),
  listCogs: (
    ctx: ApiHeaders,
    query: { from: string; to: string; branchId?: string },
  ) =>
    request<{ rows: unknown[]; totalCogs: string }>(
      withQuery("/api/v1/cost-reports/cogs", query),
      ctx,
    ),
  listLandedCosts: (ctx: ApiHeaders) =>
    request<unknown[]>("/api/v1/landed-costs", ctx),
  createLandedCost: (ctx: ApiHeaders, body: CreateLandedCost) =>
    request<unknown>("/api/v1/landed-costs", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postLandedCost: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/landed-costs/${id}/post`, ctx, {
      method: "POST",
      body: "{}",
    }),
  voidLandedCost: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/landed-costs/${id}/void`, ctx, {
      method: "POST",
    }),
  listCostRevaluations: (ctx: ApiHeaders) =>
    request<unknown[]>("/api/v1/cost-revaluations", ctx),
  createCostRevaluation: (ctx: ApiHeaders, body: CreateCostRevaluation) =>
    request<unknown>("/api/v1/cost-revaluations", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postCostRevaluation: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/cost-revaluations/${id}/post`, ctx, {
      method: "POST",
      body: "{}",
    }),
  voidCostRevaluation: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/cost-revaluations/${id}/void`, ctx, {
      method: "POST",
    }),
  listAccounts: (ctx: ApiHeaders) => request<unknown[]>("/api/v1/accounts", ctx),
  ensureDefaultAccounts: (ctx: ApiHeaders) =>
    request<unknown>("/api/v1/accounts/ensure-defaults", ctx, {
      method: "POST",
    }),
  listAccountMappings: (ctx: ApiHeaders) =>
    request<unknown[]>("/api/v1/account-mappings", ctx),
  listAccountingPeriods: (ctx: ApiHeaders) =>
    request<unknown[]>("/api/v1/accounting-periods", ctx),
  generateAccountingPeriods: (ctx: ApiHeaders, body: { fiscalYear: number }) =>
    request<unknown>("/api/v1/accounting-periods/generate", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  openAccountingPeriod: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/accounting-periods/${id}/open`, ctx, {
      method: "POST",
    }),
  closeAccountingPeriod: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/accounting-periods/${id}/close`, ctx, {
      method: "POST",
    }),
  getCloseChecklist: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/accounting-periods/${id}/close-checklist`, ctx),
  getJournal: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/journals/${id}`, ctx),
  listJournalsBySource: (
    ctx: ApiHeaders,
    q: { sourceDocumentType: string; sourceDocumentId: string },
  ) => request<unknown[]>(withQuery("/api/v1/journals", q), ctx),
  listSupplierInvoices: (ctx: ApiHeaders) =>
    request<unknown[]>("/api/v1/supplier-invoices", ctx),
  getSupplierInvoice: (ctx: ApiHeaders, id: string) =>
    request<unknown>(`/api/v1/supplier-invoices/${id}`, ctx),
  createSupplierInvoice: (ctx: ApiHeaders, body: unknown) =>
    request<unknown>("/api/v1/supplier-invoices", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postSupplierInvoice: (ctx: ApiHeaders, id: string, body?: unknown) =>
    request<unknown>(`/api/v1/supplier-invoices/${id}/post`, ctx, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  voidSupplierInvoice: (ctx: ApiHeaders, id: string, body?: unknown) =>
    request<unknown>(`/api/v1/supplier-invoices/${id}/void`, ctx, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  listApAging: (ctx: ApiHeaders, q: { asOf: string }) =>
    request<unknown>(withQuery("/api/v1/reports/ap-aging", q), ctx),
  listTrialBalance: (
    ctx: ApiHeaders,
    q: { periodId?: string; asOf?: string; branchId?: string },
  ) => request<unknown>(withQuery("/api/v1/reports/trial-balance", q), ctx),
  listPnl: (ctx: ApiHeaders, q: { periodId: string; branchId?: string }) =>
    request<unknown>(withQuery("/api/v1/reports/pnl", q), ctx),
  listBalanceSheet: (ctx: ApiHeaders, q: { asOf: string; branchId?: string }) =>
    request<unknown>(withQuery("/api/v1/reports/balance-sheet", q), ctx),
};
