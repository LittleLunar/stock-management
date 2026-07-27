import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateWebhookSubscription,
  UpdateWebhookSubscription,
} from "@stock-management/shared";
import { api } from "../api/client";
import { useApiContext } from "./masters";

export function useWebhookSubscriptions() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["webhook-subscriptions", ctx.orgId],
    queryFn: () => api.listWebhookSubscriptions(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useCreateWebhookSubscription() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWebhookSubscription) =>
      api.createWebhookSubscription(ctx, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
  });
}

export function usePatchWebhookSubscription() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateWebhookSubscription;
    }) => api.patchWebhookSubscription(ctx, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["webhook-deliveries"] });
    },
  });
}

export function useWebhookDeliveries(subscriptionId?: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["webhook-deliveries", ctx.orgId, subscriptionId ?? "all"],
    queryFn: () => api.listWebhookDeliveries(ctx, subscriptionId),
    enabled: Boolean(ctx.orgId),
  });
}
