import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useBranches } from "../hooks/masters";
import { useCogs } from "../hooks/costing";
import { formatApiError } from "../lib/errors";

type CogsRow = {
  branchId: string;
  movementType: string;
  documentType: string;
  totalCost: string;
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - 1);
  return {
    from: from.toISOString().slice(0, 16),
    to: to.toISOString().slice(0, 16),
  };
}

export function CogsReportPage() {
  const { t } = useTranslation("costing");
  const { data: branches } = useBranches();
  const defaults = defaultRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [branchId, setBranchId] = useState(
    () => localStorage.getItem("activeBranchId") ?? "",
  );
  const cogs = useCogs({
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    branchId: branchId || undefined,
  });
  const rows = (cogs.data?.rows ?? []) as CogsRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("costing.cogs.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("costing.cogs.description")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 rounded border bg-white p-4">
        <input
          type="datetime-local"
          className="rounded border px-3 py-2"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="datetime-local"
          className="rounded border px-3 py-2"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <select
          className="rounded border px-3 py-2"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">{t("costing.cogs.allBranches")}</option>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {cogs.error ? (
        <p className="text-red-700">{formatApiError(cogs.error)}</p>
      ) : null}
      <p className="font-medium">
        {t("costing.cogs.totalCogs", {
          value: cogs.data?.totalCogs ?? "—",
        })}
      </p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">{t("costing.cogs.col.branch")}</th>
              <th className="p-2">{t("costing.cogs.col.movement")}</th>
              <th className="p-2">{t("costing.cogs.col.document")}</th>
              <th className="p-2">{t("costing.cogs.col.cost")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{row.branchId}</td>
                <td className="p-2">{row.movementType}</td>
                <td className="p-2">{row.documentType}</td>
                <td className="p-2">{row.totalCost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
