import { useState } from "react";
import { useStockBalances, useStockMovements } from "../hooks/inventory";
import { useLocations, useProducts } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

export function StockPage() {
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
        <h1 className="text-2xl font-semibold">Stock inquiry</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inspect balances (on hand, reserved, available) and the immutable
          movement ledger.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-4">
        <select
          className="min-w-56 rounded border border-slate-300 px-3 py-2"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">All products</option>
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
          <option value="">All locations</option>
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
          Low stock only
        </label>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Balances</h2>
        {balances.isLoading ? <p>Loading…</p> : null}
        {balances.error ? (
          <p className="text-red-700">{formatApiError(balances.error)}</p>
        ) : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Lot</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
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
              No balances match these filters.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Movements</h2>
        {movements.isLoading ? <p>Loading…</p> : null}
        {movements.error ? (
          <p className="text-red-700">{formatApiError(movements.error)}</p>
        ) : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(movements.data ?? []).map((movement) => (
                <tr key={movement.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Date(movement.createdAt).toLocaleString()}
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
              No movements match these filters.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
