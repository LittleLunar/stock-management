import {
  type Branch,
  type CreateBranch,
  type CreateLocation,
  type CreateOrganization,
  type CreateProduct,
  type CreateSupplier,
  type Location,
  type Organization,
  type Product,
  type Supplier,
} from "@stock-management/shared";
import { env } from "../lib/env";
import { parseApiError } from "../lib/errors";

export type ApiHeaders = {
  orgId: string;
  userId: string;
};

export type {
  Branch,
  Location,
  Product,
  Supplier,
  Organization,
  CreateBranch,
  CreateLocation,
  CreateProduct,
  CreateSupplier,
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
  listProducts: (ctx: ApiHeaders) => request<Product[]>("/api/v1/products", ctx),
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
};
