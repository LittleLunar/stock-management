import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateSupplierInvoice,
  useSupplierInvoices,
} from "../hooks/accounting";
import { formatDate } from "../i18n/format";
import { formatApiError } from "../lib/errors";

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierId: string;
  status: string;
};

export function SupplierInvoicesPage() {
  const { t } = useTranslation("accounting");
  const invoices = useSupplierInvoices();
  const create = useCreateSupplierInvoice();
  const rows = (invoices.data ?? []) as Invoice[];
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [poLineId, setPoLineId] = useState("");
  const [grLineId, setGrLineId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("10");
  const [amount, setAmount] = useState("10");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("accounting.supplierInvoices.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("accounting.supplierInvoices.description")}
        </p>
      </div>
      <form
        className="grid gap-2 rounded border bg-white p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            supplierId,
            invoiceNumber,
            invoiceDate,
            lines: [
              {
                lineNumber: 1,
                qty,
                unitCost,
                amount,
                purchaseOrderLineId: poLineId,
                goodsReceiptLineId: grLineId,
              },
            ],
          });
        }}
      >
        <input
          className="rounded border px-3 py-2"
          placeholder={t("accounting.supplierInvoices.supplierIdPlaceholder")}
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder={t("accounting.supplierInvoices.invoiceNumberPlaceholder")}
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
        <input
          type="date"
          className="rounded border px-3 py-2"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder={t("accounting.supplierInvoices.poLineIdPlaceholder")}
          value={poLineId}
          onChange={(e) => setPoLineId(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder={t("accounting.supplierInvoices.grLineIdPlaceholder")}
          value={grLineId}
          onChange={(e) => setGrLineId(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t("accounting.supplierInvoices.qtyPlaceholder")}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t("accounting.supplierInvoices.unitCostPlaceholder")}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t("accounting.supplierInvoices.amountPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white md:col-span-2"
        >
          {t("accounting.supplierInvoices.createDraft")}
        </button>
      </form>
      {invoices.error ? (
        <p className="text-red-700">{formatApiError(invoices.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">{t("accounting.supplierInvoices.col.number")}</th>
              <th className="p-2">{t("accounting.supplierInvoices.col.date")}</th>
              <th className="p-2">{t("accounting.supplierInvoices.col.supplier")}</th>
              <th className="p-2">{t("accounting.supplierInvoices.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">
                  <Link
                    to="/supplier-invoices/$invoiceId"
                    params={{ invoiceId: row.id }}
                    className="text-teal-800 underline"
                  >
                    {row.invoiceNumber}
                  </Link>
                </td>
                <td className="p-2">{formatDate(row.invoiceDate)}</td>
                <td className="p-2">{row.supplierId}</td>
                <td className="p-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
