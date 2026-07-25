# Glossary

Project shorthand for stock-management.

## Acronyms
| Term | Meaning | Context |
|------|---------|---------|
| PO | Purchase Order | Purchasing |
| GRN / Goods Receipt | Goods receipt document | Inbound stock |
| GRNI | Goods Received Not Invoiced | Accounting clearing |
| COGS | Cost of Goods Sold | P&L on outbound |
| FIFO | First In First Out | Cost layer consumption |
| FEFO | First Expired First Out | Lot picking |
| UOM | Unit of Measure | Product qty units |
| SKU | Stock Keeping Unit | Product identity |
| AP | Accounts Payable | Supplier bills |
| AR | Accounts Receivable | Customer invoices (later) |
| GL | General Ledger | Chart of accounts + journals |
| POS | Point of Sale | Phase F / external |

## Internal Terms
| Term | Meaning |
|------|---------|
| document-driven | Never edit stock qty directly; post a document |
| movement ledger | Immutable `stock_movements` history |
| cost layer | FIFO qty_remaining × unit_cost bucket |
| outbox | Reliable event queue in Postgres |
| modular monolith | Single API deploy, domain modules inside |
| sellable location | Location flag `is_sellable` for availability |

## Project Codenames
| Codename | Project |
|----------|---------|
| stock-management | This inventory + accounting platform |
| ipos | Jaidee POS (separate; future API consumer) |
