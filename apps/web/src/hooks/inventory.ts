import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AvailabilityQuery,
  CreateCustomerReturn,
  CreateGoodsReceipt,
  CreatePurchaseOrder,
  CreateReservation,
  CreateStockAdjustment,
  CreateStockCount,
  CreateStockIssue,
  CreateStockTransfer,
  CreateSupplierReturn,
  PostCustomerReturn,
  PostGoodsReceipt,
  PostStockAdjustment,
  PostStockCount,
  PostStockIssue,
  PostSupplierReturn,
  ReceiveStockTransfer,
  ReservationsQuery,
  ShipStockTransfer,
  StockBalancesQuery,
  StockMovementsQuery,
  UpdateStockCount,
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

export function useSubmitStockAdjustment() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.submitStockAdjustment(ctx, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] }),
  });
}

export function useApproveStockAdjustment() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveStockAdjustment(ctx, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] }),
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

async function invalidateOutbound(
  queryClient: ReturnType<typeof useQueryClient>,
  documentKey: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [documentKey] }),
    queryClient.invalidateQueries({ queryKey: ["stock"] }),
  ]);
}

export function useStockIssues() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock-issues", ctx.orgId],
    queryFn: () => api.listStockIssues(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateStockIssue() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStockIssue) => api.createStockIssue(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-issues"] }),
  });
}

export function usePostStockIssue() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body = {} }: { id: string; body?: PostStockIssue }) =>
      api.postStockIssue(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "stock-issues"),
  });
}

export function useVoidStockIssue() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidStockIssue(ctx, id),
    onSuccess: () => invalidateOutbound(queryClient, "stock-issues"),
  });
}

export function useStockTransfers() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock-transfers", ctx.orgId],
    queryFn: () => api.listStockTransfers(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateStockTransfer() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStockTransfer) =>
      api.createStockTransfer(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });
}

export function useShipStockTransfer() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body = {},
    }: {
      id: string;
      body?: ShipStockTransfer;
    }) => api.shipStockTransfer(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "stock-transfers"),
  });
}

export function useReceiveStockTransfer() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body = {},
    }: {
      id: string;
      body?: ReceiveStockTransfer;
    }) => api.receiveStockTransfer(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "stock-transfers"),
  });
}

export function useVoidStockTransfer() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidStockTransfer(ctx, id),
    onSuccess: () => invalidateOutbound(queryClient, "stock-transfers"),
  });
}

export function useStockAdjustments() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock-adjustments", ctx.orgId],
    queryFn: () => api.listStockAdjustments(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateStockAdjustment() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStockAdjustment) =>
      api.createStockAdjustment(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] }),
  });
}

export function usePostStockAdjustment() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body = {},
    }: {
      id: string;
      body?: PostStockAdjustment;
    }) => api.postStockAdjustment(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "stock-adjustments"),
  });
}

export function useVoidStockAdjustment() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidStockAdjustment(ctx, id),
    onSuccess: () => invalidateOutbound(queryClient, "stock-adjustments"),
  });
}

export function useStockCounts() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock-counts", ctx.orgId],
    queryFn: () => api.listStockCounts(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useStockCount(id?: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["stock-counts", ctx.orgId, id],
    queryFn: () => api.getStockCount(ctx, id!),
    enabled: Boolean(ctx.orgId && id),
  });
}

export function useCreateStockCount() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStockCount) => api.createStockCount(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] }),
  });
}

export function useUpdateStockCount() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStockCount }) =>
      api.updateStockCount(ctx, id, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] }),
  });
}

export function usePostStockCount() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body = {} }: { id: string; body?: PostStockCount }) =>
      api.postStockCount(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "stock-counts"),
  });
}

export function useVoidStockCount() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidStockCount(ctx, id),
    onSuccess: () => invalidateOutbound(queryClient, "stock-counts"),
  });
}

async function invalidateReservations(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["reservations"] }),
    queryClient.invalidateQueries({ queryKey: ["availability"] }),
    queryClient.invalidateQueries({ queryKey: ["stock"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-issues"] }),
  ]);
}

export function useReservations(filters: ReservationsQuery = {}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["reservations", ctx.orgId, filters],
    queryFn: () => api.listReservations(ctx, filters),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateReservation() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReservation) => api.createReservation(ctx, body),
    onSuccess: () => invalidateReservations(queryClient),
  });
}

export function useReleaseReservation() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.releaseReservation(ctx, id),
    onSuccess: () => invalidateReservations(queryClient),
  });
}

export function useCommitReservation() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.commitReservation(ctx, id),
    onSuccess: () => invalidateReservations(queryClient),
  });
}

export function useAvailability(query?: AvailabilityQuery) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["availability", ctx.orgId, query],
    queryFn: () => api.getAvailability(ctx, query!),
    enabled: Boolean(ctx.orgId && query?.productId && query?.branchId),
  });
}

export function useSupplierReturns() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["supplier-returns", ctx.orgId],
    queryFn: () => api.listSupplierReturns(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateSupplierReturn() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSupplierReturn) =>
      api.createSupplierReturn(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["supplier-returns"] }),
  });
}

export function usePostSupplierReturn() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body = {},
    }: {
      id: string;
      body?: PostSupplierReturn;
    }) => api.postSupplierReturn(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "supplier-returns"),
  });
}

export function useVoidSupplierReturn() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidSupplierReturn(ctx, id),
    onSuccess: () => invalidateOutbound(queryClient, "supplier-returns"),
  });
}

export function useCustomerReturns() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["customer-returns", ctx.orgId],
    queryFn: () => api.listCustomerReturns(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateCustomerReturn() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerReturn) =>
      api.createCustomerReturn(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["customer-returns"] }),
  });
}

export function usePostCustomerReturn() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body = {},
    }: {
      id: string;
      body?: PostCustomerReturn;
    }) => api.postCustomerReturn(ctx, id, body),
    onSuccess: () => invalidateOutbound(queryClient, "customer-returns"),
  });
}

export function useVoidCustomerReturn() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidCustomerReturn(ctx, id),
    onSuccess: () => invalidateOutbound(queryClient, "customer-returns"),
  });
}
