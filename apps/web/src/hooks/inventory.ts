import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateGoodsReceipt,
  CreatePurchaseOrder,
  PostGoodsReceipt,
  StockBalancesQuery,
  StockMovementsQuery,
} from "@stock-management/shared";
import { api } from "../api/client";
import { useApiContext } from "./masters";

export function usePurchaseOrders() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["purchase-orders", ctx.orgId],
    queryFn: () => api.listPurchaseOrders(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function usePurchaseOrder(id?: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["purchase-orders", ctx.orgId, id],
    queryFn: () => api.getPurchaseOrder(ctx, id!),
    enabled: Boolean(ctx.orgId && id),
  });
}

export function useCreatePurchaseOrder() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePurchaseOrder) =>
      api.createPurchaseOrder(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}

export function useSubmitPurchaseOrder() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.submitPurchaseOrder(ctx, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}

export function useGoodsReceipts() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["goods-receipts", ctx.orgId],
    queryFn: () => api.listGoodsReceipts(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useGoodsReceipt(id?: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["goods-receipts", ctx.orgId, id],
    queryFn: () => api.getGoodsReceipt(ctx, id!),
    enabled: Boolean(ctx.orgId && id),
  });
}

export function useCreateGoodsReceipt() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGoodsReceipt) => api.createGoodsReceipt(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] }),
  });
}

export function usePostGoodsReceipt() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body = {} }: { id: string; body?: PostGoodsReceipt }) =>
      api.postGoodsReceipt(ctx, id, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goods-receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["stock"] }),
      ]);
    },
  });
}

export function useVoidGoodsReceipt() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidGoodsReceipt(ctx, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goods-receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["stock"] }),
      ]);
    },
  });
}

export function useStockBalances(filters: StockBalancesQuery = {}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock", "balances", ctx.orgId, filters],
    queryFn: () => api.listStockBalances(ctx, filters),
    enabled: Boolean(ctx.orgId),
  });
}

export function useStockMovements(filters: StockMovementsQuery = {}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock", "movements", ctx.orgId, filters],
    queryFn: () => api.listStockMovements(ctx, filters),
    enabled: Boolean(ctx.orgId),
  });
}
