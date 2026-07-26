import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateBranchSchema,
  CreateCustomerSchema,
  CreateOrganizationSchema,
  CreateProductSchema,
  CreateSupplierSchema,
} from "@stock-management/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Toaster, toast } from "sonner";
import { z } from "zod";
import { api } from "./api/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { formatApiError } from "./lib/errors";
import {
  useBranches,
  useCreateBranch,
  useCreateCustomer,
  useCreateLocation,
  useCreateProduct,
  useCreateSupplier,
  useCustomers,
  useLocations,
  useProducts,
  useSuppliers,
} from "./hooks/masters";
import { CustomerReturnsPage } from "./pages/CustomerReturnsPage";
import { CogsReportPage } from "./pages/CogsReportPage";
import { CostRevaluationsPage } from "./pages/CostRevaluationsPage";
import { CostValuationPage } from "./pages/CostValuationPage";
import { GoodsReceiptsPage } from "./pages/GoodsReceiptsPage";
import { LandedCostsPage } from "./pages/LandedCostsPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { StockAdjustmentsPage } from "./pages/StockAdjustmentsPage";
import { StockCountsPage } from "./pages/StockCountsPage";
import { StockIssuesPage } from "./pages/StockIssuesPage";
import { StockPage } from "./pages/StockPage";
import { StockTransfersPage } from "./pages/StockTransfersPage";
import { SupplierReturnsPage } from "./pages/SupplierReturnsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountingPeriodsPage } from "./pages/AccountingPeriodsPage";
import { ApAgingPage } from "./pages/ApAgingPage";
import { BalanceSheetPage } from "./pages/BalanceSheetPage";
import { JournalsPage } from "./pages/JournalsPage";
import { PnlReportPage } from "./pages/PnlReportPage";
import { SupplierInvoiceDetailPage } from "./pages/SupplierInvoiceDetailPage";
import { SupplierInvoicesPage } from "./pages/SupplierInvoicesPage";
import { TrialBalancePage } from "./pages/TrialBalancePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      onError: (error) => {
        toast.error(formatApiError(error));
      },
    },
  },
});

queryClient.getQueryCache().config.onError = (error) => {
  toast.error(formatApiError(error));
};

const LocationFormSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
});

