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

> **Complete (2026-07-26)** — D1–D3 shipped. See `wiki/features/Phase D.md`.

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

**Status: complete (E1–E3, 2026-07-27).**

| Area | Features | Status |
|------|----------|--------|
| **Inter-branch replenishment** | HQ → branch, supplier → branch (`purpose: replenishment`) | E2 ✓ |
| **Branch-scoped UX** | Managers vs HQ; `X-Branch-Id` | E1 ✓ |
| **Consolidated vs branch reports** | HQ omit branch = all | E1 ✓ |
| **Reservation discipline** | No oversell; lock + expire | E2 ✓ |
| **Webhooks** | Subscriptions + HMAC outbox delivery | E3 ✓ |
| **Approval policies** | Adjustments & POs | E2 ✓ |
| **Quarantine / FEFO** | Expired/quarantine lots hard-blocked | E3 ✓ |
| **Barcode scanning UX** | Receive, issue, count, transfer | E3 ✓ |

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
