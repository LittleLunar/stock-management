import { useTranslation } from "react-i18next";
import {
  useAccountMappings,
  useAccounts,
  useEnsureDefaultAccounts,
} from "../hooks/accounting";
import { formatApiError } from "../lib/errors";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
};

type Mapping = {
  id: string;
  journalEventType: string;
  debitAccountId: string;
  creditAccountId: string;
};

export function AccountsPage() {
  const { t } = useTranslation("accounting");
  const accounts = useAccounts();
  const mappings = useAccountMappings();
  const ensureDefaults = useEnsureDefaultAccounts();
  const rows = (accounts.data ?? []) as Account[];
  const mappingRows = (mappings.data ?? []) as Mapping[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("accounting.accounts.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("accounting.accounts.description")}
          </p>
        </div>
        <button
          type="button"
          className="rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-50"
          disabled={ensureDefaults.isPending}
          onClick={() => ensureDefaults.mutate()}
        >
          {t("accounting.accounts.ensureDefaults")}
        </button>
      </div>
      {accounts.error ? (
        <p className="text-red-700">{formatApiError(accounts.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">{t("accounting.accounts.col.code")}</th>
              <th className="p-2">{t("accounting.accounts.col.name")}</th>
              <th className="p-2">{t("accounting.accounts.col.type")}</th>
              <th className="p-2">{t("accounting.accounts.col.active")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2 font-medium">{row.code}</td>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.type}</td>
                <td className="p-2">
                  {row.active
                    ? t("accounting.accounts.activeYes")
                    : t("accounting.accounts.activeNo")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">
          {t("accounting.accounts.mappingsTitle")}
        </h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">{t("accounting.accounts.col.eventType")}</th>
                <th className="p-2">
                  {t("accounting.accounts.col.debitAccount")}
                </th>
                <th className="p-2">
                  {t("accounting.accounts.col.creditAccount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {mappingRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.journalEventType}</td>
                  <td className="p-2">{row.debitAccountId}</td>
                  <td className="p-2">{row.creditAccountId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
