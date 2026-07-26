import { toast } from "sonner";
import {
  useApprovalPolicies,
  useUpsertApprovalPolicy,
} from "../hooks/approvals";
import { formatApiError } from "../lib/errors";

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  purchase_order: "Purchase order",
  stock_adjustment: "Stock adjustment",
};

export function ApprovalPoliciesPage() {
  const { data, isLoading, error } = useApprovalPolicies();
  const upsert = useUpsertApprovalPolicy();

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-red-700">{formatApiError(error)}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Approval policies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Require approval before receiving POs or posting stock adjustments.
          Only org admins can change these settings.
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
                    onSuccess: () => toast.success("Policy updated"),
                    onError: (err) => toast.error(formatApiError(err)),
                  },
                )
              }
            />
            <span>
              {DOCUMENT_TYPE_LABEL[policy.documentType] ?? policy.documentType}{" "}
              requires approval
            </span>
          </label>
        ))}
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No policies found.</p>
        ) : null}
      </div>
    </div>
  );
}
