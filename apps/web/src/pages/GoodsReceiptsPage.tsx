import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BarcodeScanField } from "../components/BarcodeScanField";
import {
  useCreateGoodsReceipt,
  useGoodsReceipts,
  usePostGoodsReceipt,
  usePurchaseOrder,
  usePurchaseOrders,
  useVoidGoodsReceipt,
} from "../hooks/inventory";
import {
  useBranches,
  useLocations,
  useProducts,
  useSuppliers,
} from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type ReceiptLineDraft = {
  productId: string;
  purchaseOrderLineId?: string;
  qty: string;
  unitCost: string;
  lotCode: string;
  expiryDate: string;
  serialNumbers: string;
};

const emptyLine = (): ReceiptLineDraft => ({
  productId: "",
  qty: "1",
  unitCost: "",
  lotCode: "",
  expiryDate: "",
  serialNumbers: "",
});

export function GoodsReceiptsPage() {
  const { t } = useTranslation("purchasing");
  const { data: receipts, isLoading, error } = useGoodsReceipts();
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const create = useCreateGoodsReceipt();
  const post = usePostGoodsReceipt();
  const voidReceipt = useVoidGoodsReceipt();
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const { data: selectedPurchaseOrder, isFetching: isLoadingPo } =
    usePurchaseOrder(purchaseOrderId || undefined);
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState<ReceiptLineDraft[]>([emptyLine()]);

  function updateLine(
    index: number,
    key: keyof ReceiptLineDraft,
    value: string,
  ) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  }

  function loadPurchaseOrder() {
    if (!selectedPurchaseOrder) return;
    const openLines = selectedPurchaseOrder.lines
      .map((line) => ({
        productId: line.productId,
        purchaseOrderLineId: line.id,
        qty: String(Number(line.orderedQty) - Number(line.receivedQty)),
        unitCost: line.unitCost ?? "",
        lotCode: "",
        expiryDate: "",
        serialNumbers: "",
      }))
      .filter((line) => Number(line.qty) > 0);
    if (openLines.length === 0) {
      toast.error(t("purchasing.goodsReceipts.noQtyLeft"));
      return;
    }
    setSupplierId(selectedPurchaseOrder.supplierId);
    setBranchId(selectedPurchaseOrder.branchId);
    setLocationId("");
    setLines(openLines);
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!branchId || !locationId || lines.some((line) => !line.productId)) {
      toast.error(t("purchasing.goodsReceipts.selectRequired"));
      return;
    }
    create.mutate(
      {
        purchaseOrderId: purchaseOrderId || null,
        supplierId: supplierId || null,
        branchId,
        locationId,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          purchaseOrderLineId: line.purchaseOrderLineId ?? null,
          qty: line.qty,
          unitCost: line.unitCost || null,
          lotCode: line.lotCode || null,
          expiryDate: line.expiryDate
            ? new Date(`${line.expiryDate}T00:00:00`)
            : null,
          serialNumbers: line.serialNumbers
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          lineNumber: index + 1,
        })),
      },
      {
        onSuccess: () => {
          toast.success(t("purchasing.goodsReceipts.createSuccess"));
          setPurchaseOrderId("");
          setSupplierId("");
          setBranchId("");
          setLocationId("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  const productLabel = (id: string) => {
    const product = products?.find((item) => item.id === id);
    return product ? `${product.sku} — ${product.name}` : id;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("purchasing.goodsReceipts.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("purchasing.goodsReceipts.description")}
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">
          {t("purchasing.goodsReceipts.newTitle")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-w-64 rounded border border-slate-300 px-3 py-2"
            value={purchaseOrderId}
            onChange={(event) => {
              setPurchaseOrderId(event.target.value);
              if (!event.target.value) {
                setSupplierId("");
                setLines([emptyLine()]);
              }
            }}
          >
            <option value="">{t("purchasing.goodsReceipts.adhocReceipt")}</option>
            {(purchaseOrders ?? [])
              .filter((order) =>
                ["submitted", "partially_received"].includes(order.status),
              )
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.documentNumber ?? order.id.slice(0, 8)} —{" "}
                  {order.status}
                </option>
              ))}
          </select>
          {purchaseOrderId ? (
            <button
              type="button"
              disabled={!selectedPurchaseOrder || isLoadingPo}
              className="rounded border border-teal-800 px-3 py-2 text-sm text-teal-800 disabled:opacity-50"
              onClick={loadPurchaseOrder}
            >
              {isLoadingPo
                ? t("purchasing.goodsReceipts.loading")
                : t("purchasing.goodsReceipts.loadPoLines")}
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="rounded border border-slate-300 px-3 py-2"
            value={supplierId}
            disabled={Boolean(purchaseOrderId)}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">
              {t("purchasing.goodsReceipts.supplierOptional")}
            </option>
            {(suppliers ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} — {supplier.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            disabled={Boolean(purchaseOrderId)}
            onChange={(event) => {
              setBranchId(event.target.value);
              setLocationId("");
            }}
          >
            <option value="">{t("purchasing.goodsReceipts.branch")}</option>
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
            <option value="">
              {t("purchasing.goodsReceipts.receivingLocation")}
            </option>
            {(locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={`${line.purchaseOrderLineId ?? "adhoc"}-${index}`}
              className="space-y-2 rounded bg-slate-50 p-3"
            >
              {!line.purchaseOrderLineId ? (
                <BarcodeScanField
                  onProduct={(productId) =>
                    updateLine(index, "productId", productId)
                  }
                />
              ) : null}
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]">
                <select
                  required
                  disabled={Boolean(line.purchaseOrderLineId)}
                  className="rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(index, "productId", event.target.value)
                  }
                >
                  <option value="">{t("purchasing.goodsReceipts.product")}</option>
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
                  aria-label={t("purchasing.goodsReceipts.qtyAria", {
                    n: index + 1,
                  })}
                  placeholder={t("purchasing.goodsReceipts.qtyPlaceholder")}
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(index, "qty", event.target.value)
                  }
                />
                <input
                  inputMode="decimal"
                  className="rounded border border-slate-300 px-3 py-2"
                  aria-label={t("purchasing.goodsReceipts.unitCostAria", {
                    n: index + 1,
                  })}
                  placeholder={t("purchasing.goodsReceipts.unitCostPlaceholder")}
                  value={line.unitCost}
                  onChange={(event) =>
                    updateLine(index, "unitCost", event.target.value)
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
                  {t("purchasing.goodsReceipts.remove")}
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder={t("purchasing.goodsReceipts.lotCodePlaceholder")}
                  value={line.lotCode}
                  onChange={(event) =>
                    updateLine(index, "lotCode", event.target.value)
                  }
                />
                <input
                  type="date"
                  aria-label={t("purchasing.goodsReceipts.expiryAria", {
                    n: index + 1,
                  })}
                  className="rounded border border-slate-300 px-3 py-2"
                  value={line.expiryDate}
                  onChange={(event) =>
                    updateLine(index, "expiryDate", event.target.value)
                  }
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder={t("purchasing.goodsReceipts.serialsPlaceholder")}
                  value={line.serialNumbers}
                  onChange={(event) =>
                    updateLine(index, "serialNumbers", event.target.value)
                  }
                />
              </div>
              {line.productId ? (
                <p className="text-xs text-slate-500">
                  {productLabel(line.productId)}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {!purchaseOrderId ? (
            <button
              type="button"
              className="rounded border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              {t("purchasing.goodsReceipts.addLine")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {create.isPending
              ? t("purchasing.goodsReceipts.creating")
              : t("purchasing.goodsReceipts.createDraft")}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">
          {t("purchasing.goodsReceipts.listTitle")}
        </h2>
        {isLoading ? <p>{t("purchasing.goodsReceipts.loading")}</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  {t("purchasing.goodsReceipts.col.receipt")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.goodsReceipts.col.source")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.goodsReceipts.col.location")}
                </th>
                <th className="px-4 py-3">
                  {t("purchasing.goodsReceipts.col.status")}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(receipts ?? []).map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-4 py-3 font-medium">
                    {receipt.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {receipt.purchaseOrderId
                      ? t("purchasing.goodsReceipts.sourcePo", {
                          id: receipt.purchaseOrderId.slice(0, 8),
                        })
                      : t("purchasing.goodsReceipts.sourceAdhoc")}
                  </td>
                  <td className="px-4 py-3">
                    {locations?.find(
                      (location) => location.id === receipt.locationId,
                    )?.name ?? receipt.locationId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{receipt.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {receipt.status === "draft" ? (
                      <button
                        type="button"
                        disabled={post.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          post.mutate(
                            { id: receipt.id },
                            {
                              onSuccess: () =>
                                toast.success(
                                  t("purchasing.goodsReceipts.postSuccess"),
                                ),
                            },
                          )
                        }
                      >
                        {t("purchasing.goodsReceipts.post")}
                      </button>
                    ) : null}
                    {receipt.status === "posted" ? (
                      <button
                        type="button"
                        disabled={voidReceipt.isPending}
                        className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        onClick={() =>
                          voidReceipt.mutate(receipt.id, {
                            onSuccess: () =>
                              toast.success(
                                t("purchasing.goodsReceipts.voidSuccess"),
                              ),
                          })
                        }
                      >
                        {t("purchasing.goodsReceipts.void")}
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
