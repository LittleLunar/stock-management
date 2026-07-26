import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BarcodeScanField } from "../components/BarcodeScanField";
import {
  useCreateStockTransfer,
  useReceiveStockTransfer,
  useShipStockTransfer,
  useStockTransfers,
  useVoidStockTransfer,
} from "../hooks/inventory";
import { useBranches, useLocations, useProducts } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type TransferLineDraft = {
  productId: string;
  qty: string;
  lotId: string;
  serialNumbers: string;
};

const emptyLine = (): TransferLineDraft => ({
  productId: "",
  qty: "1",
  lotId: "",
  serialNumbers: "",
});

function ReplenishWizard() {
  const { data: branches } = useBranches();
  const { data: locations } = useLocations();
  const { data: products } = useProducts();
  const create = useCreateStockTransfer();
  const [toBranchId, setToBranchId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [transitLocationId, setTransitLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");

  const toLocations = (locations ?? []).filter(
    (l) => l.branchId === toBranchId && l.type !== "transit",
  );

  function handleReplenish(event: FormEvent) {
    event.preventDefault();
    if (
      !toBranchId ||
      !fromLocationId ||
      !toLocationId ||
      !transitLocationId ||
      !productId
    ) {
      toast.error("Select destination branch, locations, and a product");
      return;
    }
    if (fromLocationId === toLocationId) {
      toast.error("From and to locations must be different");
      return;
    }
    create.mutate(
      {
        fromLocationId,
        toLocationId,
        transitLocationId,
        purpose: "replenishment",
        lines: [{ productId, qty, lineNumber: 1 }],
      },
      {
        onSuccess: () => {
          toast.success("Replenishment transfer created");
          setProductId("");
          setQty("1");
        },
        onError: (err) => toast.error(formatApiError(err)),
      },
    );
  }

  return (
    <form
      className="space-y-4 rounded border border-slate-200 bg-white p-5"
      onSubmit={handleReplenish}
    >
      <h2 className="font-semibold">Replenish branch</h2>
      <p className="text-sm text-slate-600">
        Cross-branch transfer with purpose{" "}
        <span className="font-medium">replenishment</span>.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <select
          required
          className="rounded border border-slate-300 px-3 py-2"
          value={toBranchId}
          onChange={(e) => {
            setToBranchId(e.target.value);
            setToLocationId("");
          }}
        >
          <option value="">Destination branch</option>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} — {b.name}
            </option>
          ))}
        </select>
        <select
          required
          className="rounded border border-slate-300 px-3 py-2"
          value={fromLocationId}
          onChange={(e) => setFromLocationId(e.target.value)}
        >
          <option value="">From location</option>
          {(locations ?? [])
            .filter((l) => l.type !== "transit")
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
        </select>
        <select
          required
          className="rounded border border-slate-300 px-3 py-2"
          value={toLocationId}
          onChange={(e) => setToLocationId(e.target.value)}
        >
          <option value="">To location</option>
          {toLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.name}
            </option>
          ))}
        </select>
        <select
          required
          className="rounded border border-slate-300 px-3 py-2"
          value={transitLocationId}
          onChange={(e) => setTransitLocationId(e.target.value)}
        >
          <option value="">Transit</option>
          {(locations ?? [])
            .filter((l) => l.type === "transit")
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
        </select>
        <div className="space-y-2 md:col-span-2 xl:col-span-1">
          <BarcodeScanField onProduct={setProductId} />
          <select
            required
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Product</option>
            {(products ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name}
              </option>
            ))}
          </select>
        </div>
        <input
          required
          inputMode="decimal"
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Quantity"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {create.isPending ? "Creating…" : "Create replenishment"}
      </button>
    </form>
  );
}

