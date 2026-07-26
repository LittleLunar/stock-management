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
  const accounts = useAccounts();
  const mappings = useAccountMappings();
  const ensureDefaults = useEnsureDefaultAccounts();
  const rows = (accounts.data ?? []) as Account[];
  const mappingRows = (mappings.data ?? []) as Mapping[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chart of accounts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Default inventory GL accounts and event mappings.
          </p>
        </div>
        <button
          type="button"
          className="rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-50"
          disabled={ensureDefaults.isPending}
          onClick={() => ensureDefaults.mutate()}
        >
          Ensure defaults
        </button>
      </div>
      {accounts.error ? (
        <p className="text-red-700">{formatApiError(accounts.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Code</th>
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2 font-medium">{row.code}</td>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.type}</td>
                <td className="p-2">{row.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Account mappings</h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Event type</th>
                <th className="p-2">Debit account</th>
                <th className="p-2">Credit account</th>
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
