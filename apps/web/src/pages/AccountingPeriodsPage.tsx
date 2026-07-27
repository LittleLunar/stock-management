import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAccountingPeriods,
  useCloseAccountingPeriod,
  useCloseChecklist,
  useGenerateAccountingPeriods,
  useOpenAccountingPeriod,
} from "../hooks/accounting";
import { formatDate } from "../i18n/format";
import { formatApiError } from "../lib/errors";

type Period = {
  id: string;
  year: number;
  month: number;
  startsOn: string;
  endsOn: string;
  status: string;
};

type Checklist = {
  canCloseSuggested: boolean;
  warnings: Array<{ code: string; message: string }>;
};

export function AccountingPeriodsPage() {
  const { t } = useTranslation("accounting");
  const periods = useAccountingPeriods();
  const generate = useGenerateAccountingPeriods();
  const openPeriod = useOpenAccountingPeriod();
  const closePeriod = useCloseAccountingPeriod();
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [selectedId, setSelectedId] = useState("");
  const checklist = useCloseChecklist(selectedId);
  const rows = (periods.data ?? []) as Period[];
  const checklistData = checklist.data as Checklist | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("accounting.accountingPeriods.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("accounting.accountingPeriods.description")}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            {t("accounting.accountingPeriods.fiscalYear")}
          </label>
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="rounded bg-teal-800 px-4 py-2 text-white"
          onClick={() =>
            generate.mutate({ fiscalYear: Number(fiscalYear) })
          }
        >
          {t("accounting.accountingPeriods.generate")}
        </button>
      </div>
      {periods.error ? (
        <p className="text-red-700">{formatApiError(periods.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">{t("accounting.accountingPeriods.col.year")}</th>
              <th className="p-2">{t("accounting.accountingPeriods.col.month")}</th>
              <th className="p-2">{t("accounting.accountingPeriods.col.dates")}</th>
              <th className="p-2">{t("accounting.accountingPeriods.col.status")}</th>
              <th className="p-2">{t("accounting.accountingPeriods.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.year}</td>
                <td className="p-2">{row.month}</td>
                <td className="p-2">
                  {formatDate(row.startsOn)} – {formatDate(row.endsOn)}
                </td>
                <td className="p-2">{row.status}</td>
                <td className="p-2 space-x-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={() => setSelectedId(row.id)}
                  >
                    {t("accounting.accountingPeriods.checklist")}
                  </button>
                  {row.status !== "open" ? (
                    <button
                      type="button"
                      className="rounded border px-2 py-1"
                      onClick={() => openPeriod.mutate(row.id)}
                    >
                      {t("accounting.accountingPeriods.open")}
                    </button>
                  ) : null}
                  {row.status === "open" ? (
                    <button
                      type="button"
                      className="rounded border px-2 py-1"
                      onClick={() => closePeriod.mutate(row.id)}
                    >
                      {t("accounting.accountingPeriods.close")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedId ? (
        <div className="rounded border bg-white p-4">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-medium">
              {t("accounting.accountingPeriods.closeChecklistTitle")}
            </h2>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                checklistData?.canCloseSuggested
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {checklistData?.canCloseSuggested
                ? t("accounting.accountingPeriods.readyToClose")
                : t("accounting.accountingPeriods.warningsPresent")}
            </span>
          </div>
          {checklist.error ? (
            <p className="text-red-700">{formatApiError(checklist.error)}</p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {(checklistData?.warnings ?? []).map((w, i) => (
              <li key={i} className="rounded bg-slate-50 px-3 py-2">
                <span className="font-medium">{w.code}</span>: {w.message}
              </li>
            ))}
            {(checklistData?.warnings ?? []).length === 0 ? (
              <li className="text-slate-500">
                {t("accounting.accountingPeriods.noWarnings")}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
