import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCreateSupplierInvoice,
  useSupplierInvoices,
} from "../hooks/accounting";
import { formatApiError } from "../lib/errors";

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierId: string;
  status: string;
};

export function SupplierInvoicesPage() {
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
        <h1 className="text-2xl font-semibold">Supplier invoices</h1>
        <p className="mt-1 text-sm text-slate-600">
          Draft AP bills with 3-way match lines.
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
          placeholder="Supplier id"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="Invoice number"
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
          placeholder="PO line id"
          value={poLineId}
          onChange={(e) => setPoLineId(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="GR line id"
          value={grLineId}
          onChange={(e) => setGrLineId(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Unit cost"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white md:col-span-2"
        >
          Create draft
        </button>
      </form>
      {invoices.error ? (
        <p className="text-red-700">{formatApiError(invoices.error)}</p>
      ) : null}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Number</th>
              <th className="p-2">Date</th>
              <th className="p-2">Supplier</th>
              <th className="p-2">Status</th>
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
                <td className="p-2">{row.invoiceDate}</td>
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
