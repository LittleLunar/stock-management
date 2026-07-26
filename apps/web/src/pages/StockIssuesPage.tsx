import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BarcodeScanField } from "../components/BarcodeScanField";
import {
  useCreateStockIssue,
  usePostStockIssue,
  useStockIssues,
  useVoidStockIssue,
} from "../hooks/inventory";
import { useBranches, useLocations, useProducts } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type IssueLineDraft = {
  productId: string;
  qty: string;
  lotId: string;
  serialNumbers: string;
};

const ISSUE_TYPES = [
  { value: "consume", label: "Consume" },
  { value: "sample", label: "Sample" },
  { value: "write_off", label: "Write-off" },
  { value: "other", label: "Other" },
] as const;

const emptyLine = (): IssueLineDraft => ({
  productId: "",
  qty: "1",
  lotId: "",
  serialNumbers: "",
});

export function StockIssuesPage() {
  const { data: issues, isLoading, error } = useStockIssues();
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const create = useCreateStockIssue();
  const post = usePostStockIssue();
  const voidIssue = useVoidStockIssue();
  const [branchId, setBranchId] = useState("");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const [issueType, setIssueType] =
    useState<(typeof ISSUE_TYPES)[number]["value"]>("consume");
  const [documentNumber, setDocumentNumber] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [lines, setLines] = useState<IssueLineDraft[]>([emptyLine()]);

  function updateLine(
    index: number,
    key: keyof IssueLineDraft,
    value: string,
  ) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!branchId || !locationId || lines.some((line) => !line.productId)) {
      toast.error("Select a branch, location, and product for every line");
      return;
    }
    create.mutate(
      {
        branchId,
        locationId,
        issueType,
        documentNumber: documentNumber || null,
        reasonNote: reasonNote || null,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId || null,
          serialNumbers: line.serialNumbers
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          lineNumber: index + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Stock issue created");
          setDocumentNumber("");
          setReasonNote("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  const branchName = (id: string) =>
    branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8);
  const locationName = (id: string) =>
    locations?.find((location) => location.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Stock issues</h1>
        <p className="mt-1 text-sm text-slate-600">
          Issue stock for consumption, samples, write-offs, or other reasons.
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">New stock issue</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setLocationId("");
            }}
          >
            <option value="">Branch</option>
            {(branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">Location</option>
            {(locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={issueType}
            onChange={(event) =>
              setIssueType(
                event.target.value as (typeof ISSUE_TYPES)[number]["value"],
              )
            }
          >
            {ISSUE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Document number (optional)"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="Reason note (optional)"
          value={reasonNote}
          onChange={(event) => setReasonNote(event.target.value)}
        />

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div
              key={index}
              className="space-y-2 rounded bg-slate-50 p-3"
            >
              <BarcodeScanField
                onProduct={(productId) =>
                  updateLine(index, "productId", productId)
                }
              />
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_auto]">
                <select
                  required
                  className="rounded border border-slate-300 px-3 py-2"
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(index, "productId", event.target.value)
                  }
                >
                  <option value="">Product</option>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  inputMode="decimal"
                  className="rounded border border-slate-300 px-3 py-2"
                  aria-label={`Line ${index + 1} quantity`}
                  placeholder="Quantity"
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(index, "qty", event.target.value)
                  }
                />
                <button
                  type="button"
                  disabled={lines.length === 1}
                  className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, lineIndex) => lineIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder="Lot id (optional)"
                  value={line.lotId}
                  onChange={(event) =>
                    updateLine(index, "lotId", event.target.value)
                  }
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder="Serials, comma separated"
                  value={line.serialNumbers}
                  onChange={(event) =>
                    updateLine(index, "serialNumbers", event.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-2 text-sm"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            Add line
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Issues</h2>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(issues ?? []).map((issue) => (
                <tr key={issue.id}>
                  <td className="px-4 py-3 font-medium">
                    {issue.documentNumber ?? issue.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{issue.issueType}</td>
                  <td className="px-4 py-3">{branchName(issue.branchId)}</td>
                  <td className="px-4 py-3">
                    {locationName(issue.locationId)}
                  </td>
                  <td className="px-4 py-3">{issue.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {issue.status === "draft" ? (
                      <button
                        type="button"
                        disabled={post.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          post.mutate(
                            { id: issue.id },
                            {
                              onSuccess: () =>
                                toast.success("Stock issue posted"),
                            },
                          )
                        }
                      >
                        Post
                      </button>
                    ) : null}
                    {issue.status === "posted" ? (
                      <button
                        type="button"
                        disabled={voidIssue.isPending}
                        className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        onClick={() =>
                          voidIssue.mutate(issue.id, {
                            onSuccess: () =>
                              toast.success("Stock issue voided"),
                          })
                        }
                      >
                        Void
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
