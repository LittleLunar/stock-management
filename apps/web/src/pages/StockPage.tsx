import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCostLayers } from "../hooks/costing";
import { useStockBalances, useStockMovements } from "../hooks/inventory";
import { useLocations, useProducts } from "../hooks/masters";
import { formatDateTime } from "../i18n/format";
import { formatApiError } from "../lib/errors";

type CostLayerRow = {
  id: string;
  productId: string;
  locationId: string;
  unitCost: string;
  qtyRemaining: string;
  receivedAt: string;
};

export function StockPage() {
  const { t } = useTranslation("inventory");
  const { data: products } = useProducts();
  const { data: locations } = useLocations();
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const filters = {
    productId: productId || undefined,
    locationId: locationId || undefined,
  };
  const balances = useStockBalances({ ...filters, lowStock });
  const movements = useStockMovements(filters);
  const costLayers = useCostLayers(filters);
  const layers = (costLayers.data ?? []) as CostLayerRow[];

  const productName = (id: string) => {
    const product = products?.find((item) => item.id === id);
    return product ? `${product.sku} — ${product.name}` : id;
  };
  const locationName = (id: string) => {
    const location = locations?.find((item) => item.id === id);
    return location ? `${location.code} — ${location.name}` : id;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("inventory.stock.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("inventory.stock.description")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-4">
        <select
          className="min-w-56 rounded border border-slate-300 px-3 py-2"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">{t("inventory.stock.allProducts")}</option>
          {(products ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.sku} — {product.name}
            </option>
          ))}
        </select>
        <select
          className="min-w-56 rounded border border-slate-300 px-3 py-2"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">{t("inventory.stock.allLocations")}</option>
          {(locations ?? []).map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} — {location.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(event) => setLowStock(event.target.checked)}
          />
          {t("inventory.stock.lowStockOnly")}
        </label>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("inventory.stock.balances")}</h2>
        {balances.isLoading ? <p>{t("inventory.stock.loading")}</p> : null}
        {balances.error ? (
          <p className="text-red-700">{formatApiError(balances.error)}</p>
        ) : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("inventory.stock.col.product")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.location")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.lot")}</th>
                <th className="px-4 py-3 text-right">
                  {t("inventory.stock.col.onHand")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("inventory.stock.col.reserved")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("inventory.stock.col.available")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(balances.data ?? []).map((balance) => {
                const available = Math.max(
                  0,
                  Number(balance.qtyOnHand) - Number(balance.qtyReserved),
                );
                return (
                <tr key={balance.id}>
                  <td className="px-4 py-3 font-medium">
                    {productName(balance.productId)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(balance.locationId)}
                  </td>
                  <td className="px-4 py-3">
                    {balance.lotId ? balance.lotId.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {balance.qtyOnHand}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {balance.qtyReserved}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number.isFinite(available) ? String(available) : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!balances.isLoading && (balances.data?.length ?? 0) === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              {t("inventory.stock.emptyBalances")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("inventory.stock.movements")}</h2>
        {movements.isLoading ? <p>{t("inventory.stock.loading")}</p> : null}
        {movements.error ? (
          <p className="text-red-700">{formatApiError(movements.error)}</p>
        ) : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("inventory.stock.col.time")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.product")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.location")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.type")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.document")}</th>
                <th className="px-4 py-3 text-right">
                  {t("inventory.stock.col.quantity")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(movements.data ?? []).map((movement) => (
                <tr key={movement.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDateTime(movement.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {productName(movement.productId)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(movement.locationId)}
                  </td>
                  <td className="px-4 py-3">{movement.movementType}</td>
                  <td className="px-4 py-3">
                    {movement.documentType} {movement.documentId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {movement.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!movements.isLoading && (movements.data?.length ?? 0) === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              {t("inventory.stock.emptyMovements")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("inventory.stock.openCostLayers")}</h2>
        {costLayers.isLoading ? <p>{t("inventory.stock.loading")}</p> : null}
        {costLayers.error ? (
          <p className="text-red-700">{formatApiError(costLayers.error)}</p>
        ) : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3">{t("inventory.stock.col.product")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.location")}</th>
                <th className="px-4 py-3">{t("inventory.stock.col.received")}</th>
                <th className="px-4 py-3 text-right">
                  {t("inventory.stock.col.qtyRem")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("inventory.stock.col.unitCost")}
                </th>
              </tr>
            </thead>
            <tbody>
              {layers.map((layer) => (
                <tr key={layer.id} className="border-b">
                  <td className="px-4 py-3">{productName(layer.productId)}</td>
                  <td className="px-4 py-3">
                    {locationName(layer.locationId)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateTime(layer.receivedAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {layer.qtyRemaining}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {layer.unitCost}
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
