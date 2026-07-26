import { useState } from "react";
import { useAccountingPeriods, useTrialBalance } from "../hooks/accounting";
import { useBranches } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type BalanceRow = {
  code: string;
  name: string;
  debitTotal: string;
  creditTotal: string;
  net: string;
};

type Period = { id: string; year: number; month: number };

export function TrialBalancePage() {
  const { data: periods } = useAccountingPeriods();
  const { data: branches } = useBranches();
  const [mode, setMode] = useState<"period" | "asOf">("period");
  const [periodId, setPeriodId] = useState("");
  const [asOf, setAsOf] = useState("");
  const [branchId, setBranchId] = useState(
    () => localStorage.getItem("activeBranchId") ?? "",
  );
  const report = useTrialBalance({
    periodId: mode === "period" ? periodId || undefined : undefined,
    asOf: mode === "asOf" ? asOf || undefined : undefined,
    branchId: branchId || undefined,
  });
  const data = report.data as
    | { rows: BalanceRow[]; totalDebit: string; totalCredit: string }
    | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trial balance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Account debits and credits by period or as-of date.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 rounded border bg-white p-4">
        <select
          className="rounded border px-3 py-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as "period" | "asOf")}
        >
          <option value="period">By period</option>
          <option value="asOf">By as-of date</option>
        </select>
        {mode === "period" ? (
          <select
            className="rounded border px-3 py-2"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
          >
            <option value="">Select period</option>
            {((periods ?? []) as Period[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.year}-{String(p.month).padStart(2, "0")}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
        )}
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
      </div>
      {report.error ? (
        <p className="text-red-700">{formatApiError(report.error)}</p>
      ) : null}
      <p className="font-medium">
        Totals — Debit: {data?.totalDebit ?? "—"} · Credit:{" "}
        {data?.totalCredit ?? "—"}
      </p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Code</th>
              <th className="p-2">Name</th>
              <th className="p-2">Debit</th>
              <th className="p-2">Credit</th>
              <th className="p-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.code} className="border-b">
                <td className="p-2 font-medium">{row.code}</td>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.debitTotal}</td>
                <td className="p-2">{row.creditTotal}</td>
                <td className="p-2">{row.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
