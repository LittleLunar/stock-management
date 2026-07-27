import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useApprovalPolicies,
  useUpsertApprovalPolicy,
} from "../hooks/approvals";
import { formatApiError } from "../lib/errors";

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  purchase_order: "settings.approvalPolicies.documentType.purchaseOrder",
  stock_adjustment: "settings.approvalPolicies.documentType.stockAdjustment",
};

export function ApprovalPoliciesPage() {
  const { t } = useTranslation("settings");
  const { data, isLoading, error } = useApprovalPolicies();
  const upsert = useUpsertApprovalPolicy();

  if (isLoading) return <p>{t("settings.approvalPolicies.loading")}</p>;
  if (error) return <p className="text-red-700">{formatApiError(error)}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("settings.approvalPolicies.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("settings.approvalPolicies.description")}
        </p>
      </div>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-5">
        {(data ?? []).map((policy) => (
          <label
            key={policy.documentType}
            className="flex items-center gap-3 text-sm"
          >
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={policy.required}
              disabled={upsert.isPending}
              onChange={(e) =>
                upsert.mutate(
                  {
                    documentType: policy.documentType,
                    required: e.target.checked,
                  },
                  {
                    onSuccess: () =>
                      toast.success(t("settings.approvalPolicies.updateSuccess")),
                    onError: (err) => toast.error(formatApiError(err)),
                  },
                )
              }
            />
            <span>
              {t("settings.approvalPolicies.requiresApproval", {
                documentType:
                  DOCUMENT_TYPE_LABEL[policy.documentType] != null
                    ? t(DOCUMENT_TYPE_LABEL[policy.documentType])
                    : policy.documentType,
              })}
            </span>
          </label>
        ))}
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">
            {t("settings.approvalPolicies.empty")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