export function StockTransfersPage() {
  const { data: transfers, isLoading, error } = useStockTransfers();
  const { data: locations } = useLocations();
  const { data: products } = useProducts();
  const create = useCreateStockTransfer();
  const ship = useShipStockTransfer();
  const receive = useReceiveStockTransfer();
  const voidTransfer = useVoidStockTransfer();
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [transitLocationId, setTransitLocationId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [lines, setLines] = useState<TransferLineDraft[]>([emptyLine()]);

  const storageLocations = (locations ?? []).filter(
    (location) => location.type !== "transit",
  );
  const transitLocations = (locations ?? []).filter(
    (location) => location.type === "transit",
  );

  function updateLine(
    index: number,
    key: keyof TransferLineDraft,
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
      !fromLocationId ||
      !toLocationId ||
      !transitLocationId ||
      lines.some((line) => !line.productId)
    ) {
      toast.error("Select from, to, transit, and a product for every line");
      return;
    }
    if (fromLocationId === toLocationId) {
      toast.error("From and to locations must be different");
      return;
    }
    create.mutate(
      {
        fromLocationId,
        toLocationId,
        transitLocationId,
        purpose: "standard",
        documentNumber: documentNumber || null,
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
          toast.success("Stock transfer created");
          setDocumentNumber("");
          setLines([emptyLine()]);
        },
      },
    );
  }

  const locationName = (id: string) => {
    const location = locations?.find((item) => item.id === id);
    return location ? `${location.code} — ${location.name}` : id.slice(0, 8);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Stock transfers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Move stock between locations via a transit location. Ship then
          receive.
        </p>
      </div>

      <ReplenishWizard />

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">New stock transfer</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={fromLocationId}
            onChange={(event) => setFromLocationId(event.target.value)}
          >
            <option value="">From location</option>
            {storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={toLocationId}
            onChange={(event) => setToLocationId(event.target.value)}
          >
            <option value="">To location</option>
            {storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded border border-slate-300 px-3 py-2"
            value={transitLocationId}
            onChange={(event) => setTransitLocationId(event.target.value)}
          >
            <option value="">Transit location</option>
            {transitLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} — {location.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Document number (optional)"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>
        {transitLocations.length === 0 ? (
          <p className="text-sm text-amber-800">
            Create a location with type{" "}
            <span className="font-medium">transit</span> before shipping
            transfers.
          </p>
        ) : null}

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="space-y-2 rounded bg-slate-50 p-3">
              <BarcodeScanField
                onProduct={(productId) =>
                  updateLine(index, "productId", productId)
                }
              />
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_auto]">
                <select
                  required
                  className="rounded border border-slate-300 px-3 py-2"
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(index, "productId", event.target.value)
                  }
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
                  aria-label={`Line ${index + 1} quantity`}
                  placeholder="Quantity"
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
                  Remove
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder="Lot id (optional)"
                  value={line.lotId}
                  onChange={(event) =>
                    updateLine(index, "lotId", event.target.value)
                  }
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2"
                  placeholder="Serials, comma separated"
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
            Add line
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Transfers</h2>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Transit</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(transfers ?? []).map((transfer) => (
                <tr key={transfer.id}>
                  <td className="px-4 py-3 font-medium">
                    {transfer.documentNumber ?? transfer.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(transfer.fromLocationId)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(transfer.transitLocationId)}
                  </td>
                  <td className="px-4 py-3">
                    {locationName(transfer.toLocationId)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        transfer.purpose === "replenishment"
                          ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                          : "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      }
                    >
                      {transfer.purpose ?? "standard"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{transfer.status}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {transfer.status === "draft" ? (
                      <button
                        type="button"
                        disabled={ship.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          ship.mutate(
                            { id: transfer.id },
                            {
                              onSuccess: () =>
                                toast.success("Transfer shipped"),
                            },
                          )
                        }
                      >
                        Ship
                      </button>
                    ) : null}
                    {transfer.status === "in_transit" ? (
                      <button
                        type="button"
                        disabled={receive.isPending}
                        className="rounded bg-teal-800 px-3 py-1.5 text-white disabled:opacity-50"
                        onClick={() =>
                          receive.mutate(
                            { id: transfer.id },
                            {
                              onSuccess: () =>
                                toast.success("Transfer received"),
                            },
                          )
                        }
                      >
                        Receive
                      </button>
                    ) : null}
                    {transfer.status === "draft" ||
                    transfer.status === "in_transit" ? (
                      <button
                        type="button"
                        disabled={voidTransfer.isPending}
                        className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        onClick={() =>
                          voidTransfer.mutate(transfer.id, {
                            onSuccess: () =>
                              toast.success("Transfer voided"),
                          })
                        }
                      >
                        Void
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
