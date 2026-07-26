import { Link, useParams } from "@tanstack/react-router";
import {
  usePostSupplierInvoice,
  useSupplierInvoice,
  useVoidSupplierInvoice,
} from "../hooks/accounting";
import { formatApiError } from "../lib/errors";

type InvoiceLine = {
  id: string;
  lineNumber: number;
  qty: string;
  unitCost: string;
  amount: string;
  purchaseOrderLineId: string;
  goodsReceiptLineId: string;
};

type InvoiceDetail = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    invoiceDate: string;
  };
  lines: InvoiceLine[];
};

export function SupplierInvoiceDetailPage() {
  const { invoiceId } = useParams({ from: "/supplier-invoices/$invoiceId" });
  const detail = useSupplierInvoice(invoiceId);
  const post = usePostSupplierInvoice();
  const voidInvoice = useVoidSupplierInvoice();
  const data = detail.data as InvoiceDetail | undefined;

  return (
    <div className="space-y-6">
      <Link to="/supplier-invoices" className="text-sm text-teal-800 underline">
        ← Back to invoices
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">
          Invoice {data?.invoice.invoiceNumber ?? invoiceId}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Status: {data?.invoice.status ?? "—"} · Date:{" "}
          {data?.invoice.invoiceDate ?? "—"}
        </p>
      </div>
      {detail.error ? (
        <p className="text-red-700">{formatApiError(detail.error)}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-50"
          disabled={post.isPending || data?.invoice.status !== "draft"}
          onClick={() => post.mutate(invoiceId)}
        >
          Post
        </button>
        <button
          type="button"
          className="rounded border px-4 py-2 disabled:opacity-50"
          disabled={voidInvoice.isPending || data?.invoice.status !== "posted"}
          onClick={() => voidInvoice.mutate(invoiceId)}
        >
          Void
        </button>
      </div>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Line</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Unit cost</th>
              <th className="p-2">Amount</th>
              <th className="p-2">PO line</th>
              <th className="p-2">GR line</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lines ?? []).map((line) => (
              <tr key={line.id} className="border-b">
                <td className="p-2">{line.lineNumber}</td>
                <td className="p-2">{line.qty}</td>
                <td className="p-2">{line.unitCost}</td>
                <td className="p-2">{line.amount}</td>
                <td className="p-2">{line.purchaseOrderLineId}</td>
                <td className="p-2">{line.goodsReceiptLineId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
