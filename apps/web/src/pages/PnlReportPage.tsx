import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccountingPeriods, usePnl } from "../hooks/accounting";
import { useBranches } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type BalanceRow = {
  code: string;
  name: string;
  net: string;
};

type Period = { id: string; year: number; month: number };

export function PnlReportPage() {
  const { t } = useTranslation("accounting");
  const { data: periods } = useAccountingPeriods();
  const { data: branches } = useBranches();
  const [periodId, setPeriodId] = useState("");
  const [branchId, setBranchId] = useState(
    () => localStorage.getItem("activeBranchId") ?? "",
  );
  const report = usePnl({
    periodId,
    branchId: branchId || undefined,
  });
  const data = report.data as
    | {
        income: BalanceRow[];
        expense: BalanceRow[];
        totalIncome: string;
        totalExpense: string;
        netIncome: string;
      }
    | undefined;

  const sectionTitle = {
    income: t("accounting.pnl.section.income"),
    expense: t("accounting.pnl.section.expense"),
  } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("accounting.pnl.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("accounting.pnl.description")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 rounded border bg-white p-4">
        <select
          className="rounded border px-3 py-2"
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
        >
          <option value="">{t("accounting.pnl.selectPeriod")}</option>
          {((periods ?? []) as Period[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.year}-{String(p.month).padStart(2, "0")}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-3 py-2"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">{t("accounting.pnl.allBranches")}</option>
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
        {t("accounting.pnl.summary", {
          income: data?.totalIncome ?? "—",
          expense: data?.totalExpense ?? "—",
          net: data?.netIncome ?? "—",
        })}
      </p>
      {(["income", "expense"] as const).map((section) => (
        <div key={section}>
          <h2 className="mb-2 text-lg font-medium">{sectionTitle[section]}</h2>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">{t("accounting.pnl.col.code")}</th>
                  <th className="p-2">{t("accounting.pnl.col.name")}</th>
                  <th className="p-2">{t("accounting.pnl.col.net")}</th>
                </tr>
              </thead>
              <tbody>
                {((data?.[section] ?? []) as BalanceRow[]).map((row) => (
                  <tr key={row.code} className="border-b">
                    <td className="p-2 font-medium">{row.code}</td>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
