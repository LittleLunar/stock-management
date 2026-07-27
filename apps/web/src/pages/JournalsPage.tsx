import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJournal, useJournalsBySource } from "../hooks/accounting";
import { formatDateTime } from "../i18n/format";
import { formatApiError } from "../lib/errors";

type JournalLine = {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  lineNo: number;
};

type Journal = {
  id: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  postedAt: string;
  lines: JournalLine[];
};

export function JournalsPage() {
  const { t } = useTranslation("accounting");
  const [sourceDocumentType, setSourceDocumentType] = useState("goods_receipt");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [journalId, setJournalId] = useState("");
  const bySource = useJournalsBySource({
    sourceDocumentType,
    sourceDocumentId,
  });
  const byId = useJournal(journalId);
  const sourceJournals = (bySource.data ?? []) as Journal[];
  const journal = byId.data as Journal | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("accounting.journals.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("accounting.journals.description")}
        </p>
      </div>
      <div className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-medium">{t("accounting.journals.bySourceTitle")}</h2>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t("accounting.journals.sourceDocumentTypePlaceholder")}
            value={sourceDocumentType}
            onChange={(e) => setSourceDocumentType(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t("accounting.journals.sourceDocumentIdPlaceholder")}
            value={sourceDocumentId}
            onChange={(e) => setSourceDocumentId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <h2 className="font-medium">{t("accounting.journals.byIdTitle")}</h2>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t("accounting.journals.journalIdPlaceholder")}
            value={journalId}
            onChange={(e) => setJournalId(e.target.value)}
          />
        </div>
      </div>
      {bySource.error ? (
        <p className="text-red-700">{formatApiError(bySource.error)}</p>
      ) : null}
      {byId.error ? (
        <p className="text-red-700">{formatApiError(byId.error)}</p>
      ) : null}
      {(journal ? [journal] : sourceJournals).map((j) => (
        <div key={j.id} className="rounded border bg-white p-4">
          <p className="text-sm text-slate-600">
            {j.id} · {j.sourceDocumentType} · {formatDateTime(j.postedAt)}
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">{t("accounting.journals.col.account")}</th>
                <th className="p-2">{t("accounting.journals.col.debit")}</th>
                <th className="p-2">{t("accounting.journals.col.credit")}</th>
              </tr>
            </thead>
            <tbody>
              {j.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="p-2">{line.accountId}</td>
                  <td className="p-2">{line.debit}</td>
                  <td className="p-2">{line.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
