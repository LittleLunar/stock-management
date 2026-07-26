import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useApiContext } from "./masters";

export function useAccounts() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["accounts", ctx.orgId],
    queryFn: () => api.listAccounts(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useEnsureDefaultAccounts() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.ensureDefaultAccounts(ctx),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-mappings"] });
    },
  });
}

export function useAccountMappings() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["account-mappings", ctx.orgId],
    queryFn: () => api.listAccountMappings(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useAccountingPeriods() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["accounting-periods", ctx.orgId],
    queryFn: () => api.listAccountingPeriods(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useGenerateAccountingPeriods() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fiscalYear: number }) =>
      api.generateAccountingPeriods(ctx, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["accounting-periods"] }),
  });
}

export function useOpenAccountingPeriod() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.openAccountingPeriod(ctx, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["accounting-periods"] }),
  });
}

export function useCloseAccountingPeriod() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.closeAccountingPeriod(ctx, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["accounting-periods"] }),
  });
}

export function useCloseChecklist(periodId: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["close-checklist", ctx.orgId, periodId],
    queryFn: () => api.getCloseChecklist(ctx, periodId),
    enabled: Boolean(ctx.orgId && periodId),
  });
}

export function useJournalsBySource(q: {
  sourceDocumentType: string;
  sourceDocumentId: string;
}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["journals-by-source", ctx.orgId, q],
    queryFn: () => api.listJournalsBySource(ctx, q),
    enabled: Boolean(
      ctx.orgId && q.sourceDocumentType && q.sourceDocumentId,
    ),
  });
}

export function useJournal(id: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["journal", ctx.orgId, id],
    queryFn: () => api.getJournal(ctx, id),
    enabled: Boolean(ctx.orgId && id),
  });
}

export function useSupplierInvoices() {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["supplier-invoices", ctx.orgId],
    queryFn: () => api.listSupplierInvoices(ctx),
    enabled: Boolean(ctx.orgId),
  });
}

export function useSupplierInvoice(id: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["supplier-invoice", ctx.orgId, id],
    queryFn: () => api.getSupplierInvoice(ctx, id),
    enabled: Boolean(ctx.orgId && id),
  });
}

export function useCreateSupplierInvoice() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.createSupplierInvoice(ctx, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] }),
  });
}

export function usePostSupplierInvoice() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.postSupplierInvoice(ctx, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      qc.invalidateQueries({ queryKey: ["supplier-invoice"] });
    },
  });
}

export function useVoidSupplierInvoice() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.voidSupplierInvoice(ctx, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      qc.invalidateQueries({ queryKey: ["supplier-invoice"] });
    },
  });
}

export function useApAging(asOf: string) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["ap-aging", ctx.orgId, asOf],
    queryFn: () => api.listApAging(ctx, { asOf }),
    enabled: Boolean(ctx.orgId && asOf),
  });
}

export function useTrialBalance(filters: {
  periodId?: string;
  asOf?: string;
  branchId?: string;
}) {
  const ctx = useApiContext();
  const enabled =
    Boolean(ctx.orgId) &&
    Boolean(
      (filters.periodId && !filters.asOf) ||
        (filters.asOf && !filters.periodId),
    );
  return useQuery({
    queryKey: ["trial-balance", ctx.orgId, filters],
    queryFn: () => api.listTrialBalance(ctx, filters),
    enabled,
  });
}

export function usePnl(filters: { periodId: string; branchId?: string }) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["pnl", ctx.orgId, filters],
    queryFn: () => api.listPnl(ctx, filters),
    enabled: Boolean(ctx.orgId && filters.periodId),
  });
}

export function useBalanceSheet(filters: {
  asOf: string;
  branchId?: string;
}) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["balance-sheet", ctx.orgId, filters],
    queryFn: () => api.listBalanceSheet(ctx, filters),
    enabled: Boolean(ctx.orgId && filters.asOf),
  });
}
