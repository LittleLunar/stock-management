import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateBranch,
  CreateCustomer,
  CreateLocation,
  CreateProduct,
  CreateSupplier,
} from "@stock-management/shared";
import { api, type ApiHeaders } from "../api/client";
import { branchIdForHeaders } from "../lib/active-branch";

export function useApiContext(): ApiHeaders {
  return {
    orgId: localStorage.getItem("orgId") ?? "",
    userId:
      localStorage.getItem("userId") ??
      "00000000-0000-0000-0000-000000000001",
    branchId: branchIdForHeaders(
      localStorage.getItem("activeBranchId") ?? "",
    ),
  };
}

export function useBranches() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["branches", ctx.orgId],
    queryFn: () => api.listBranches(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateBranch() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBranch) => api.createBranch(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useLocations(branchId?: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["locations", ctx.orgId, branchId],
    queryFn: () => api.listLocations(ctx, branchId),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateLocation() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLocation) => api.createLocation(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

export function useProducts() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["products", ctx.orgId],
    queryFn: () => api.listProducts(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateProduct() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProduct) => api.createProduct(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useSuppliers() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["suppliers", ctx.orgId],
    queryFn: () => api.listSuppliers(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateSupplier() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSupplier) => api.createSupplier(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useCustomers() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["customers", ctx.orgId],
    queryFn: () => api.listCustomers(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateCustomer() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomer) => api.createCustomer(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