function Shell() {
  const orgId = localStorage.getItem("orgId") ?? "";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: { name: "Demo Shop" },
  });

  async function bootstrap(values: z.infer<typeof CreateOrganizationSchema>) {
    try {
      const userId = "00000000-0000-0000-0000-000000000001";
      localStorage.setItem("userId", userId);
      const org = await api.createOrg(userId, values);
      localStorage.setItem("orgId", org.id);
      window.location.reload();
    } catch (err) {
      toast.error(formatApiError(err));
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
          <Link
            to="/locations"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Locations
          </Link>
          <Link to="/products" className="rounded px-2 py-1 hover:bg-slate-100">
            Products
          </Link>
          <Link
            to="/suppliers"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Suppliers
          </Link>
          <Link
            to="/customers"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Customers
          </Link>
          <Link
            to="/purchase-orders"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Purchase orders
          </Link>
          <Link
            to="/goods-receipts"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Goods receipts
          </Link>
          <Link to="/stock" className="rounded px-2 py-1 hover:bg-slate-100">
            Stock inquiry
          </Link>
          <Link
            to="/cost-valuation"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Valuation
          </Link>
          <Link to="/cogs" className="rounded px-2 py-1 hover:bg-slate-100">
            COGS
          </Link>
          <Link
            to="/landed-costs"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Landed costs
          </Link>
          <Link
            to="/cost-revaluations"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Revaluations
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Accounting
          </p>
          <Link to="/accounts" className="rounded px-2 py-1 hover:bg-slate-100">
            Accounts
          </Link>
          <Link
            to="/accounting-periods"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Periods
          </Link>
          <Link to="/journals" className="rounded px-2 py-1 hover:bg-slate-100">
            Journals
          </Link>
          <Link
            to="/supplier-invoices"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Supplier invoices
          </Link>
          <Link to="/ap-aging" className="rounded px-2 py-1 hover:bg-slate-100">
            AP aging
          </Link>
          <Link
            to="/reports/trial-balance"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Trial balance
          </Link>
          <Link to="/reports/pnl" className="rounded px-2 py-1 hover:bg-slate-100">
            P&amp;L
          </Link>
          <Link
            to="/reports/balance-sheet"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Balance sheet
          </Link>
          <Link
            to="/reservations"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Reservations
          </Link>
          <Link
            to="/stock-issues"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Stock issues
          </Link>
          <Link
            to="/stock-transfers"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Stock transfers
          </Link>
          <Link
            to="/stock-adjustments"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Stock adjustments
          </Link>
          <Link
            to="/stock-counts"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Stock counts
          </Link>
          <Link
            to="/supplier-returns"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Supplier returns
          </Link>
          <Link
            to="/customer-returns"
            className="rounded px-2 py-1 hover:bg-slate-100"
          >
            Customer returns
          </Link>
        </nav>
        <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-500">
          {orgId ? (
            <p className="break-all">Org: {orgId}</p>
          ) : (
            <form className="space-y-2" onSubmit={handleSubmit(bootstrap)}>
              <input
                className="w-full rounded border border-slate-300 px-2 py-1"
                placeholder="Org name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-red-700">{errors.name.message}</p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded bg-teal-800 px-2 py-1 text-white disabled:opacity-50"
              >
                Create org
              </button>
            </form>
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
        Manage master data, purchasing, receipts, returns, reservations,
        outbound documents, and stock from the sidebar.
      </p>
    </div>
  );
}

function BranchesPage() {
  const { data, isLoading, error } = useBranches();
  const create = useCreateBranch();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateBranchSchema),
    defaultValues: { code: "", name: "" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Branches</h1>
      <form
        className="flex flex-wrap items-start gap-2"
        onSubmit={handleSubmit((values) => {
          create.mutate(values, { onSuccess: () => reset() });
        })}
      >
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Code"
            {...register("code")}
          />
          {errors.code && (
            <p className="mt-1 text-xs text-red-700">{errors.code.message}</p>
          )}
        </div>
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Name"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white"
          disabled={create.isPending}
        >
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{formatApiError(error)}</p>}
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(LocationFormSchema),
    defaultValues: { code: "", name: "" },
  });

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
        className="flex flex-wrap items-start gap-2"
        onSubmit={handleSubmit((values) => {
          if (!branchId) {
            toast.error("Select a branch");
            return;
          }
          create.mutate(
            { branchId, ...values, type: "storage" },
            { onSuccess: () => reset() },
          );
        })}
      >
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Code"
            {...register("code")}
          />
          {errors.code && (
            <p className="mt-1 text-xs text-red-700">{errors.code.message}</p>
          )}
        </div>
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Name"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white"
        >
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{formatApiError(error)}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((loc) => (
          <li key={loc.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{loc.code}</span> — {loc.name} (
              {loc.type})
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      sku: "",
      name: "",
      trackLot: false,
      trackSerial: false,
      trackExpiry: false,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Products</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={handleSubmit((values) => {
          create.mutate(values, {
            onSuccess: () =>
              reset({
                sku: "",
                name: "",
                trackLot: false,
                trackSerial: false,
                trackExpiry: false,
              }),
          });
        })}
      >
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="SKU"
              {...register("sku")}
            />
            {errors.sku && (
              <p className="mt-1 text-xs text-red-700">{errors.sku.message}</p>
            )}
          </div>
          <div>
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Name"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>
            )}
          </div>
          <button
            type="submit"
            className="rounded bg-teal-800 px-4 py-2 text-white"
          >
            Add
          </button>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("trackLot")} />
            Lot
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("trackSerial")} />
            Serial
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("trackExpiry")} />
            Expiry
          </label>
        </div>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{formatApiError(error)}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{p.sku}</span> — {p.name}
            </span>
            <span className="text-slate-500">
              {[
                p.trackLot && "lot",
                p.trackSerial && "serial",
                p.trackExpiry && "expiry",
              ]
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateSupplierSchema),
    defaultValues: { code: "", name: "" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Suppliers</h1>
      <form
        className="flex flex-wrap items-start gap-2"
        onSubmit={handleSubmit((values) => {
          create.mutate(values, { onSuccess: () => reset() });
        })}
      >
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Code"
            {...register("code")}
          />
          {errors.code && (
            <p className="mt-1 text-xs text-red-700">{errors.code.message}</p>
          )}
        </div>
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Name"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white"
        >
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{formatApiError(error)}</p>}
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

