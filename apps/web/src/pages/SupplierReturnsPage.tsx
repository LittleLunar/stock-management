import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useCreateSupplierReturn,
  usePostSupplierReturn,
  useSupplierReturns,
  useVoidSupplierReturn,
} from "../hooks/inventory";
import {
  useBranches,
  useLocations,
  useProducts,
  useSuppliers,
} from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type ReturnLineDraft = {
  productId: string;
  qty: string;
  lotId: string;
  serialNumbers: string;
};

const emptyLine = (): ReturnLineDraft => ({
  productId: "",
  qty: "1",
  lotId: "",
  serialNumbers: "",
});

export function SupplierReturnsPage() {
  const { t } = useTranslation("purchasing");
  const { data: returns, isLoading, error } = useSupplierReturns();
  const { data: branches } = useBranches();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const create = useCreateSupplierReturn();
  const post = usePostSupplierReturn();
  const voidReturn = useVoidSupplierReturn();
  const [branchId, setBranchId] = useState("");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [goodsReceiptId, setGoodsReceiptId] = useState("");
  const [lines, setLines] = useState<ReturnLineDraft[]>([emptyLine()]);

  function updateLine(
    index: number,
    key: keyof ReturnLineDraft,
    value: string,
  ) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (
      !branchId ||
      !locationId ||
      !supplierId ||
      lines.some((line) => !line.productId)
    ) {
      toast.error(t("purchasing.supplierReturns.selectRequired"));
      return;
    }
    create.mutate(
      {
        branchId,
        locationId,
        supplierId,
        documentNumber: documentNumber || null,
        goodsReceiptId: goodsReceiptId || null,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          qty: line.qty,
          lotId: line.lotId || null,
          serialNumbers: line.serialNumbers
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          lineNumber: index + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success(t("purchasing.supplierReturns.createSuccess"));
          setDocumentNumber("");
          setGoodsReceiptId("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  const branchName = (id: string) =>
    branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8);
  const locationName = (id: string) =>
    locations?.find((location) => location.id === id)?.name ?? id.slice(0, 8);
  const supplierName = (id: string) =>
    suppliers?.find((supplier) => supplier.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("purchasing.supplierReturns.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("purchasing.supplierReturns.description")}
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">
          {t("purchasing.supplierReturns.newTitle")}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setLocationId("");
            }}
          >
            <option value="">{t("purchasing.supplierReturns.branch")}</option>
            {(branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">{t("purchasing.supplierReturns.location")}</option>
            {(locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">{t("purchasing.supplierReturns.supplier")}</option>
            {(suppliers ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} — {supplier.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder={t(
              "purchasing.supplierReturns.documentNumberPlaceholder",
            )}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder={t(
            "purchasing.supplierReturns.goodsReceiptIdPlaceholder",
          )}
          value={goodsReceiptId}
          onChange={(event) => setGoodsReceiptId(event.target.value)}
        />

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="space-y-2 rounded bg-slate-50 p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_auto]">
                <select
                  required
                  className="rounded border border-slate-300 px-3 py-2"
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(index, "productId", event.target.value)
                  }
                >
                  <option value="">
                    {t("purchasing.supplierReturns.product")}
                  </option>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  inputMode="decimal"
                  className="rounded border border-slate-300 px-3 py-2"
                  aria-label={t("purchasing.supplierReturns.qtyAria", {
                    n: index + 1,
                  })}
                  placeholder={t("purchasing.supplierReturns.qtyPlaceholder")}
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(index, "qty", event.target.value)
                  }
                />
                <button
                  type="button"
                  disabled={lines.length === 1}
                  className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, lineIndex) => lineIndex !== index),
                    )
                  }
                >
                  {t("purchasing.supplierReturns.remove")}
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder={t("purchasing.supplierReturns.lotIdPlaceholder")}
                  value={line.lotId}
                  onChange={(event) =>
                    updateLine(index, "lotId", event.target.value)
                  }
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder={t("purchasing.supplierReturns.serialsPlaceholder")}
                  value={line.serialNumbers}
                  onChange={(event) =>
                    updateLine(index, "serialNumbers", event.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-2 text-sm"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            {t("purchasing.supplierReturns.addLine")}
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {create.isPending
              ? t("purchasing.supplierReturns.creating")
              : t("purchasing.supplierReturns.createDraft")}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">
          {t("purchasing.supplierReturns.listTitle")}
        </h2>
        {isLoading ? <p>{t("purchasing.supplierReturns.loading")}</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  {t("purchasing.supplierReturns.col.document")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.supplierReturns.col.supplier")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.supplierReturns.col.branch")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.supplierReturns.col.location")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.supplierReturns.col.status")}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(returns ?? []).map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 font-medium">
                    {doc.documentNumber ?? doc.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{supplierName(doc.supplierId)}</td>
                  <td className="px-4 py-3">{branchName(doc.branchId)}</td>
                  <td className="px-4 py-3">
                    {locationName(doc.locationId)}
                  </td>
                  <td className="px-4 py-3">{doc.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {doc.status === "draft" ? (
                      <button
                        type="button"
                        disabled={post.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          post.mutate(
                            { id: doc.id },
                            {
                              onSuccess: () =>
                                toast.success(
                                  t("purchasing.supplierReturns.postSuccess"),
                                ),
                            },
                          )
                        }
                      >
                        {t("purchasing.supplierReturns.post")}
                      </button>
                    ) : null}
                    {doc.status === "posted" ? (
                      <button
                        type="button"
                        disabled={voidReturn.isPending}
                        className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        onClick={() =>
                          voidReturn.mutate(doc.id, {
                            onSuccess: () =>
                              toast.success(
                                t("purchasing.supplierReturns.voidSuccess"),
                              ),
                          })
                        }
                      >
                        {t("purchasing.supplierReturns.void")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
