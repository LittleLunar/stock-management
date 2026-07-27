import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useApprovePurchaseOrder } from "../hooks/approvals";
import {
  useCreatePurchaseOrder,
  usePurchaseOrders,
  useSubmitPurchaseOrder,
} from "../hooks/inventory";
import { useBranches, useProducts, useSuppliers } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type PurchaseOrderLineDraft = {
  productId: string;
  orderedQty: string;
  unitCost: string;
};

const emptyLine = (): PurchaseOrderLineDraft => ({
  productId: "",
  orderedQty: "1",
  unitCost: "",
});

export function PurchaseOrdersPage() {
  const { data: purchaseOrders, isLoading, error } = usePurchaseOrders();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const create = useCreatePurchaseOrder();
  const submit = useSubmitPurchaseOrder();
  const approve = useApprovePurchaseOrder();
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>([emptyLine()]);

  function updateLine(
    index: number,
    key: keyof PurchaseOrderLineDraft,
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
    if (!supplierId || !branchId || lines.some((line) => !line.productId)) {
      toast.error("Select a supplier, branch, and product for every line");
      return;
    }
    create.mutate(
      {
        supplierId,
        branchId,
        documentNumber: documentNumber || null,
        expectedDate: expectedDate
          ? new Date(`${expectedDate}T00:00:00`)
          : null,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          orderedQty: line.orderedQty,
          unitCost: line.unitCost || null,
          lineNumber: index + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Purchase order created");
          setDocumentNumber("");
          setExpectedDate("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  const supplierName = (id: string) =>
    suppliers?.find((supplier) => supplier.id === id)?.name ?? id;
  const branchName = (id: string) =>
    branches?.find((branch) => branch.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Purchase orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create draft orders and submit them for receiving.
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">New purchase order</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Supplier</option>
            {(suppliers ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} — {supplier.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            <option value="">Branch</option>
            {(branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Document number (optional)"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
          <input
            type="date"
            className="rounded border border-slate-300 px-3 py-2"
            value={expectedDate}
            onChange={(event) => setExpectedDate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto]"
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
                required
                inputMode="decimal"
                className="rounded border border-slate-300 px-3 py-2"
                aria-label={`Line ${index + 1} quantity`}
                placeholder="Quantity"
                value={line.orderedQty}
                onChange={(event) =>
                  updateLine(index, "orderedQty", event.target.value)
                }
              />
              <input
                inputMode="decimal"
                className="rounded border border-slate-300 px-3 py-2"
                aria-label={`Line ${index + 1} unit cost`}
                placeholder="Unit cost"
                value={line.unitCost}
                onChange={(event) =>
                  updateLine(index, "unitCost", event.target.value)
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
        <h2 className="font-semibold">Orders</h2>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(purchaseOrders ?? []).map((purchaseOrder) => (
                <tr key={purchaseOrder.id}>
                  <td className="px-4 py-3 font-medium">
                    {purchaseOrder.documentNumber ??
                      purchaseOrder.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {supplierName(purchaseOrder.supplierId)}
                  </td>
                  <td className="px-4 py-3">
                    {branchName(purchaseOrder.branchId)}
                  </td>
                  <td className="px-4 py-3">
                    {purchaseOrder.expectedDate
                      ? new Date(
                          purchaseOrder.expectedDate,
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{purchaseOrder.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {purchaseOrder.status === "draft" ? (
                      <button
                        type="button"
                        disabled={submit.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          submit.mutate(purchaseOrder.id, {
                            onSuccess: () =>
                              toast.success("Purchase order submitted"),
                          })
                        }
                      >
                        Submit
                      </button>
                    ) : null}
                    {purchaseOrder.status === "submitted" ? (
                      <button
                        type="button"
                        disabled={approve.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          approve.mutate(purchaseOrder.id, {
                            onSuccess: () =>
                              toast.success("Purchase order approved"),
                            onError: (err) => toast.error(formatApiError(err)),
                          })
                        }
                      >
                        Approve
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