function CustomersPage() {
  const { data, isLoading, error } = useCustomers();
  const create = useCreateCustomer();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: { code: "", name: "" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <form
        className="flex flex-wrap items-start gap-2"
        onSubmit={handleSubmit((values) => {
          create.mutate(values, { onSuccess: () => reset() });
        })}
      >
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Code"
            {...register("code")}
          />
          {errors.code && (
            <p className="mt-1 text-xs text-red-700">{errors.code.message}</p>
          )}
        </div>
        <div>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Name"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="rounded bg-teal-800 px-4 py-2 text-white"
        >
          Add
        </button>
      </form>
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-700">{formatApiError(error)}</p>}
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {(data ?? []).map((customer) => (
          <li
            key={customer.id}
            className="flex justify-between px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium">{customer.code}</span> —{" "}
              {customer.name}
            </span>
            <span className="text-slate-500">{customer.status}</span>
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

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customers",
  component: CustomersPage,
});

const purchaseOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/purchase-orders",
  component: PurchaseOrdersPage,
});

const goodsReceiptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/goods-receipts",
  component: GoodsReceiptsPage,
});

const stockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stock",
  component: StockPage,
});

const costValuationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cost-valuation",
  component: CostValuationPage,
});

const cogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cogs",
  component: CogsReportPage,
});

const landedCostsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/landed-costs",
  component: LandedCostsPage,
});

const costRevaluationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cost-revaluations",
  component: CostRevaluationsPage,
});

const reservationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reservations",
  component: ReservationsPage,
});

const stockIssuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stock-issues",
  component: StockIssuesPage,
});

const stockTransfersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stock-transfers",
  component: StockTransfersPage,
});

const stockAdjustmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stock-adjustments",
  component: StockAdjustmentsPage,
});

const stockCountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stock-counts",
  component: StockCountsPage,
});

const supplierReturnsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/supplier-returns",
  component: SupplierReturnsPage,
});

const customerReturnsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customer-returns",
  component: CustomerReturnsPage,
});

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts",
  component: AccountsPage,
});

const accountingPeriodsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounting-periods",
  component: AccountingPeriodsPage,
});

const journalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/journals",
  component: JournalsPage,
});

const supplierInvoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/supplier-invoices",
  component: SupplierInvoicesPage,
});

const supplierInvoiceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/supplier-invoices/$invoiceId",
  component: SupplierInvoiceDetailPage,
});

const apAgingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ap-aging",
  component: ApAgingPage,
});

const trialBalanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports/trial-balance",
  component: TrialBalancePage,
});

const pnlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports/pnl",
  component: PnlReportPage,
});

const balanceSheetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports/balance-sheet",
  component: BalanceSheetPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  branchesRoute,
  locationsRoute,
  productsRoute,
  suppliersRoute,
  customersRoute,
  purchaseOrdersRoute,
  goodsReceiptsRoute,
  stockRoute,
  costValuationRoute,
  cogsRoute,
  landedCostsRoute,
  costRevaluationsRoute,
  reservationsRoute,
  stockIssuesRoute,
  stockTransfersRoute,
  stockAdjustmentsRoute,
  stockCountsRoute,
  supplierReturnsRoute,
  customerReturnsRoute,
  accountsRoute,
  accountingPeriodsRoute,
  journalsRoute,
  supplierInvoicesRoute,
  supplierInvoiceDetailRoute,
  apAgingRoute,
  trialBalanceRoute,
  pnlRoute,
  balanceSheetRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster position="top-right" richColors closeButton />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
