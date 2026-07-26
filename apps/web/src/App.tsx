import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { api } from "./api/client";
import {
  useBranches,
  useCreateBranch,
  useCreateLocation,
  useCreateProduct,
  useCreateSupplier,
  useLocations,
  useProducts,
  useSuppliers,
} from "./hooks/masters";

const queryClient = new QueryClient();

function Shell() {
  const orgId = localStorage.getItem("orgId") ?? "";
  const [orgName, setOrgName] = useState("Demo Shop");
  const [busy, setBusy] = useState(false);

  async function bootstrap() {
    setBusy(true);
    try {
      const userId = "00000000-0000-0000-0000-000000000001";
      localStorage.setItem("userId", userId);
      const org = await api.createOrg(userId, orgName);
      localStorage.setItem("orgId", org.id);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
          Stock Mgmt
        </p>
        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/" className="rounded px-2 py-1 hover:bg-slate-100">
            Dashboard
          </Link>
          <Link to="/branches" className="rounded px-2 py-1 hover:bg-slate-100">
            Branches
          </Link>
          <Link to="/locations" className="rounded px-2 py-1 hover:bg-slate-100">
            Locations
          </Link>
          <Link to="/products" className="rounded px-2 py-1 hover:bg-slate-100">
            Products
          </Link>
          <Link to="/suppliers" className="rounded px-2 py-1 hover:bg-slate-100">
            Suppliers
          </Link>
        </nav>
        <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-500">
          {orgId ? (
            <p className="break-all">Org: {orgId}</p>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full rounded border border-slate-300 px-2 py-1"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Org name"
              />
              <button
                type="button"
                disabled={busy}
                onClick={bootstrap}
                className="w-full rounded bg-teal-800 px-2 py-1 text-white disabled:opacity-50"
              >
                Create org
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Phase A shell — use the sidebar to manage masters.
      </p>
    </div>
  );
}

function BranchesPage() {
  const { data, isLoading, error } = useBranches();
  const create = useCreateBranch();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Branches</h1>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ code, name }, { onSuccess: () => {
            setCode("");
            setName("");
          }});
        }}
      >
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white"
          disabled={create.isPending}
        >
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{(error as Error).message}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((b) => (
          <li key={b.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{b.code}</span> — {b.name}
            </span>
            <span className="text-slate-500">{b.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocationsPage() {
  const { data: branches } = useBranches();
  const [branchId, setBranchId] = useState("");
  const { data, isLoading, error } = useLocations(branchId || undefined);
  const create = useCreateLocation();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Locations</h1>
      <select
        className="rounded border border-slate-300 px-3 py-2"
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
      >
        <option value="">All branches</option>
        {(branches ?? []).map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} — {b.name}
          </option>
        ))}
      </select>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branchId) {
            alert("Select a branch");
            return;
          }
          create.mutate(
            { branchId, code, name, type: "storage" },
            {
              onSuccess: () => {
                setCode("");
                setName("");
              },
            },
          );
        }}
      >
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="rounded bg-teal-800 px-4 py-2 text-white">
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{(error as Error).message}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((loc) => (
          <li key={loc.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{loc.code}</span> — {loc.name} ({loc.type})
            </span>
            <span className="text-slate-500">{loc.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductsPage() {
  const { data, isLoading, error } = useProducts();
  const create = useCreateProduct();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [trackLot, setTrackLot] = useState(false);
  const [trackSerial, setTrackSerial] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Products</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { sku, name, trackLot, trackSerial, trackExpiry },
            {
              onSuccess: () => {
                setSku("");
                setName("");
                setTrackLot(false);
                setTrackSerial(false);
                setTrackExpiry(false);
              },
            },
          );
        }}
      >
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="rounded bg-teal-800 px-4 py-2 text-white">
            Add
          </button>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trackLot}
              onChange={(e) => setTrackLot(e.target.checked)}
            />
            Lot
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trackSerial}
              onChange={(e) => setTrackSerial(e.target.checked)}
            />
            Serial
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trackExpiry}
              onChange={(e) => setTrackExpiry(e.target.checked)}
            />
            Expiry
          </label>
        </div>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{(error as Error).message}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{p.sku}</span> — {p.name}
            </span>
            <span className="text-slate-500">
              {[p.trackLot && "lot", p.trackSerial && "serial", p.trackExpiry && "expiry"]
                .filter(Boolean)
                .join(", ") || "no tracking"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuppliersPage() {
  const { data, isLoading, error } = useSuppliers();
  const create = useCreateSupplier();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Suppliers</h1>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ code, name }, { onSuccess: () => {
            setCode("");
            setName("");
          }});
        }}
      >
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="rounded bg-teal-800 px-4 py-2 text-white">
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{(error as Error).message}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((s) => (
          <li key={s.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{s.code}</span> — {s.name}
            </span>
            <span className="text-slate-500">{s.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: Shell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const branchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/branches",
  component: BranchesPage,
});

const locationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/locations",
  component: LocationsPage,
});

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products",
  component: ProductsPage,
});

const suppliersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/suppliers",
  component: SuppliersPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  branchesRoute,
  locationsRoute,
  productsRoute,
  suppliersRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
