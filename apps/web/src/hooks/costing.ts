import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCostRevaluation,
  CreateLandedCost,
} from "@stock-management/shared";
import { api } from "../api/client";
import { useApiContext } from "./masters";

export function useCostLayers(filters: {
  productId?: string;
  locationId?: string;
} = {}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["cost-layers", ctx.orgId, filters],
    queryFn: () => api.listCostLayers(ctx, filters),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCostSummaries(filters: {
  productId?: string;
  locationId?: string;
} = {}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["cost-summaries", ctx.orgId, filters],
    queryFn: () => api.listCostSummaries(ctx, filters),
    enabled: Boolean(ctx.orgId),
  });
}

export function useValuation(filters: {
  asOf?: string;
  branchId?: string;
  locationId?: string;
  productId?: string;
} = {}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["valuation", ctx.orgId, filters],
    queryFn: () => api.listValuation(ctx, filters),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCogs(filters: {
  from: string;
  to: string;
  branchId?: string;
}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["cogs", ctx.orgId, filters],
    queryFn: () => api.listCogs(ctx, filters),
    enabled: Boolean(ctx.orgId && filters.from && filters.to),
  });
}

export function useLandedCosts() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["landed-costs", ctx.orgId],
    queryFn: () => api.listLandedCosts(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateLandedCost() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLandedCost) => api.createLandedCost(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landed-costs"] }),
  });
}

export function usePostLandedCost() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.postLandedCost(ctx, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landed-costs"] }),
  });
}

export function useVoidLandedCost() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidLandedCost(ctx, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landed-costs"] }),
  });
}

export function useCostRevaluations() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["cost-revaluations", ctx.orgId],
    queryFn: () => api.listCostRevaluations(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateCostRevaluation() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCostRevaluation) =>
      api.createCostRevaluation(ctx, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-revaluations"] }),
  });
}

export function usePostCostRevaluation() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.postCostRevaluation(ctx, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-revaluations"] }),
  });
}

export function useVoidCostRevaluation() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidCostRevaluation(ctx, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-revaluations"] }),
  });
}
