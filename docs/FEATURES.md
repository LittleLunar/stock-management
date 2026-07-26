# Features by phase

Canonical feature inventory for stock-management. Wiki mirror: [[Feature Phases]].

**Implementation rule:** All phases (A–F) follow [architecture/coding-standards.md](./architecture/coding-standards.md) (Full Clean Architecture).

---

## Phase A — Platform skeleton

| Area | Features |
|------|----------|
| **Org** | Organization, currency, timezone, fiscal year |
| **Branches** | Create/manage sites |
| **Locations** | Warehouses/bins (storage, receiving, transit, quarantine) |
| **Users & roles** | Org admin, branch manager, warehouse, purchasing, accountant; branch-scoped access |
| **Products** | SKU, name, UOM, category, barcode(s), active/inactive |
| **Tracking flags** | Lot, serial, expiry per product |
| **Costing flag** | FIFO (default) / avg placeholder |
| **Reorder fields** | Min/max on product |
| **Categories** | Product grouping |
| **Suppliers** | Supplier master + optional supplier–SKU links |
| **Customers** | Master data stub |
| **App shell** | Auth, layout, empty dashboard |

---

## Phase B — Internal inventory loop

| Area | Features |
|------|----------|
| **Stock balances** | On-hand + reserved by product / location / lot |
| **Movement ledger** | Immutable history of every qty change |
| **Lots** | Lot number, expiry, status |
| **Serials** | Serial numbers, status, location; optional lot link |
| **Purchase orders** | Draft → submit → receive → close/cancel |
| **Goods receipt** | From PO or ad-hoc; lot/expiry/serial; cost capture |
| **Stock issue** | Internal consume / sample / write-off |
| **Transfers** | Bin↔bin and branch↔branch with in-transit |
| **Adjustments** | Reason-coded; optional approval |
| **Stock counts** | Cycle count → variance → post |
| **Returns** | Supplier returns; customer returns structure |
| **Low stock** | List by reorder min |
| **Lookups** | Lot inquiry, serial inquiry |
| **Reservations API** | Create / release / commit |
| **Availability API** | On-hand − reserved by SKU/branch |
| **Idempotency** | `external_system` + `external_id` |
| **Outbox events** | `stock.changed`, `document.posted` |
| **Document rules** | Draft / posted / void |

---

## Phase C — Costing

| Area | Features |
|------|----------|
| **FIFO cost layers** | Created on receipt; consumed on outbound |
| **Cost on movements** | Unit/total cost on outbounds |
| **Landed cost** | Freight/duty onto receipts/layers |
| **Valuation report** | By branch / location / lot / as-of |
| **Product cost inquiry** | Open layers, remaining qty |
| **COGS report** | By period / branch |
| **Revaluation / write-down** | Adjust layer value |
| **Cost summary cache** | Derived avg/on-hand value for UI |

---

## Phase D — Accounting

| Area | Features |
|------|----------|
| **Chart of accounts** | Asset/liability/equity/income/expense |
| **Account mapping** | Events → GL accounts |
| **Accounting periods** | Open / close |
| **Auto journals** | From receipt, COGS, adjustment, etc. |
| **Journal browser** | Document → journal → lines |
| **Supplier invoices (AP)** | Bills |
| **3-way match** | PO ↔ receipt ↔ invoice |
| **AP aging** | |
| **Trial balance / P&L / balance sheet** | Optional branch dimension |
| **Period close checklist** | Warn on unposted docs |
| **Void / reverse journals** | With source document void |

---

## Phase E — Multi-branch hardening

| Area | Features |
|------|----------|
| **Inter-branch replenishment** | HQ → branch, supplier → branch |
| **Branch-scoped UX** | Managers vs HQ |
| **Consolidated vs branch reports** | |
| **Reservation discipline** | No oversell |
| **Webhooks** | External push |
| **Approval policies** | Adjustments & POs |
| **Quarantine / FEFO** | Expired lots blocked |
| **Barcode scanning UX** | Receive, pick, count |

---

## Phase F — POS & channels

| Area | Features |
|------|----------|
| **Built-in POS** (optional) | Checkout via reserve → commit |
| **External POS plug-in** | Idempotent sale/return/sync |
| **Sales documents** | Issue + COGS ± AR |
| **Returns from POS** | Restock or scrap |
| **Tax on sales** | When invoicing |
| **Channel availability** | Per-branch sellable qty |

---

## Later / optional

Demand forecasting, ABC/dead stock, standard cost + variance, multi-company, EDI, banking feeds, advanced WMS, promotions/loyalty.

---

## MVP cut line

**A + B (+ light C on receipt)** = usable internal multi-location inventory.  
**C + D** = finance-grade.  
**E + F** = retail / POS scale.
