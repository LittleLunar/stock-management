import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  useCreateStockAdjustment,
  usePostStockAdjustment,
  useStockAdjustments,
  useVoidStockAdjustment,
} from "../hooks/inventory";
import { useBranches, useLocations, useProducts } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type AdjustmentLineDraft = {
  productId: string;
  qty: string;
  unitCost: string;
  lotId: string;
  serialNumbers: string;
};

const emptyLine = (): AdjustmentLineDraft => ({
  productId: "",
  qty: "1",
  unitCost: "",
  lotId: "",
  serialNumbers: "",
});

export function StockAdjustmentsPage() {
  const { data: adjustments, isLoading, error } = useStockAdjustments();
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const create = useCreateStockAdjustment();
  const post = usePostStockAdjustment();
  const voidAdjustment = useVoidStockAdjustment();
  const [branchId, setBranchId] = useState("");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [lines, setLines] = useState<AdjustmentLineDraft[]>([emptyLine()]);

  function updateLine(
    index: number,
    key: keyof AdjustmentLineDraft,
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
    if (
      !branchId ||
      !locationId ||
      !reasonCode.trim() ||
      lines.some((line) => !line.productId || !line.qty || Number(line.qty) === 0)
    ) {
      toast.error(
        "Select branch, location, reason code, and a non-zero signed qty for every line",
      );
      return;
    }
    create.mutate(
      {
        branchId,
        locationId,
        documentNumber: documentNumber || null,
        reasonCode: reasonCode.trim(),
        reasonNote: reasonNote || null,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId || null,
          unitCost:
            Number(line.qty) > 0 ? line.unitCost.trim() || null : null,
          serialNumbers: line.serialNumbers
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          lineNumber: index + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Stock adjustment created");
          setDocumentNumber("");
          setReasonCode("");
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
        <h1 className="text-2xl font-semibold">Stock adjustments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Correct on-hand quantity with a signed line qty (positive adds,
          negative removes).
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">New stock adjustment</h2>
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
          <input
            required
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Reason code"
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          />
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
            <div key={index} className="space-y-2 rounded bg-slate-50 p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto]">
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
                  aria-label={`Line ${index + 1} signed quantity`}
                  placeholder="Signed qty (+/−)"
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(index, "qty", event.target.value)
                  }
                />
                {Number(line.qty) > 0 ? (
                  <input
                    required
                    inputMode="decimal"
                    className="rounded border border-slate-300 px-3 py-2"
                    aria-label={`Line ${index + 1} unit cost`}
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(event) =>
                      updateLine(index, "unitCost", event.target.value)
                    }
                  />
                ) : (
                  <div aria-hidden="true" />
                )}
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
        <h2 className="font-semibold">Adjustments</h2>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(adjustments ?? []).map((adjustment) => (
                <tr key={adjustment.id}>
                  <td className="px-4 py-3 font-medium">
                    {adjustment.documentNumber ?? adjustment.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{adjustment.reasonCode}</td>
                  <td className="px-4 py-3">
                    {branchName(adjustment.branchId)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(adjustment.locationId)}
                  </td>
                  <td className="px-4 py-3">{adjustment.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {adjustment.status === "draft" ? (
                      <button
                        type="button"
                        disabled={post.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          post.mutate(
                            { id: adjustment.id },
                            {
                              onSuccess: () =>
                                toast.success("Stock adjustment posted"),
                            },
                          )
                        }
                      >
                        Post
                      </button>
                    ) : null}
                    {adjustment.status === "posted" ? (
                      <button
                        type="button"
                        disabled={voidAdjustment.isPending}
                        className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        onClick={() =>
                          voidAdjustment.mutate(adjustment.id, {
                            onSuccess: () =>
                              toast.success("Stock adjustment voided"),
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
