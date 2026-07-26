const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type ApiHeaders = {
  orgId: string;
  userId: string;
};

function headers(ctx: ApiHeaders, init?: HeadersInit): Headers {
  const h = new Headers(init);
  h.set("Content-Type", "application/json");
  h.set("X-Org-Id", ctx.orgId);
  h.set("X-User-Id", ctx.userId);
  return h;
}

async function request<T>(
  path: string,
  ctx: ApiHeaders,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: headers(ctx, init?.headers),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export type Branch = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type Location = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  type: string;
  status: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  trackLot: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  status: string;
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type Organization = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
};

export const api = {
  createOrg: (userId: string, name: string) =>
    request<Organization>(
      "/api/v1/orgs",
      { orgId: "00000000-0000-0000-0000-000000000000", userId },
      { method: "POST", body: JSON.stringify({ name }) },
    ),
  listBranches: (ctx: ApiHeaders) => request<Branch[]>("/api/v1/branches", ctx),
  createBranch: (ctx: ApiHeaders, body: { code: string; name: string }) =>
    request<Branch>("/api/v1/branches", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listLocations: (ctx: ApiHeaders, branchId?: string) =>
    request<Location[]>(
      `/api/v1/locations${branchId ? `?branchId=${branchId}` : ""}`,
      ctx,
    ),
  createLocation: (
    ctx: ApiHeaders,
    body: { branchId: string; code: string; name: string; type?: string },
  ) =>
    request<Location>("/api/v1/locations", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listProducts: (ctx: ApiHeaders) => request<Product[]>("/api/v1/products", ctx),
  createProduct: (
    ctx: ApiHeaders,
    body: {
      sku: string;
      name: string;
      trackLot?: boolean;
      trackSerial?: boolean;
      trackExpiry?: boolean;
    },
  ) =>
    request<Product>("/api/v1/products", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listSuppliers: (ctx: ApiHeaders) => request<Supplier[]>("/api/v1/suppliers", ctx),
  createSupplier: (ctx: ApiHeaders, body: { code: string; name: string }) =>
    request<Supplier>("/api/v1/suppliers", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
