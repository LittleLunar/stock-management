import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useApiContext } from "./masters";

export function useApprovalPolicies() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["approval-policies", ctx.orgId],
    queryFn: () => api.listApprovalPolicies(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useUpsertApprovalPolicy() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      documentType: "purchase_order" | "stock_adjustment";
      required: boolean;
    }) => api.upsertApprovalPolicy(ctx, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["approval-policies"] }),
  });
}

export function useApprovePurchaseOrder() {
  const ctx = useApiContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approvePurchaseOrder(ctx, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}
