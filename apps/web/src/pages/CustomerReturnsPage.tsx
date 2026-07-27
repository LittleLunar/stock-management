import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useCreateCustomerReturn,
  useCustomerReturns,
  usePostCustomerReturn,
  useVoidCustomerReturn,
} from "../hooks/inventory";
import {
  useBranches,
  useCustomers,
  useLocations,
  useProducts,
} from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type ReturnLineDraft = {
  productId: string;
  qty: string;
  unitCost: string;
  lotId: string;
  serialNumbers: string;
};

const emptyLine = (): ReturnLineDraft => ({
  productId: "",
  qty: "1",
  unitCost: "",
  lotId: "",
  serialNumbers: "",
});

export function CustomerReturnsPage() {
  const { t } = useTranslation("inventory");
  const { data: returns, isLoading, error } = useCustomerReturns();
  const { data: branches } = useBranches();
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const create = useCreateCustomerReturn();
  const post = usePostCustomerReturn();
  const voidReturn = useVoidCustomerReturn();
  const [branchId, setBranchId] = useState("");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
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
      !customerId ||
      lines.some((line) => !line.productId)
    ) {
      toast.error(t("inventory.customerReturns.selectRequired"));
      return;
    }
    create.mutate(
      {
        branchId,
        locationId,
        customerId,
        documentNumber: documentNumber || null,
        lines: lines.map((line, index) => ({
          productId: line.productId,
          qty: line.qty,
          unitCost: line.unitCost.trim() || null,
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
          toast.success(t("inventory.customerReturns.createSuccess"));
          setDocumentNumber("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  const branchName = (id: string) =>
    branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8);
  const locationName = (id: string) =>
    locations?.find((location) => location.id === id)?.name ?? id.slice(0, 8);
  const customerName = (id: string) =>
    customers?.find((customer) => customer.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("inventory.customerReturns.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("inventory.customerReturns.description")}
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">
          {t("inventory.customerReturns.newTitle")}
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
            <option value="">{t("inventory.customerReturns.branch")}</option>
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
            <option value="">{t("inventory.customerReturns.location")}</option>
            {(locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">{t("inventory.customerReturns.customer")}</option>
            {(customers ?? []).map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.code} — {customer.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder={t(
              "inventory.customerReturns.documentNumberPlaceholder",
            )}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="space-y-2 rounded bg-slate-50 p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]">
                <select
                  required
                  className="rounded border border-slate-300 px-3 py-2"
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(index, "productId", event.target.value)
                  }
                >
                  <option value="">
                    {t("inventory.customerReturns.product")}
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
                  aria-label={t("inventory.customerReturns.qtyAria", {
                    n: index + 1,
                  })}
                  placeholder={t("inventory.customerReturns.qtyPlaceholder")}
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(index, "qty", event.target.value)
                  }
                />
                <input
                  required
                  inputMode="decimal"
                  className="rounded border border-slate-300 px-3 py-2"
                  aria-label={t("inventory.customerReturns.unitCostAria", {
                    n: index + 1,
                  })}
                  placeholder={t(
                    "inventory.customerReturns.unitCostPlaceholder",
                  )}
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
                  {t("inventory.customerReturns.remove")}
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder={t(
                    "inventory.customerReturns.lotIdPlaceholder",
                  )}
                  value={line.lotId}
                  onChange={(event) =>
                    updateLine(index, "lotId", event.target.value)
                  }
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder={t(
                    "inventory.customerReturns.serialsPlaceholder",
                  )}
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
            {t("inventory.customerReturns.addLine")}
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {create.isPending
              ? t("inventory.customerReturns.creating")
              : t("inventory.customerReturns.createDraft")}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">
          {t("inventory.customerReturns.listTitle")}
        </h2>
        {isLoading ? <p>{t("inventory.customerReturns.loading")}</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  {t("inventory.customerReturns.col.document")}
                </th>
                <th className="px-4 py-3">
                  {t("inventory.customerReturns.col.customer")}
                </th>
                <th className="px-4 py-3">
                  {t("inventory.customerReturns.col.branch")}
                </th>
                <th className="px-4 py-3">
                  {t("inventory.customerReturns.col.location")}
                </th>
                <th className="px-4 py-3">
                  {t("inventory.customerReturns.col.status")}
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
                  <td className="px-4 py-3">{customerName(doc.customerId)}</td>
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
                                  t("inventory.customerReturns.postSuccess"),
                                ),
                            },
                          )
                        }
                      >
                        {t("inventory.customerReturns.post")}
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
                                t("inventory.customerReturns.voidSuccess"),
                              ),
                          })
                        }
                      >
                        {t("inventory.customerReturns.void")}
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
