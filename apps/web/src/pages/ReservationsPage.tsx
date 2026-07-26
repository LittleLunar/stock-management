import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  useAvailability,
  useCommitReservation,
  useCreateReservation,
  useReleaseReservation,
  useReservations,
} from "../hooks/inventory";
import {
  useBranches,
  useLocations,
  useProducts,
} from "../hooks/masters";
import { formatApiError } from "../lib/errors";

export function ReservationsPage() {
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const [branchId, setBranchId] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | "open" | "committed" | "released"
  >("open");
  const { data: locations } = useLocations(branchId || undefined);
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [lotId, setLotId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const filters = {
    branchId: branchId || undefined,
    locationId: locationId || undefined,
    productId: productId || undefined,
    status: statusFilter || undefined,
  };
  const { data: reservations, isLoading, error } = useReservations(filters);
  const availability = useAvailability(
    productId && branchId
      ? { productId, branchId }
      : undefined,
  );
  const create = useCreateReservation();
  const release = useReleaseReservation();
  const commit = useCommitReservation();

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!branchId || !locationId || !productId) {
      toast.error("Select branch, location, and product");
      return;
    }
    create.mutate(
      {
        branchId,
        locationId,
        productId,
        qty,
        lotId: lotId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      {
        onSuccess: () => {
          toast.success("Reservation created");
          setQty("1");
          setLotId("");
          setExpiresAt("");
        },
      },
    );
  }

  const productName = (id: string) => {
    const product = products?.find((item) => item.id === id);
    return product ? `${product.sku} — ${product.name}` : id.slice(0, 8);
  };
  const locationName = (id: string) => {
    const location = locations?.find((item) => item.id === id);
    return location ? `${location.code} — ${location.name}` : id.slice(0, 8);
  };
  const branchName = (id: string) =>
    branches?.find((branch) => branch.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Soft-hold stock at a location. Commit posts a stock issue; release
          frees reserved qty.
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">Create reservation</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setLocationId("");
            }}
          >
            <option value="">Branch</option>
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
            <option value="">Location</option>
            {(locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Product</option>
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
            placeholder="Quantity"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Lot id (optional)"
            value={lotId}
            onChange={(event) => setLotId(event.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded border border-slate-300 px-3 py-2"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            aria-label="Expires at (optional)"
          />
        </div>
        {availability.data ? (
          <p className="text-sm text-slate-600">
            Branch availability — on hand {availability.data.onHand}, reserved{" "}
            {availability.data.reserved}, available{" "}
            <span className="font-medium text-teal-900">
              {availability.data.available}
            </span>
          </p>
        ) : null}
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {create.isPending ? "Reserving…" : "Reserve"}
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Reservations</h2>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "" | "open" | "committed" | "released",
              )
            }
          >
            <option value="open">Open</option>
            <option value="committed">Committed</option>
            <option value="released">Released</option>
            <option value="">All statuses</option>
          </select>
        </div>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(reservations ?? []).map((reservation) => (
                <tr key={reservation.id}>
                  <td className="px-4 py-3 font-medium">
                    {productName(reservation.productId)}
                  </td>
                  <td className="px-4 py-3">
                    {branchName(reservation.branchId)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(reservation.locationId)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {reservation.qty}
                  </td>
                  <td className="px-4 py-3">{reservation.status}</td>
                  <td className="px-4 py-3">
                    {reservation.expiresAt
                      ? new Date(reservation.expiresAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {reservation.status === "open" ? (
                      <>
                        <button
                          type="button"
                          disabled={commit.isPending}
                          className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                          onClick={() =>
                            commit.mutate(reservation.id, {
                              onSuccess: () =>
                                toast.success("Reservation committed"),
                            })
                          }
                        >
                          Commit
                        </button>
                        <button
                          type="button"
                          disabled={release.isPending}
                          className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
                          onClick={() =>
                            release.mutate(reservation.id, {
                              onSuccess: () =>
                                toast.success("Reservation released"),
                            })
                          }
                        >
                          Release
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && (reservations?.length ?? 0) === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No reservations match these filters.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
