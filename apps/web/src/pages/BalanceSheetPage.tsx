import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useBalanceSheet } from "../hooks/accounting";
import { useBranches } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type BalanceRow = {
  code: string;
  name: string;
  net: string;
};

export function BalanceSheetPage() {
  const { t } = useTranslation("accounting");
  const { data: branches } = useBranches();
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState(
    () => localStorage.getItem("activeBranchId") ?? "",
  );
  const report = useBalanceSheet({
    asOf,
    branchId: branchId || undefined,
  });
  const data = report.data as
    | {
        assets: BalanceRow[];
        liabilities: BalanceRow[];
        equity: BalanceRow[];
        netIncome: string;
        totalAssets: string;
        totalLiabilities: string;
        totalEquity: string;
        balanced: boolean;
      }
    | undefined;

  const sectionTitle = {
    assets: t("accounting.balanceSheet.section.assets"),
    liabilities: t("accounting.balanceSheet.section.liabilities"),
    equity: t("accounting.balanceSheet.section.equity"),
  } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("accounting.balanceSheet.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("accounting.balanceSheet.description")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 rounded border bg-white p-4">
        <input
          type="date"
          className="rounded border px-3 py-2"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
        <select
          className="rounded border px-3 py-2"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">{t("accounting.balanceSheet.allBranches")}</option>
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
        {t("accounting.balanceSheet.summary", {
          assets: data?.totalAssets ?? "—",
          liabilities: data?.totalLiabilities ?? "—",
          equity: data?.totalEquity ?? "—",
          netIncome: data?.netIncome ?? "—",
          balanced: data?.balanced
            ? t("accounting.balanceSheet.balanced")
            : t("accounting.balanceSheet.notBalanced"),
        })}
      </p>
      {(["assets", "liabilities", "equity"] as const).map((section) => (
        <div key={section}>
          <h2 className="mb-2 text-lg font-medium">{sectionTitle[section]}</h2>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">{t("accounting.balanceSheet.col.code")}</th>
                  <th className="p-2">{t("accounting.balanceSheet.col.name")}</th>
                  <th className="p-2">{t("accounting.balanceSheet.col.net")}</th>
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
