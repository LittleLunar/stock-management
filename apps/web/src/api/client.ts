import {
  type Branch,
  type CreateBranch,
  type CreateGoodsReceipt,
  type CreateLocation,
  type CreateOrganization,
  type CreateProduct,
  type CreatePurchaseOrder,
  type CreateSupplier,
  type GoodsReceiptLineInput,
  type Location,
  type Organization,
  type PostGoodsReceipt,
  type Product,
  type PurchaseOrderLineInput,
  type StockBalancesQuery,
  type StockMovementsQuery,
  type Supplier,
} from "@stock-management/shared";
import { env } from "../lib/env";
import { parseApiError } from "../lib/errors";

export type ApiHeaders = {
  orgId: string;
  userId: string;
};

export type PurchaseOrder = {
  id: string;
  orgId: string;
  supplierId: string;
  branchId: string;
  status:
    | "draft"
    | "submitted"
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
  movementType: "receipt" | "receipt_void";
  qty: string;
  createdAt: string;
};

export type {
  Branch,
  CreateGoodsReceipt,
  Location,
  Product,
  Supplier,
  Organization,
  CreateBranch,
  CreateLocation,
  CreateProduct,
  CreatePurchaseOrder,
  CreateSupplier,
  PostGoodsReceipt,
  StockBalancesQuery,
  StockMovementsQuery,
};

function headers(ctx: ApiHeaders, init?: HeadersInit): Headers {
  const h = new Headers(init);
  h.set("Content-Type", "application/json");
  h.set("X-Org-Id", ctx.orgId);
  h.set("X-User-Id", ctx.userId);
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
};
