export type SidebarSectionId =
  | "masters"
  | "purchasing"
  | "inventory"
  | "costing"
  | "accounting"
  | "settings";

export type SidebarNavItem = {
  to: string;
  labelKey: string;
  /** Path prefix for nested routes (e.g. invoice detail). Defaults to `to`. */
  match?: string;
};

export type SidebarNavSection = {
  id: SidebarSectionId;
  labelKey: string;
  items: SidebarNavItem[];
};

export const dashboardItem: SidebarNavItem = {
  to: "/",
  labelKey: "nav.dashboard",
};

export const sidebarSections: SidebarNavSection[] = [
  {
    id: "masters",
    labelKey: "nav.masters",
    items: [
      { to: "/branches", labelKey: "nav.branches" },
      { to: "/locations", labelKey: "nav.locations" },
      { to: "/products", labelKey: "nav.products" },
      { to: "/suppliers", labelKey: "nav.suppliers" },
      { to: "/customers", labelKey: "nav.customers" },
    ],
  },
  {
    id: "purchasing",
    labelKey: "nav.purchasing",
    items: [
      { to: "/purchase-orders", labelKey: "nav.purchaseOrders" },
      { to: "/goods-receipts", labelKey: "nav.goodsReceipts" },
    ],
  },
  {
    id: "inventory",
    labelKey: "nav.inventory",
    items: [
      { to: "/stock", labelKey: "nav.stock" },
      { to: "/reservations", labelKey: "nav.reservations" },
      { to: "/stock-issues", labelKey: "nav.stockIssues" },
      { to: "/stock-transfers", labelKey: "nav.stockTransfers" },
      { to: "/stock-adjustments", labelKey: "nav.stockAdjustments" },
      { to: "/stock-counts", labelKey: "nav.stockCounts" },
      { to: "/supplier-returns", labelKey: "nav.supplierReturns" },
      { to: "/customer-returns", labelKey: "nav.customerReturns" },
    ],
  },
  {
    id: "costing",
    labelKey: "nav.costing",
    items: [
      { to: "/cost-valuation", labelKey: "nav.costValuation" },
      { to: "/cogs", labelKey: "nav.cogs" },
      { to: "/landed-costs", labelKey: "nav.landedCosts" },
      { to: "/cost-revaluations", labelKey: "nav.costRevaluations" },
    ],
  },
  {
    id: "accounting",
    labelKey: "nav.accounting",
    items: [
      { to: "/accounts", labelKey: "nav.accounts" },
      { to: "/accounting-periods", labelKey: "nav.periods" },
      { to: "/journals", labelKey: "nav.journals" },
      {
        to: "/supplier-invoices",
        labelKey: "nav.supplierInvoices",
        match: "/supplier-invoices",
      },
      { to: "/ap-aging", labelKey: "nav.apAging" },
      { to: "/reports/trial-balance", labelKey: "nav.trialBalance" },
      { to: "/reports/pnl", labelKey: "nav.pnl" },
      { to: "/reports/balance-sheet", labelKey: "nav.balanceSheet" },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    items: [
      { to: "/approval-policies", labelKey: "nav.approvalPolicies" },
      { to: "/webhooks", labelKey: "nav.webhooks" },
    ],
  },
];

function itemMatchesPath(item: SidebarNavItem, pathname: string): boolean {
  const prefix = item.match ?? item.to;
  if (prefix === "/") {
    return pathname === "/";
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function sectionIdForPath(
  pathname: string,
): SidebarSectionId | undefined {
  for (const section of sidebarSections) {
    if (section.items.some((item) => itemMatchesPath(item, pathname))) {
      return section.id;
    }
  }
  return undefined;
}

export function isNavItemActive(
  item: SidebarNavItem,
  pathname: string,
): boolean {
  return itemMatchesPath(item, pathname);
}

export const SIDEBAR_NAV_OPEN_KEY = "sidebarNavOpen";

export type SidebarOpenState = Partial<Record<SidebarSectionId, boolean>>;

export function loadSidebarOpenState(): SidebarOpenState {
  try {
    const raw = localStorage.getItem(SIDEBAR_NAV_OPEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SidebarOpenState;
  } catch {
    return {};
  }
}

export function saveSidebarOpenState(state: SidebarOpenState): void {
  localStorage.setItem(SIDEBAR_NAV_OPEN_KEY, JSON.stringify(state));
}
