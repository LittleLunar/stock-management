import { useState } from "react";
import { useBranches, useLocations, useProducts } from "../hooks/masters";
import { useValuation } from "../hooks/costing";
import { formatApiError } from "../lib/errors";

type ValuationRow = {
  productId: string;
  locationId: string;
  branchId: string;
  lotId: string | null;
  qty: string;
  unitCost: string;
  value: string;
};

export function CostValuationPage() {
  const { data: products } = useProducts();
  const { data: locations } = useLocations();
  const { data: branches } = useBranches();
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [asOf, setAsOf] = useState("");
  const valuation = useValuation({
    productId: productId || undefined,
    locationId: locationId || undefined,
    branchId: branchId || undefined,
    asOf: asOf || undefined,
  });
  const rows = (valuation.data?.rows ?? []) as ValuationRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory valuation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Current or as-of valuation from FIFO cost layers.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 rounded border border-slate-200 bg-white p-4">
        <select
          className="rounded border px-3 py-2"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">All branches</option>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-3 py-2"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          <option value="">All locations</option>
          {(locations ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.code}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-3 py-2"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">All products</option>
          {(products ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          className="rounded border px-3 py-2"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
      </div>
      {valuation.error ? (
        <p className="text-red-700">{formatApiError(valuation.error)}</p>
      ) : null}
      <p className="font-medium">
        Total value: {valuation.data?.totalValue ?? "—"}
      </p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Product</th>
              <th className="p-2">Location</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Unit cost</th>
              <th className="p-2">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{row.productId}</td>
                <td className="p-2">{row.locationId}</td>
                <td className="p-2">{row.qty}</td>
                <td className="p-2">{row.unitCost}</td>
                <td className="p-2">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
