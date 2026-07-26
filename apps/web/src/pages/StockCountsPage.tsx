import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  useCreateStockCount,
  usePostStockCount,
  useStockBalances,
  useStockCount,
  useStockCounts,
  useUpdateStockCount,
  useVoidStockCount,
} from "../hooks/inventory";
import { useBranches, useLocations, useProducts } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type CountLineDraft = {
  productId: string;
  lotId: string;
  countedQty: string;
};

const emptyLine = (): CountLineDraft => ({
  productId: "",
  lotId: "",
  countedQty: "",
});

export function StockCountsPage() {
  const { data: counts, isLoading, error } = useStockCounts();
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const create = useCreateStockCount();
  const update = useUpdateStockCount();
  const post = usePostStockCount();
  const voidCount = useVoidStockCount();
  const [branchId, setBranchId] = useState("");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const { data: balances } = useStockBalances(
    locationId ? { locationId } : {},
  );
  const [documentNumber, setDocumentNumber] = useState("");
  const [lines, setLines] = useState<CountLineDraft[]>([emptyLine()]);
  const [selectedCountId, setSelectedCountId] = useState("");
  const { data: selectedCount } = useStockCount(selectedCountId || undefined);
  const [countedEdits, setCountedEdits] = useState<Record<string, string>>({});

  function expectedQty(productId: string, lotId: string) {
    if (!productId) return "—";
    const match = (balances ?? []).find(
      (balance) =>
        balance.productId === productId &&
        (balance.lotId ?? "") === (lotId || ""),
    );
    return match?.qtyOnHand ?? "0";
  }

  function updateLine(
    index: number,
    key: keyof CountLineDraft,
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
      lines.some((line) => !line.productId || line.countedQty === "")
    ) {
      toast.error(
        "Select a branch, location, product, and counted qty for every line",
      );
      return;
    }
    create.mutate(
      {
        branchId,
        locationId,
        documentNumber: documentNumber || null,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          lotId: line.lotId || null,
          countedQty: line.countedQty,
          lineNumber: index + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Stock count created");
          setDocumentNumber("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  function handleSaveCounted() {
    if (!selectedCount || selectedCount.status !== "draft") return;
    update.mutate(
      {
        id: selectedCount.id,
        body: {
          lines: selectedCount.lines.map((line, index) => ({
            id: line.id,
            productId: line.productId,
            lotId: line.lotId,
            countedQty:
              countedEdits[line.id] !== undefined
                ? countedEdits[line.id]
                : (line.countedQty ?? "0"),
            lineNumber: line.lineNumber ?? index + 1,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success("Counted quantities saved");
          setCountedEdits({});
        },
      },
    );
  }

  const branchName = (id: string) =>
    branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8);
  const locationName = (id: string) =>
    locations?.find((location) => location.id === id)?.name ?? id.slice(0, 8);
  const productLabel = (id: string) => {
    const product = products?.find((item) => item.id === id);
    return product ? `${product.sku} — ${product.name}` : id.slice(0, 8);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Stock counts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Capture physical counts against expected on-hand. Variance posts on
          document post.
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">New stock count</h2>
        <div className="grid gap-3 md:grid-cols-3">
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
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Document number (optional)"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_8rem_auto]"
            >
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
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Lot id"
                value={line.lotId}
                onChange={(event) =>
                  updateLine(index, "lotId", event.target.value)
                }
              />
              <input
                readOnly
                className="rounded border border-slate-200 bg-slate-100 px-3 py-2 tabular-nums"
                aria-label={`Line ${index + 1} expected quantity`}
                value={expectedQty(line.productId, line.lotId)}
                title="Expected on-hand (from balances; snapshotted on create)"
              />
              <input
                required
                inputMode="decimal"
                className="rounded border border-slate-300 px-3 py-2"
                aria-label={`Line ${index + 1} counted quantity`}
                placeholder="Counted"
                value={line.countedQty}
                onChange={(event) =>
                  updateLine(index, "countedQty", event.target.value)
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
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Expected is shown from current balances and snapshotted when the
          draft is created.
        </p>

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
        <h2 className="font-semibold">Counts</h2>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(counts ?? []).map((count) => (
                <tr key={count.id}>
                  <td className="px-4 py-3 font-medium">
                    {count.documentNumber ?? count.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{branchName(count.branchId)}</td>
                  <td className="px-4 py-3">
                    {locationName(count.locationId)}
                  </td>
                  <td className="px-4 py-3">{count.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
                      onClick={() => {
                        setSelectedCountId(count.id);
                        setCountedEdits({});
                      }}
                    >
                      Lines
                    </button>
                    {count.status === "draft" ? (
                      <button
                        type="button"
                        disabled={post.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          post.mutate(
                            { id: count.id },
                            {
                              onSuccess: () =>
                                toast.success("Stock count posted"),
                            },
                          )
                        }
                      >
                        Post
                      </button>
                    ) : null}
                    {count.status === "posted" ? (
                      <button
                        type="button"
                        disabled={voidCount.isPending}
                        className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        onClick={() =>
                          voidCount.mutate(count.id, {
                            onSuccess: () =>
                              toast.success("Stock count voided"),
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

      {selectedCount ? (
        <section className="space-y-3 rounded border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Count lines —{" "}
              {selectedCount.documentNumber ?? selectedCount.id.slice(0, 8)}
            </h2>
            {selectedCount.status === "draft" ? (
              <button
                type="button"
                disabled={update.isPending}
                className="rounded bg-teal-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                onClick={handleSaveCounted}
              >
                {update.isPending ? "Saving…" : "Save counted"}
              </button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Counted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedCount.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 font-medium">
                      {productLabel(line.productId)}
                    </td>
                    <td className="px-4 py-3">
                      {line.lotId ? line.lotId.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line.expectedQty}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {selectedCount.status === "draft" ? (
                        <input
                          inputMode="decimal"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                          value={
                            countedEdits[line.id] ?? line.countedQty ?? ""
                          }
                          onChange={(event) =>
                            setCountedEdits((current) => ({
                              ...current,
                              [line.id]: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span className="tabular-nums">
                          {line.countedQty ?? "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
