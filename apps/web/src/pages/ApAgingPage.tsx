import { useState } from "react";
import { useApAging } from "../hooks/accounting";
import { formatApiError } from "../lib/errors";

type AgingBucket = {
  supplierId: string;
  bucket0To30: string;
  bucket31To60: string;
  bucket61To90: string;
  bucketOver90: string;
  total: string;
};

export function ApAgingPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const aging = useApAging(asOf);
  const data = aging.data as
    | { rows: AgingBucket[]; grandTotal: string }
    | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AP aging</h1>
        <p className="mt-1 text-sm text-slate-600">
          Posted supplier invoice balances by age bucket (D2 API).
        </p>
      </div>
      <div className="rounded border bg-white p-4">
        <label className="mb-1 block text-xs text-slate-500">As of</label>
        <input
          type="date"
          className="rounded border px-3 py-2"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
      </div>
      {aging.error ? (
        <p className="text-red-700">{formatApiError(aging.error)}</p>
      ) : null}
      <p className="font-medium">Grand total: {data?.grandTotal ?? "—"}</p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Supplier</th>
              <th className="p-2">0–30</th>
              <th className="p-2">31–60</th>
              <th className="p-2">61–90</th>
              <th className="p-2">90+</th>
              <th className="p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{row.supplierId}</td>
                <td className="p-2">{row.bucket0To30}</td>
                <td className="p-2">{row.bucket31To60}</td>
                <td className="p-2">{row.bucket61To90}</td>
                <td className="p-2">{row.bucketOver90}</td>
                <td className="p-2">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
